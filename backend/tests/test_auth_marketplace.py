from __future__ import annotations

import threading
from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import Session, sessionmaker

from app.models import (
    BuyerProfile,
    EnergyOffer,
    Household,
    PurchaseOrder,
    Transaction,
    User,
    UserSession,
)
from app.services.marketplace import MarketError, purchase_offer
from app.services.security import hash_password
from app.utils import utcnow
from tests.auth_helpers import create_user, csrf, login, register


def _user(db: Session, email: str) -> User:
    user = db.scalar(select(User).where(User.email == email))
    assert user is not None
    return user


def _seller_offer(db: Session, seller_email: str, quantity: float = 2.0, price: float = 5.5) -> EnergyOffer:
    seller = _user(db, seller_email)
    from app.models import SellerProfile

    profile = db.get(SellerProfile, seller.id)
    assert profile is not None
    offer = EnergyOffer(
        seller_user_id=seller.id,
        seller_household_id=profile.household_id,
        quantity_kwh=quantity,
        remaining_kwh=quantity,
        price_inr_kwh=price,
        status="active",
        note="Test offer",
    )
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return offer


def test_registration_hashes_password_and_never_returns_it(client, db) -> None:
    body = register(
        client,
        email="  Seller@Example.COM ",
        password="StrongPass123!",
        role="seller",
        full_name="Seller One",
    )
    assert body["user"]["email"] == "seller@example.com"
    assert "password" not in body["user"]
    stored = db.scalar(select(User).where(User.email == "seller@example.com"))
    assert stored is not None
    assert stored.password_hash.startswith("$argon2id$")
    assert "StrongPass123!" not in stored.password_hash


def test_registration_rejects_admin_role_and_duplicate_normalized_email(client) -> None:
    csrf(client)
    admin_attempt = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Fake Admin",
            "email": "fake-admin@example.com",
            "password": "StrongPass123!",
            "confirm_password": "StrongPass123!",
            "role": "admin",
            "terms_accepted": True,
        },
    )
    assert admin_attempt.status_code == 422

    register(
        client,
        email="buyer@example.com",
        password="StrongPass123!",
        role="buyer",
        full_name="Buyer One",
    )
    duplicate = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Buyer Two",
            "email": " BUYER@example.com ",
            "password": "StrongPass123!",
            "confirm_password": "StrongPass123!",
            "role": "buyer",
            "terms_accepted": True,
        },
    )
    assert duplicate.status_code == 409


def test_csrf_is_required_for_state_changing_requests(client) -> None:
    csrf(client)
    client.headers.pop("X-CSRF-Token", None)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "StrongPass123!"},
    )
    assert response.status_code == 403


def test_login_is_generic_and_logout_invalidates_session(client, db) -> None:
    register(
        client,
        email="seller@example.com",
        password="StrongPass123!",
        role="seller",
        full_name="Seller One",
    )

    client.get("/api/v1/auth/csrf")
    client.headers["X-CSRF-Token"] = client.get("/api/v1/auth/csrf").json()["csrf_token"]
    wrong_password = client.post(
        "/api/v1/auth/login",
        json={"email": "seller@example.com", "password": "WrongPass123!"},
    )
    unknown_email = client.post(
        "/api/v1/auth/login",
        json={"email": "missing@example.com", "password": "WrongPass123!"},
    )
    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json()["detail"] == unknown_email.json()["detail"]

    session = client.get("/api/v1/auth/session")
    assert session.status_code == 200
    assert session.json()["user"]["role"] == "seller"

    logout = client.post("/api/v1/auth/logout")
    assert logout.status_code == 204
    restored = client.get("/api/v1/auth/session")
    assert restored.status_code == 200
    assert restored.json()["user"] is None
    denied = client.get("/api/v1/seller/profile")
    assert denied.status_code == 401

    sessions = db.scalars(select(UserSession)).all()
    assert all(row.revoked_at is not None for row in sessions)


