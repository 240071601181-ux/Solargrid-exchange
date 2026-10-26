from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ...db import get_db
from ...config import settings
from ...models import BuyerProfile, SellerProfile, User
from ...schemas import (
    AuthResponse,
    AuthUserOut,
    CsrfOut,
    LoginRequest,
    RegisterRequest,
    SessionOut,
)
from ...services.accounts import category_demand, create_account_household
from ...services.security import (
    PUBLIC_ROLES,
    ROLE_SELLER,
    clear_auth_cookies,
    create_session,
    generate_token,
    hash_password,
    login_limiter,
    normalize_email,
    registration_limiter,
    resolve_session,
    revoke_session,
    set_csrf_cookie,
    set_session_cookies,
    token_digest,
    verify_dummy_password,
    verify_password,
)
from ...utils import iso

router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_user(user: User) -> dict:  # type: ignore[type-arg]
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "status": user.status,
        "created_at": iso(user.created_at),
    }


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _csrf_token(request: Request, response: Response, db: Session) -> str:
    token = request.cookies.get(settings.csrf_cookie_name)
    pair = resolve_session(db, request)
    if pair is not None:
        session, _user = pair
        if (
            not token
            or len(token) < 24
            or not secrets.compare_digest(session.csrf_hash, token_digest(token))
        ):
            token = generate_token()
            set_csrf_cookie(response, token)
            session.csrf_hash = token_digest(token)
            db.commit()
        return token
    if not token or len(token) < 24:
        token = generate_token()
        set_csrf_cookie(response, token)
    return token


@router.get("/csrf", response_model=CsrfOut)
def csrf(request: Request, response: Response, db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    return {"csrf_token": _csrf_token(request, response, db)}


@router.get("/session", response_model=SessionOut)
def session(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
) -> dict:  # type: ignore[type-arg]
    token = _csrf_token(request, response, db)
    pair = resolve_session(db, request)
    return {"user": _auth_user(pair[1]) if pair else None, "csrf_token": token}


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
) -> dict:  # type: ignore[type-arg]
    ip = _client_ip(request)
    retry = registration_limiter.retry_after(
        f"register:{ip}",
        limit=settings.registration_rate_limit_attempts,
        window_seconds=settings.registration_rate_limit_window_seconds,
    )
    if retry:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many registration attempts. Try again later.",
            headers={"Retry-After": str(retry)},
        )
    registration_limiter.record(
        f"register:{ip}", window_seconds=settings.registration_rate_limit_window_seconds
    )

    if payload.role not in PUBLIC_ROLES:
        # Pydantic already restricts this, retained as an explicit policy check.
        raise HTTPException(status_code=403, detail="Public registration cannot create this role.")
    email = normalize_email(payload.email)
    if db.scalar(select(User).where(User.email == email)) is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    display_name = (payload.display_name or payload.full_name).strip()[:80]
    category = payload.household_category
    demand_base = payload.demand_base_kw or category_demand(category)
    solar_capacity = payload.solar_capacity_kw or 0.0
    has_battery = payload.has_battery if payload.role == ROLE_SELLER else False
    battery_capacity = payload.battery_capacity_kwh or 0.0
    battery_value = (
        battery_capacity if has_battery and battery_capacity > 0 else (5.0 if has_battery else 0.0)
    )

    user = User(
        full_name=payload.full_name.strip()[:120],
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        status="active",
    )
    try:
        db.add(user)
        db.flush()
        household = create_account_household(
            db,
            user_id=user.id,
            role=payload.role,
            display_name=display_name,
            solar_capacity_kw=solar_capacity,
            has_battery=has_battery,
            battery_capacity_kwh=battery_capacity,
            demand_base_kw=demand_base,
        )
        if payload.role == ROLE_SELLER:
            db.add(
                SellerProfile(
                    user_id=user.id,
                    display_name=display_name,
                    location_name=payload.location_name.strip(),
                    latitude=payload.latitude,
                    longitude=payload.longitude,
                    solar_capacity_kw=solar_capacity,
                    has_battery=has_battery,
                    battery_capacity_kwh=battery_value,
                    household_category=category,
                    demand_base_kw=demand_base,
                    household_id=household.id,
                )
            )
        else:
            db.add(
                BuyerProfile(
                    user_id=user.id,
                    display_name=display_name,
                    location_name=payload.location_name.strip(),
                    latitude=payload.latitude,
                    longitude=payload.longitude,
                    household_category=category,
                    demand_base_kw=demand_base,
                    household_id=household.id,
                )
            )
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from exc

    _session, session_token, csrf_token = create_session(db, user, request)
    set_session_cookies(response, session_token, csrf_token)
    return {"user": _auth_user(user), "csrf_token": csrf_token}


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
) -> dict:  # type: ignore[type-arg]
    email = normalize_email(payload.email)
    ip = _client_ip(request)
    key = f"login:{ip}:{email}"
    retry = login_limiter.retry_after(
        key,
        limit=settings.login_rate_limit_attempts,
        window_seconds=settings.login_rate_limit_window_seconds,
    )
    if retry:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many sign-in attempts. Try again later.",
            headers={"Retry-After": str(retry)},
        )
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        verify_dummy_password(payload.password)
        login_limiter.record(key, window_seconds=settings.login_rate_limit_window_seconds)
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if user.status != "active" or not verify_password(payload.password, user.password_hash):
        login_limiter.record(key, window_seconds=settings.login_rate_limit_window_seconds)
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    login_limiter.clear(key)
    _session, session_token, csrf_token = create_session(db, user, request)
    set_session_cookies(response, session_token, csrf_token)
    return {"user": _auth_user(user), "csrf_token": csrf_token}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    pair = resolve_session(db, request)
    if pair is not None:
        revoke_session(db, pair[0])
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_auth_cookies(response)
    return response
