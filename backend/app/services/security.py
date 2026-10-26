"""Password hashing, opaque server-side sessions and role dependencies."""

from __future__ import annotations

import hashlib
import logging
import re
import secrets
import threading
import time
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Annotated, Callable

from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import User, UserSession
from ..utils import as_utc, utcnow

ROLE_ADMIN = "admin"
ROLE_SELLER = "seller"
ROLE_BUYER = "buyer"
PUBLIC_ROLES = {ROLE_SELLER, ROLE_BUYER}

_UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_LOG = logging.getLogger("solargrid.csrf")

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
_PASSWORD_MIN = 10
_PASSWORD_MAX = 128
_PASSWORD_LETTER = re.compile(r"[A-Za-z]")
_PASSWORD_DIGIT = re.compile(r"\d")

# Argon2id with deliberately conservative, documented parameters. The dummy hash is
# used for nonexistent emails so invalid-login timing does not reveal account existence.
_password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)
_DUMMY_HASH = _password_hasher.hash("solar-grid-dummy-password-42")


def normalize_email(value: str) -> str:
    return value.strip().lower()


def valid_email(value: str) -> bool:
    return len(value) <= 320 and bool(_EMAIL_RE.match(value))


def validate_password_policy(password: str) -> None:
    if len(password) < _PASSWORD_MIN:
        raise ValueError(f"Password must be at least {_PASSWORD_MIN} characters.")
    if len(password) > _PASSWORD_MAX:
        raise ValueError(f"Password must be at most {_PASSWORD_MAX} characters.")
    if not _PASSWORD_LETTER.search(password) or not _PASSWORD_DIGIT.search(password):
        raise ValueError("Password must include at least one letter and one number.")


def hash_password(password: str) -> str:
    validate_password_policy(password)
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def verify_dummy_password(password: str) -> None:
    try:
        _password_hasher.verify(_DUMMY_HASH, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        pass


def password_needs_rehash(password_hash: str) -> bool:
    try:
        return _password_hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


def _token_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def token_digest(value: str) -> str:
    return _token_hash(value)


def generate_token() -> str:
    return secrets.token_urlsafe(48)


def create_session(
    db: Session,
    user: User,
    request: Request,
) -> tuple[UserSession, str, str]:
    token = generate_token()
    csrf = generate_token()
    session = UserSession(
        user_id=user.id,
        token_hash=_token_hash(token),
        csrf_hash=_token_hash(csrf),
        expires_at=utcnow() + timedelta(hours=max(1, settings.session_ttl_hours)),
        user_agent=(request.headers.get("user-agent") or "")[:255] or None,
        ip_address=(request.client.host if request.client else None),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session, token, csrf


def revoke_session(db: Session, session: UserSession) -> None:
    session.revoked_at = utcnow()
    db.commit()


def session_token_from_request(request: Request) -> str | None:
    return request.cookies.get(settings.session_cookie_name)


def resolve_session(db: Session, request: Request) -> tuple[UserSession, User] | None:
    cached = getattr(request.state, "auth_pair", None)
    if cached is not None:
        return cached
    token = session_token_from_request(request)
    if not token:
        return None
    record = db.scalar(select(UserSession).where(UserSession.token_hash == _token_hash(token)))
    if record is None or record.revoked_at is not None:
        return None
    expires = as_utc(record.expires_at)
    if expires is None or expires <= datetime.now(timezone.utc):
        return None
    user = db.get(User, record.user_id)
    if user is None or user.status != "active":
        return None
    last_seen = as_utc(record.last_seen_at)
    if last_seen is None or (utcnow() - last_seen).total_seconds() > 300:
        record.last_seen_at = utcnow()
        db.commit()
    request.state.auth_pair = (record, user)
    return record, user


def log_csrf_rejection(
    request: Request,
    reason: str,
    *,
    has_session: bool | None = None,
) -> None:
    """Log why CSRF was rejected without logging cookie or header values."""
    session_state = "unknown" if has_session is None else ("yes" if has_session else "no")
    level = (
        logging.WARNING
        if settings.environment.lower() in {"development", "dev", "local"}
        else logging.INFO
    )
    _LOG.log(
        level,
        "CSRF rejected (%s) method=%s path=%s origin=%s host=%s header=%s cookie=%s session=%s",
        reason,
        request.method,
        request.url.path,
        request.headers.get("origin", "<none>"),
        request.headers.get("host", "<none>"),
        "present" if request.headers.get("x-csrf-token") else "missing",
        "present" if request.cookies.get(settings.csrf_cookie_name) else "missing",
        session_state,
    )


def enforce_csrf(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> None:
    """Enforce double-submit CSRF and bind tokens to authenticated sessions.

    Anonymous login and registration requests still use the double-submit
    check. Once a session exists, its stored digest must match the submitted
    token; a token minted for a different session is rejected.
    """
    if request.method not in _UNSAFE_METHODS:
        return

    header = request.headers.get("x-csrf-token")
    cookie = request.cookies.get(settings.csrf_cookie_name)
    if not header or not cookie or not secrets.compare_digest(header, cookie):
        log_csrf_rejection(request, "missing or mismatched double-submit token")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation failed.",
        )

    pair = resolve_session(db, request)
    if pair is None:
        return
    if not secrets.compare_digest(pair[0].csrf_hash, token_digest(cookie)):
        log_csrf_rejection(
            request,
            "token is not bound to the active session",
            has_session=True,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation failed.",
        )


def get_current_user(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> User:
    pair = resolve_session(db, request)
    if pair is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Session"},
        )
    return pair[1]


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: str) -> Callable[..., User]:
    def dependency(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource.",
            )
        return user

    return dependency


require_admin = require_roles(ROLE_ADMIN)
require_seller = require_roles(ROLE_SELLER)
require_buyer = require_roles(ROLE_BUYER)
require_authenticated = require_roles(ROLE_ADMIN, ROLE_SELLER, ROLE_BUYER)

AdminUser = Annotated[User, Depends(require_admin)]
SellerUser = Annotated[User, Depends(require_seller)]
BuyerUser = Annotated[User, Depends(require_buyer)]
AnyUser = Annotated[User, Depends(require_authenticated)]


def set_session_cookies(response: Response, token: str, csrf: str) -> None:
    max_age = max(1, settings.session_ttl_hours) * 3600
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        path="/",
    )
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf,
        max_age=max_age,
        httponly=False,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        path="/",
    )