def test_expired_session_is_rejected(client, db) -> None:
    register(
        client,
        email="seller@example.com",
        password="StrongPass123!",
        role="seller",
        full_name="Seller One",
    )
    user = _user(db, "seller@example.com")
    for row in db.scalars(select(UserSession).where(UserSession.user_id == user.id)).all():
        row.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    response = client.get("/api/v1/seller/profile")
    assert response.status_code == 401


def test_role_guards_and_admin_only_operational_routes(
    client, seller_client, buyer_client, admin_client
) -> None:
    assert client.get("/api/v1/seller/dashboard").status_code == 401
    assert buyer_client.get("/api/v1/seller/offers").status_code == 403
    assert seller_client.get("/api/v1/buyer/purchases").status_code == 403
    assert seller_client.get("/api/v1/households").status_code == 403
    assert seller_client.get("/api/v1/optimization/latest").status_code == 403
    assert seller_client.get("/api/v1/settings").status_code == 403
    assert seller_client.get("/api/v1/metrics/summary").status_code == 403
    assert admin_client.get("/api/v1/households").status_code == 200
    assert buyer_client.get("/api/v1/metrics/summary").status_code == 403
    assert buyer_client.get("/api/v1/pricing/current").status_code == 200


def test_anonymous_operational_and_shared_routes_require_authentication(client) -> None:
    assert client.get("/api/v1/households").status_code == 401
    assert client.get("/api/v1/simulation/state").status_code == 401
    assert client.get("/api/v1/weather/current").status_code == 401
    assert client.get("/api/v1/market/offers").status_code == 401


def test_seller_offer_lifecycle_and_ownership(
    seller_client, buyer_client, client_factory, db, monkeypatch
) -> None:
    from app.api.routes import seller as seller_routes

    async def fake_surplus(_db, _household, *, exclude_offer_id=None):  # type: ignore[no-untyped-def]
        return {
            "available_to_offer_kwh": 10.0,
            "daily_surplus_kwh": 12.0,
            "reserved_offer_kwh": 0.0,
            "forecast_freshness": "live",
            "has_forecast": True,
        }

    monkeypatch.setattr(seller_routes, "seller_surplus", fake_surplus)

    created = seller_client.post(
        "/api/v1/seller/offers",
        json={"quantity_kwh": 2.5, "price_inr_kwh": 5.25, "note": "Roof surplus"},
    )
    assert created.status_code == 201, created.text
    offer = created.json()
    assert offer["status"] == "active"
    assert offer["remaining_kwh"] == 2.5
    assert offer["estimated_total_inr"] == 13.12
    assert "email" not in offer

    too_large = seller_client.post(
        "/api/v1/seller/offers",
        json={"quantity_kwh": 11.0, "price_inr_kwh": 5.25},
    )
    assert too_large.status_code == 400

    paused = seller_client.post(f"/api/v1/seller/offers/{offer['id']}/pause")
    assert paused.status_code == 200 and paused.json()["status"] == "paused"
    resumed = seller_client.post(f"/api/v1/seller/offers/{offer['id']}/resume")
    assert resumed.status_code == 200 and resumed.json()["status"] == "active"
    edited = seller_client.patch(
        f"/api/v1/seller/offers/{offer['id']}",
        json={"price_inr_kwh": 6.0, "note": "Adjusted"},
    )
    assert edited.status_code == 200 and edited.json()["price_inr_kwh"] == 6.0

    other = client_factory()
    register(
        other,
        email="other-seller@example.com",
        password="SellerPass123!",
        role="seller",
        full_name="Other Seller",
        solar_capacity_kw=2.0,
    )
    forbidden = other.patch(f"/api/v1/seller/offers/{offer['id']}", json={"price_inr_kwh": 1.0})
    assert forbidden.status_code == 404
    assert other.post(f"/api/v1/seller/offers/{offer['id']}/cancel").status_code == 404

    cancelled = seller_client.post(f"/api/v1/seller/offers/{offer['id']}/cancel")
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "cancelled"


