from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, or_, select
from sqlalchemy.orm import Session

from ...config import settings as runtime
from ...db import get_db
from ...models import Household, Transaction
from ...schemas import HouseholdDetailOut, HouseholdOut
from ...services.simulation import _household_payload, get_config, get_state, transaction_payload

router = APIRouter(prefix="/households", tags=["households"])


@router.get("", response_model=list[HouseholdOut])
def list_households(db: Session = Depends(get_db)) -> list[dict]:  # type: ignore[type-arg]
    return _household_payload(db, get_state(db))


@router.get("/{household_id}", response_model=HouseholdDetailOut)
def household_detail(household_id: str, db: Session = Depends(get_db)) -> dict:  # type: ignore[type-arg]
    household = db.get(Household, household_id)
    if household is None:
        raise HTTPException(status_code=404, detail=f"Household {household_id} not found")
    rows = [item for item in _household_payload(db, get_state(db)) if item["id"] == household_id]
    if not rows:
        raise HTTPException(status_code=404, detail=f"Household {household_id} not found")
    names = {h.id: h.name for h in db.scalars(select(Household)).all()}
    recent = db.scalars(
        select(Transaction)
        .where(or_(Transaction.seller_id == household_id, Transaction.buyer_id == household_id))
        .order_by(desc(Transaction.executed_at), desc(Transaction.id))
        .limit(10)
    ).all()
    config = get_config(db)
    base = {
        **rows[0],
        "recent_transactions": [transaction_payload(t, names) for t in recent],
        "assumptions": [
            "Household demand is simulated deterministically from an hour-of-day profile; it is not smart-meter data.",
            "Generation is an estimate derived from real MCP weather irradiance and installed rooftop capacity.",
            f"Seller offers depend on the current price and a reservation price of ₹{household.reservation_price_ratio * config.base_price_inr_kwh:.2f}/kWh.",
            f"Per-household trade limit is {runtime.max_trade_kw_per_household:.1f} kW per interval.",
        ],
    }
    return base
