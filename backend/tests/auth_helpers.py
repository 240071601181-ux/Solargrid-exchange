from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import User
from app.services.security import hash_password


def csrf(client: TestClient) -> str:
    response = client.get("/api/v1/auth/csrf")
    assert response.status_code == 200, response.text
    token = response.json()["csrf_token"]
    client.headers["X-CSRF-Token"] = token
    return token


def create_user(
    db: Session,
    email: str,
    password: str,
    role: str,
    full_name: str = "Test User",
) -> User:
    user = User(
        full_name=full_name,
        email=email.lower(),
        password_hash=hash_password(password),
        role=role,
        status="active",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login(client: TestClient, email: str, password: str) -> dict[str, Any]:
    csrf(client)
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    body = response.json()
    client.headers["X-CSRF-Token"] = body["csrf_token"]
    return body


def register(
    client: TestClient,
    *,
    email: str,
    password: str,
    role: str,
    full_name: str,
    display_name: str | None = None,
    solar_capacity_kw: float | None = None,
    has_battery: bool = False,
    terms_accepted: bool = True,
) -> dict[str, Any]:
    csrf(client)
    payload: dict[str, Any] = {
        "full_name": full_name,
        "email": email,
        "password": password,
        "confirm_password": password,
        "role": role,
        "display_name": display_name or full_name,
        "location_name": "Perur, Coimbatore",
        "latitude": 10.976,
        "longitude": 76.914,
        "solar_capacity_kw": solar_capacity_kw,
        "has_battery": has_battery,
        "battery_capacity_kwh": 5.0 if has_battery else 0.0,
        "household_category": "residential",
        "demand_base_kw": 0.8,
        "terms_accepted": terms_accepted,
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    client.headers["X-CSRF-Token"] = body["csrf_token"]
    return body