def test_buyer_purchase_uses_authoritative_price_and_records_ledger(
    seller_client, buyer_client, db
) -> None:
    offer = _seller_offer(db, "seller@example.com", quantity=2.0, price=5.5)
    response = buyer_client.post(
        "/api/v1/buyer/purchases",
        json={"offer_id": offer.id, "quantity_kwh": 0.75, "price_inr_kwh": 0.01},
    )
    assert response.status_code == 201, response.text
    purchase = response.json()
    assert purchase["price_inr_kwh"] == 5.5
    assert purchase["total_value_inr"] == pytest.approx(4.13, abs=0.01)
    assert purchase["transaction_id"] is not None

    db.expire_all()
    order = db.get(PurchaseOrder, purchase["id"])
    assert order is not None
    transaction = db.get(Transaction, order.transaction_id)
    assert transaction is not None
    assert transaction.source == "marketplace"
    refreshed = db.get(EnergyOffer, offer.id)
    assert refreshed is not None
    assert refreshed.remaining_kwh == pytest.approx(1.25)

    purchases = buyer_client.get("/api/v1/buyer/purchases")
    assert purchases.status_code == 200
    assert purchases.json()["count"] == 1
    sales = seller_client.get("/api/v1/seller/sales")
    assert sales.status_code == 200
    assert sales.json()["items"][0]["buyer_display_name"] == "Buyer Account"


def test_purchase_rejects_over_remaining_and_inactive_offer(
    seller_client, buyer_client, db
) -> None:
    offer = _seller_offer(db, "seller@example.com", quantity=1.0, price=5.0)
    too_much = buyer_client.post(
        "/api/v1/buyer/purchases",
        json={"offer_id": offer.id, "quantity_kwh": 1.5},
    )
    assert too_much.status_code == 409
    assert db.scalar(select(func.count()).select_from(PurchaseOrder)) == 0

    offer.status = "paused"
    db.commit()
    paused = buyer_client.post(
        "/api/v1/buyer/purchases",
        json={"offer_id": offer.id, "quantity_kwh": 0.2},
    )
    assert paused.status_code == 409


def test_cross_account_buyer_and_seller_data_isolation(
    seller_client, buyer_client, client_factory, db
) -> None:
    offer = _seller_offer(db, "seller@example.com", quantity=3.0, price=5.0)
    first = buyer_client.post(
        "/api/v1/buyer/purchases", json={"offer_id": offer.id, "quantity_kwh": 1.0}
    )
    assert first.status_code == 201, first.text

    second = client_factory()
    register(
        second,
        email="buyer-two@example.com",
        password="BuyerPass123!",
        role="buyer",
        full_name="Buyer Two",
    )
    second_purchase = second.post(
        "/api/v1/buyer/purchases", json={"offer_id": offer.id, "quantity_kwh": 0.5}
    )
    assert second_purchase.status_code == 201, second_purchase.text

    first_purchases = buyer_client.get("/api/v1/buyer/purchases").json()["items"]
    second_purchases = second.get("/api/v1/buyer/purchases").json()["items"]
    assert len(first_purchases) == 1
    assert len(second_purchases) == 1
    assert first_purchases[0]["id"] != second_purchases[0]["id"]
    assert first_purchases[0]["buyer_display_name"] == "You"
    assert second_purchases[0]["buyer_display_name"] == "You"

    market = buyer_client.get("/api/v1/market/offers")
    assert market.status_code == 200
    serialized = str(market.json())
    assert "buyer@example.com" not in serialized
    assert "buyer-two@example.com" not in serialized


def test_buyer_cannot_use_seller_offer_routes(buyer_client) -> None:
    assert buyer_client.post(
        "/api/v1/seller/offers", json={"quantity_kwh": 1.0, "price_inr_kwh": 5.0}
    ).status_code == 403
    assert buyer_client.get("/api/v1/seller/sales").status_code == 403


