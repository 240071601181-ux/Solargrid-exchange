from __future__ import annotations

from fastapi import Response

from tests.auth_helpers import create_user, csrf, login, register

LOGIN_PAYLOAD = {"email": "nobody@example.com", "password": "WrongPass123!"}


def _cookie_values(response: Response) -> list[str]:
    return response.headers.get_list("set-cookie")


def _set_cookie_for(cookies: list[str], name: str) -> str:
    prefix = f"{name}="
    for value in cookies:
        if value.startswith(prefix):
            return value
    raise AssertionError(f"{name} cookie was not set: {cookies}")


def test_valid_csrf_reaches_login_credential_validation(client) -> None:
    csrf(client)
    response = client.post("/api/v1/auth/login", json=LOGIN_PAYLOAD)
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_valid_csrf_allows_registration(client, db) -> None:
    body = register(
        client,
        email="csrf-register@example.com",
        password="StrongPass123!",
        role="buyer",
        full_name="CSRF Buyer",
    )
    assert body["user"]["email"] == "csrf-register@example.com"
    assert body["user"]["role"] == "buyer"
    assert body["csrf_token"]


def test_missing_header_is_rejected(client) -> None:
    csrf(client)
    client.headers.pop("X-CSRF-Token", None)
    response = client.post("/api/v1/auth/login", json=LOGIN_PAYLOAD)
    assert response.status_code == 403
    assert response.json()["detail"] == "CSRF validation failed."


def test_missing_cookie_is_rejected(client, client_factory) -> None:
    token = csrf(client_factory())
    client.headers["X-CSRF-Token"] = token
    response = client.post("/api/v1/auth/login", json=LOGIN_PAYLOAD)
    assert response.status_code == 403
    assert response.json()["detail"] == "CSRF validation failed."


def test_invalid_header_is_rejected(client) -> None:
    csrf(client)
    client.headers["X-CSRF-Token"] = "not-the-cookie-token-value"
    response = client.post("/api/v1/auth/login", json=LOGIN_PAYLOAD)
    assert response.status_code == 403
    assert response.json()["detail"] == "CSRF validation failed."


def test_token_from_another_session_is_rejected_and_can_be_rotated(
    client_factory, db
) -> None:
    create_user(db, "csrf-session@example.com", "StrongPass123!", "seller", "CSRF Seller")
    first = client_factory()
    second = client_factory()
    login(first, "csrf-session@example.com", "StrongPass123!")
    login(second, "csrf-session@example.com", "StrongPass123!")

    unrelated = second.cookies.get("sg_csrf")
    assert unrelated is not None
    first.cookies.set("sg_csrf", unrelated)
    first.headers["X-CSRF-Token"] = unrelated

    rejected = first.post("/api/v1/auth/logout")
    assert rejected.status_code == 403
    assert rejected.json()["detail"] == "CSRF validation failed."

    repaired = first.get("/api/v1/auth/csrf")
    assert repaired.status_code == 200
    rotated = repaired.json()["csrf_token"]
    assert rotated != unrelated
    first.headers["X-CSRF-Token"] = rotated
    first.cookies.set("sg_csrf", rotated)

    assert first.post("/api/v1/auth/logout").status_code == 204


def test_auth_cookies_keep_security_attributes(client, db) -> None:
    create_user(db, "csrf-cookie@example.com", "StrongPass123!", "buyer", "Cookie Buyer")
    csrf(client)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "csrf-cookie@example.com", "password": "StrongPass123!"},
    )
    assert response.status_code == 200, response.text

    cookies = _cookie_values(response)
    session_cookie = _set_cookie_for(cookies, "sg_session")
    csrf_cookie = _set_cookie_for(cookies, "sg_csrf")
    session_lower = session_cookie.lower()
    csrf_lower = csrf_cookie.lower()

    assert "httponly" in session_lower
    assert "samesite=lax" in session_lower
    assert "path=/" in session_lower
    assert "max-age=" in session_lower
    assert "httponly" not in csrf_lower
    assert "samesite=lax" in csrf_lower
    assert "path=/" in csrf_lower
    assert "max-age=" in csrf_lower


def test_cors_allows_configured_origins_only(client) -> None:
    allowed = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-csrf-token",
        },
    )
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert allowed.headers["access-control-allow-credentials"] == "true"

    denied = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert denied.status_code == 400
    assert "access-control-allow-origin" not in denied.headers
