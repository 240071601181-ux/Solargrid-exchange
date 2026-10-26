"""Account-to-account offer and purchase domain logic."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import case, desc, func, or_, select, update
from sqlalchemy.orm import Session

from ..models import (
    AllocationItem,
    AllocationRun,
    AppSetting,
    BuyerProfile,
    EnergyOffer,
    Household,
    PurchaseOrder,
    SellerProfile,
    SimulationState,
    Transaction,
    User,
)
from ..schemas import OfferCreate, OfferUpdate
from ..utils import iso, utcnow
from .accounts import reserved_offer_kwh
from .security import ROLE_BUYER, ROLE_SELLER

EPSILON = 1e-9


class MarketError(Exception):
    def __init__(self, message: str, status_code: int = 409) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def offer_status_label(status: str) -> str:
    return status


def offer_payload(
    offer: EnergyOffer,
    seller_profile: SellerProfile | None,
    *,
    include_note: bool = True,
) -> dict[str, Any]:
    sold = max(0.0, round(offer.quantity_kwh - offer.remaining_kwh, 4))
    return {
        "id": offer.id,
        "seller_user_id": offer.seller_user_id,
        "seller_display_name": seller_profile.display_name if seller_profile else "Solar seller",
        "location_name": seller_profile.location_name if seller_profile else "Perur microgrid",
        "quantity_kwh": round(offer.quantity_kwh, 4),
        "remaining_kwh": round(offer.remaining_kwh, 4),
        "sold_kwh": sold,
        "price_inr_kwh": round(offer.price_inr_kwh, 2),
        "estimated_total_inr": round(offer.remaining_kwh * offer.price_inr_kwh, 2),
        "status": offer.status,
        "note": offer.note if include_note else "",
        "created_at": iso(offer.created_at),
        "updated_at": iso(offer.updated_at),
    }


def purchase_payload(
    purchase: PurchaseOrder,
    *,
    buyer_name: str,
    seller_name: str,
    offer_status: str | None = None,
) -> dict[str, Any]:
    return {
        "id": purchase.id,
        "offer_id": purchase.offer_id,
        "buyer_user_id": purchase.buyer_user_id,
        "seller_user_id": purchase.seller_user_id,
        "buyer_display_name": buyer_name,
        "seller_display_name": seller_name,
        "quantity_kwh": round(purchase.quantity_kwh, 4),
        "price_inr_kwh": round(purchase.price_inr_kwh, 2),
        "total_value_inr": round(purchase.total_value_inr, 2),
        "status": purchase.status,
        "offer_status": offer_status,
        "transaction_id": purchase.transaction_id,
        "created_at": iso(purchase.created_at),
    }


def seller_profile_map(db: Session, seller_ids: set[int]) -> dict[int, SellerProfile]:
    if not seller_ids:
        return {}
    rows = db.scalars(select(SellerProfile).where(SellerProfile.user_id.in_(seller_ids))).all()
    return {row.user_id: row for row in rows}


def buyer_profile_map(db: Session, buyer_ids: set[int]) -> dict[int, BuyerProfile]:
    if not buyer_ids:
        return {}
    rows = db.scalars(select(BuyerProfile).where(BuyerProfile.user_id.in_(buyer_ids))).all()
    return {row.user_id: row for row in rows}


def marketplace_offers(
    db: Session,
    *,
    q: str | None = None,
    max_price: float | None = None,
    min_quantity: float | None = None,
    sort: str = "price_asc",
    limit: int = 60,
) -> list[dict[str, Any]]:
    stmt = (
        select(EnergyOffer, SellerProfile)
        .join(SellerProfile, SellerProfile.user_id == EnergyOffer.seller_user_id)
        .where(EnergyOffer.status == "active", EnergyOffer.remaining_kwh > EPSILON)
    )
    if max_price is not None:
        stmt = stmt.where(EnergyOffer.price_inr_kwh <= max_price)
    if min_quantity is not None:
        stmt = stmt.where(EnergyOffer.remaining_kwh >= min_quantity)
    if q and q.strip():
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                SellerProfile.display_name.ilike(term),
                SellerProfile.location_name.ilike(term),
                EnergyOffer.note.ilike(term),
            )
        )
    order = {
        "price_asc": EnergyOffer.price_inr_kwh.asc(),
        "price_desc": EnergyOffer.price_inr_kwh.desc(),
        "quantity_desc": EnergyOffer.remaining_kwh.desc(),
        "newest": EnergyOffer.created_at.desc(),
    }.get(sort, EnergyOffer.price_inr_kwh.asc())
    rows = db.execute(stmt.order_by(order, EnergyOffer.id.desc()).limit(max(1, min(limit, 100)))).all()
    return [offer_payload(offer, profile) for offer, profile in rows]


def get_active_offer(db: Session, offer_id: int) -> tuple[EnergyOffer, SellerProfile | None]:
    offer = db.get(EnergyOffer, offer_id)
    if offer is None:
        raise MarketError("Offer not found.", 404)
    return offer, db.get(SellerProfile, offer.seller_user_id)


def create_offer(
    db: Session,
    *,
    user: User,
    seller_profile: SellerProfile,
    household: Household,
    payload: OfferCreate,
    available_to_offer_kwh: float,
) -> EnergyOffer:
    if payload.quantity_kwh > available_to_offer_kwh + 0.0001:
        raise MarketError(
            f"Quantity exceeds available estimated surplus of {available_to_offer_kwh:.4f} kWh.",
            400,
        )
    offer = EnergyOffer(
        seller_user_id=user.id,
        seller_household_id=household.id,
        quantity_kwh=round(payload.quantity_kwh, 4),
        remaining_kwh=round(payload.quantity_kwh, 4),
        price_inr_kwh=round(payload.price_inr_kwh, 2),
        status="active",
        note=(payload.note or "").strip()[:280],
    )
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return offer


def _offer_or_error(db: Session, offer_id: int, seller_user_id: int) -> EnergyOffer:
    offer = db.get(EnergyOffer, offer_id)
    if offer is None or offer.seller_user_id != seller_user_id:
        raise MarketError("Offer not found.", 404)
    return offer


def update_offer(
    db: Session,
    *,
    offer_id: int,
    user: User,
    payload: OfferUpdate,
    available_to_offer_kwh: float,
) -> EnergyOffer:
    offer = _offer_or_error(db, offer_id, user.id)
    if offer.status not in {"active", "paused"}:
        raise MarketError("Only active or paused offers can be edited.", 409)
    sold = max(0.0, round(offer.quantity_kwh - offer.remaining_kwh, 4))
    if payload.quantity_kwh is not None:
        if payload.quantity_kwh + EPSILON < sold:
            raise MarketError(
                f"Quantity cannot be less than the {sold:.4f} kWh already sold.", 400
            )
        increase = max(0.0, payload.quantity_kwh - offer.quantity_kwh)
        if increase > available_to_offer_kwh + 0.0001:
            raise MarketError(
                f"Added quantity exceeds available estimated surplus of {available_to_offer_kwh:.4f} kWh.",
                400,
            )
        offer.quantity_kwh = round(payload.quantity_kwh, 4)
        offer.remaining_kwh = round(max(0.0, offer.quantity_kwh - sold), 4)
    if payload.price_inr_kwh is not None:
        offer.price_inr_kwh = round(payload.price_inr_kwh, 2)
    if payload.note is not None:
        offer.note = payload.note.strip()[:280]
    if offer.remaining_kwh <= EPSILON:
        offer.status = "exhausted"
    offer.updated_at = utcnow()
    db.commit()
    db.refresh(offer)
    return offer


def change_offer_status(
    db: Session, *, offer_id: int, user: User, action: str
) -> EnergyOffer:
    offer = _offer_or_error(db, offer_id, user.id)
    if action == "pause":
        if offer.status != "active":
            raise MarketError("Only active offers can be paused.", 409)
        offer.status = "paused"
    elif action == "resume":
        if offer.status != "paused":
            raise MarketError("Only paused offers can be resumed.", 409)
        if offer.remaining_kwh <= EPSILON:
            raise MarketError("This offer has no remaining energy.", 409)
        offer.status = "active"
    elif action == "cancel":
        if offer.status not in {"active", "paused"}:
            raise MarketError("Only active or paused offers can be cancelled.", 409)
        offer.status = "cancelled"
    else:
        raise MarketError("Unsupported offer action.", 400)
    offer.updated_at = utcnow()
    db.commit()
    db.refresh(offer)
    return offer


def purchase_offer(
    db: Session,
    *,
    buyer: User,
    buyer_profile: BuyerProfile,
    buyer_household: Household,
    offer_id: int,
    quantity_kwh: float,
) -> PurchaseOrder:
    if quantity_kwh < 0.001:
        raise MarketError("Quantity must be at least 0.001 kWh.", 400)
    offer = db.get(EnergyOffer, offer_id)
    if offer is None:
        raise MarketError("Offer not found.", 404)
    if offer.seller_user_id == buyer.id:
        raise MarketError("You cannot purchase your own offer.", 400)
    if offer.status != "active":
        raise MarketError("This offer is no longer active. Refresh the marketplace.", 409)
    if offer.remaining_kwh + EPSILON < quantity_kwh:
        raise MarketError("Requested quantity exceeds the remaining offer quantity.", 409)

    # Atomic conditional decrement. Two concurrent requests can both read the same
    # remaining quantity, but only one UPDATE can satisfy the WHERE clause.
    new_remaining = EnergyOffer.remaining_kwh - quantity_kwh
    result = db.execute(
        update(EnergyOffer)
        .where(
            EnergyOffer.id == offer_id,
            EnergyOffer.status == "active",
            EnergyOffer.remaining_kwh >= quantity_kwh - EPSILON,
        )
        .values(
            remaining_kwh=new_remaining,
            status=case((new_remaining <= EPSILON, "exhausted"), else_="active"),
            updated_at=utcnow(),
        )
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        raise MarketError("This offer changed before your purchase completed. Refresh and try again.", 409)

    price = float(offer.price_inr_kwh)
    total = round(quantity_kwh * price, 2)
    state = db.get(SimulationState, 1)
    run = AllocationRun(
        tick=state.tick if state else 0,
        status="executed",
        algorithm="direct_offer_purchase",
        objective_value=round(quantity_kwh, 4),
        execution_ms=0.0,
        total_supply_kw=round(quantity_kwh, 4),
        total_demand_kw=round(quantity_kwh, 4),
        allocated_kw=round(quantity_kwh, 4),
        unmet_kw=0.0,
        unallocated_kw=0.0,
        price_inr_kwh=price,
        interval_seconds=3600,
        notes="Direct marketplace purchase. Simulated energy transfer only; no financial settlement.",
        source="marketplace",
        executed_at=utcnow(),
    )
    db.add(run)
    db.flush()
    db.add(
        AllocationItem(
            run_id=run.id,
            seller_id=offer.seller_household_id,
            buyer_id=buyer_household.id,
            power_kw=round(quantity_kwh, 4),
        )
    )
    transaction = Transaction(
        run_id=run.id,
        seller_id=offer.seller_household_id,
        buyer_id=buyer_household.id,
        power_kw=round(quantity_kwh, 4),
        interval_seconds=3600,
        energy_kwh=round(quantity_kwh, 4),
        price_inr_kwh=price,
        total_value_inr=total,
        status="executed",
        source="marketplace",
        executed_at=utcnow(),
    )
    db.add(transaction)
    db.flush()
    purchase = PurchaseOrder(
        buyer_user_id=buyer.id,
        seller_user_id=offer.seller_user_id,
        offer_id=offer.id,
        transaction_id=transaction.id,
        quantity_kwh=round(quantity_kwh, 4),
        price_inr_kwh=price,
        total_value_inr=total,
        status="completed",
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    return purchase


def purchases_for_buyer(db: Session, user_id: int) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(PurchaseOrder)
        .where(PurchaseOrder.buyer_user_id == user_id)
        .order_by(desc(PurchaseOrder.created_at), desc(PurchaseOrder.id))
    ).all()
    seller_ids = {row.seller_user_id for row in rows}
    seller_map = seller_profile_map(db, seller_ids)
    return [
        purchase_payload(
            row,
            buyer_name="You",
            seller_name=(
                seller_map[row.seller_user_id].display_name
                if row.seller_user_id in seller_map
                else "Solar seller"
            ),
        )
        for row in rows
    ]


def sales_for_seller(db: Session, user_id: int) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(PurchaseOrder)
        .where(PurchaseOrder.seller_user_id == user_id)
        .order_by(desc(PurchaseOrder.created_at), desc(PurchaseOrder.id))
    ).all()
    buyer_ids = {row.buyer_user_id for row in rows}
    buyer_map = buyer_profile_map(db, buyer_ids)
    return [
        purchase_payload(
            row,
            buyer_name=(
                buyer_map[row.buyer_user_id].display_name
                if row.buyer_user_id in buyer_map
                else "Microgrid buyer"
            ),
            seller_name="You",
        )
        for row in rows
    ]


def purchase_totals(rows: list[dict[str, Any]]) -> dict[str, Any]:
    completed = [row for row in rows if row.get("status") == "completed"]
    quantity = round(sum(float(row["quantity_kwh"]) for row in completed), 4)
    value = round(sum(float(row["total_value_inr"]) for row in completed), 2)
    avg = round(value / quantity, 2) if quantity > 0 else None
    return {
        "purchase_count": len(completed),
        "energy_kwh": quantity,
        "total_value_inr": value,
        "average_price_inr_kwh": avg,
    }


def seller_earnings(db: Session, user_id: int) -> dict[str, Any]:
    rows = sales_for_seller(db, user_id)
    totals = purchase_totals(rows)
    buckets: dict[str, dict[str, float]] = {}
    for row in rows:
        stamp = row.get("created_at")
        if not stamp:
            continue
        day = str(stamp)[:10]
        bucket = buckets.setdefault(day, {"energy_kwh": 0.0, "value_inr": 0.0, "sales": 0.0})
        bucket["energy_kwh"] += float(row["quantity_kwh"])
        bucket["value_inr"] += float(row["total_value_inr"])
        bucket["sales"] += 1
    series = [
        {
            "date": day,
            "energy_kwh": round(values["energy_kwh"], 4),
            "value_inr": round(values["value_inr"], 2),
            "sales": int(values["sales"]),
        }
        for day, values in sorted(buckets.items())
    ]
    return {
        "energy_sold_kwh": totals["energy_kwh"],
        "simulated_sales_value_inr": totals["total_value_inr"],
        "average_realized_price_inr_kwh": totals["average_price_inr_kwh"],
        "completed_sales": totals["purchase_count"],
        "recent_sales": rows[:8],
        "daily_series": series,
    }


def buyer_spending(db: Session, user_id: int) -> dict[str, Any]:
    rows = purchases_for_buyer(db, user_id)
    totals = purchase_totals(rows)
    buckets: dict[str, dict[str, float]] = {}
    for row in rows:
        stamp = row.get("created_at")
        if not stamp:
            continue
        day = str(stamp)[:10]
        bucket = buckets.setdefault(day, {"energy_kwh": 0.0, "value_inr": 0.0, "purchases": 0.0})
        bucket["energy_kwh"] += float(row["quantity_kwh"])
        bucket["value_inr"] += float(row["total_value_inr"])
        bucket["purchases"] += 1
    series = [
        {
            "date": day,
            "energy_kwh": round(values["energy_kwh"], 4),
            "value_inr": round(values["value_inr"], 2),
            "purchases": int(values["purchases"]),
        }
        for day, values in sorted(buckets.items())
    ]
    return {
        "energy_purchased_kwh": totals["energy_kwh"],
        "simulated_spend_inr": totals["total_value_inr"],
        "average_purchase_price_inr_kwh": totals["average_price_inr_kwh"],
        "completed_purchases": totals["purchase_count"],
        "recent_purchases": rows[:8],
        "daily_series": series,
    }


def seller_today_totals(db: Session, user_id: int) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=24)
    rows = db.scalars(
        select(PurchaseOrder).where(
            PurchaseOrder.seller_user_id == user_id,
            PurchaseOrder.created_at >= start,
            PurchaseOrder.status == "completed",
        )
    ).all()
    quantity = round(sum(float(row.quantity_kwh) for row in rows), 4)
    value = round(sum(float(row.total_value_inr) for row in rows), 2)
    return {"energy_sold_today_kwh": quantity, "simulated_value_today_inr": value, "sales_today": len(rows)}


def market_demand_summary(db: Session) -> dict[str, Any]:
    rows = db.execute(
        select(func.count(BuyerProfile.user_id), func.coalesce(func.sum(BuyerProfile.demand_base_kw), 0.0))
        .join(User, User.id == BuyerProfile.user_id)
        .where(User.status == "active")
    ).one()
    buyer_count = int(rows[0] or 0)
    base_demand = round(float(rows[1] or 0.0), 3)
    offer_count = db.scalar(
        select(func.count()).select_from(EnergyOffer).where(
            EnergyOffer.status == "active", EnergyOffer.remaining_kwh > EPSILON
        )
    ) or 0
    return {
        "registered_buyers": buyer_count,
        "total_baseline_demand_kw": base_demand,
        "active_offers": int(offer_count),
        "privacy_note": "Aggregate demand only. Buyer identities and purchase histories are not exposed to sellers.",
    }