def set_csrf_cookie(response: Response, csrf: str, max_age: int = 86400) -> None:
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf,
        max_age=max_age,
        httponly=False,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
    )
    response.delete_cookie(
        key=settings.csrf_cookie_name,
        path="/",
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
    )


def ensure_bootstrap_admin(db: Session) -> User | None:
    """Create the operator account only when both bootstrap env values are present.

    This never promotes an existing account. Use ``python -m app.admin_cli`` for
    explicit operator provisioning in an existing deployment.
    """
    email = settings.bootstrap_admin_email
    password = settings.bootstrap_admin_password
    if not email or not password:
        return None
    normalized = normalize_email(email)
    if not valid_email(normalized):
        raise RuntimeError("BOOTSTRAP_ADMIN_EMAIL is not a valid email address.")
    validate_password_policy(password)
    existing = db.scalar(select(User).where(User.email == normalized))
    if existing is not None:
        return existing if existing.role == ROLE_ADMIN else None
    admin = User(
        full_name=settings.bootstrap_admin_name.strip() or "SolarGrid Operator",
        email=normalized,
        password_hash=hash_password(password),
        role=ROLE_ADMIN,
        status="active",
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


class AttemptLimiter:
    """Small in-process sliding-window limiter suitable for a single API worker."""

    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _prune(self, key: str, window_seconds: int) -> deque[float]:
        now = time.monotonic()
        queue = self._events.setdefault(key, deque())
        cutoff = now - max(1, window_seconds)
        while queue and queue[0] < cutoff:
            queue.popleft()
        return queue

    def retry_after(self, key: str, *, limit: int, window_seconds: int) -> int:
        with self._lock:
            queue = self._prune(key, window_seconds)
            if len(queue) < limit:
                return 0
            return max(1, int(window_seconds - (time.monotonic() - queue[0])))

    def record(self, key: str, *, window_seconds: int) -> None:
        with self._lock:
            queue = self._prune(key, window_seconds)
            queue.append(time.monotonic())

    def clear(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)


login_limiter = AttemptLimiter()
registration_limiter = AttemptLimiter()
