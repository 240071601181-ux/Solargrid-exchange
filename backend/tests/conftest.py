from __future__ import annotations

import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app import models  # noqa: E402,F401  (register ORM tables)
from app.db import Base  # noqa: E402
from app.services.security import login_limiter, registration_limiter  # noqa: E402


@pytest.fixture(autouse=True)
def _clear_rate_limiters() -> None:
    login_limiter._events.clear()
    registration_limiter._events.clear()


@pytest.fixture()
def db() -> Session:
    """Isolated in-memory SQLite session with SQLite foreign keys enabled."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(connection, _record):  # type: ignore[no-untyped-def]
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    session = factory()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        engine.dispose()


@pytest.fixture()
def client_factory(db: Session):
    from fastapi.testclient import TestClient

    from app.db import get_db
    from app.main import app

    def override_get_db():  # type: ignore[no-untyped-def]
        yield db

    app.dependency_overrides[get_db] = override_get_db
    clients: list[TestClient] = []

    def make() -> TestClient:
        test_client = TestClient(app)
        clients.append(test_client)
        return test_client

    try:
        yield make
    finally:
        for test_client in clients:
            test_client.close()
        app.dependency_overrides.clear()


@pytest.fixture()
def client(client_factory):
    return client_factory()


@pytest.fixture()
def admin_client(client_factory, db: Session):
    from tests.auth_helpers import create_user, login

    test_client = client_factory()
    create_user(db, "admin@example.com", "AdminPass123!", "admin", "Grid Operator")
    login(test_client, "admin@example.com", "AdminPass123!")
    return test_client


@pytest.fixture()
def seller_client(client_factory, db: Session):
    from tests.auth_helpers import register

    test_client = client_factory()
    register(
        test_client,
        email="seller@example.com",
        password="SellerPass123!",
        role="seller",
        full_name="Seller Account",
        solar_capacity_kw=4.0,
    )
    return test_client


@pytest.fixture()
def buyer_client(client_factory, db: Session):
    from tests.auth_helpers import register

    test_client = client_factory()
    register(
        test_client,
        email="buyer@example.com",
        password="BuyerPass123!",
        role="buyer",
        full_name="Buyer Account",
    )
    return test_client