def test_buyer_profile_update_and_private_settings(buyer_client, db) -> None:
    response = buyer_client.patch(
        "/api/v1/buyer/profile",
        json={"display_name": "Updated Buyer", "demand_base_kw": 1.4},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["display_name"] == "Updated Buyer"
    assert body["demand_base_kw"] == 1.4
    user = _user(db, "buyer@example.com")
    profile = db.get(BuyerProfile, user.id)
    assert profile is not None
    household = db.get(Household, profile.household_id)
    assert household is not None
    assert household.name == "Updated Buyer"


def _build_concurrency_db(path: Path):
    engine = create_engine(
        f"sqlite:///{path.as_posix()}",
        connect_args={"check_same_thread": False, "timeout": 30},
    )

    @event.listens_for(engine, "connect")
    def _pragmas(connection, _record):  # type: ignore[no-untyped-def]
        cursor = connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    from app.db import Base

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    with factory() as db:
        seller = User(
            full_name="Concurrent Seller",
            email="concurrent-seller@example.com",
            password_hash=hash_password("ConcurrentPass123!"),
            role="seller",
            status="active",
        )
        buyer = User(
            full_name="Concurrent Buyer",
            email="concurrent-buyer@example.com",
            password_hash=hash_password("ConcurrentPass123!"),
            role="buyer",
            status="active",
        )
        db.add_all([seller, buyer])
        db.flush()
        seller_house = Household(
            id="C-SELL",
            name="Concurrent Seller",
            role_hint="seller",
            solar_capacity_kw=4.0,
            demand_base_kw=0.5,
            owner_user_id=seller.id,
        )
        buyer_house = Household(
            id="C-BUY",
            name="Concurrent Buyer",
            role_hint="buyer",
            solar_capacity_kw=0.0,
            demand_base_kw=0.8,
            owner_user_id=buyer.id,
        )
        db.add_all([seller_house, buyer_house])
        db.flush()
        db.add(
            BuyerProfile(
                user_id=buyer.id,
                display_name="Concurrent Buyer",
                location_name="Perur",
                latitude=10.976,
                longitude=76.914,
                household_category="residential",
                demand_base_kw=0.8,
                household_id=buyer_house.id,
            )
        )
        offer = EnergyOffer(
            seller_user_id=seller.id,
            seller_household_id=seller_house.id,
            quantity_kwh=1.0,
            remaining_kwh=1.0,
            price_inr_kwh=5.0,
            status="active",
        )
        db.add(offer)
        db.commit()
        ids = {
            "offer": offer.id,
            "buyer": buyer.id,
            "buyer_house": buyer_house.id,
        }
    return engine, factory, ids


def test_concurrent_purchases_cannot_oversell(tmp_path) -> None:
    engine, factory, ids = _build_concurrency_db(tmp_path / "concurrency.db")
    barrier = threading.Barrier(2)
    results: list[Any] = []
    lock = threading.Lock()

    def attempt() -> None:
        with factory() as db:
            buyer = db.get(User, ids["buyer"])
            household = db.get(Household, ids["buyer_house"])
            assert buyer is not None and household is not None
            barrier.wait(timeout=5)
            try:
                order = purchase_offer(
                    db,
                    buyer=buyer,
                    buyer_profile=db.get(BuyerProfile, buyer.id),
                    buyer_household=household,
                    offer_id=ids["offer"],
                    quantity_kwh=0.8,
                )
                with lock:
                    results.append(order.id)
            except MarketError as exc:
                db.rollback()
                with lock:
                    results.append(exc.status_code)
            except Exception as exc:  # pragma: no cover - surfaced for diagnostics
                db.rollback()
                with lock:
                    results.append(type(exc).__name__)

    threads = [threading.Thread(target=attempt) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)
    engine.dispose()

    with factory() as db:
        offer = db.get(EnergyOffer, ids["offer"])
        assert offer is not None
        assert offer.remaining_kwh >= 0
        assert offer.remaining_kwh == pytest.approx(0.2, abs=0.0001)
        orders = db.scalar(select(func.count()).select_from(PurchaseOrder)) or 0
        assert orders == 1
    assert 409 in results
    assert sum(1 for result in results if isinstance(result, int) and result != 409) == 1
