from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ...db import get_db
from ...models import TickSnapshot
from ...schemas import PricingOut
from ...services.security import AdminUser, AnyUser
from ...services.simulation import simulation_payload

router = APIRouter(tags=["metrics"])


@router.get("/metrics/summary", response_model=dict)
def metrics_summary(
    _user: AdminUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict:  # type: ignore[type-arg]
    payload = simulation_payload(db)
    return {
        "state": payload["state"],
        "totals": payload["totals"],
        "pricing": payload["pricing"],
        "households": payload["households"],
    }


@router.get("/pricing/current", response_model=PricingOut)
def current_price(
    _user: AnyUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict:  # type: ignore[type-arg]
    return simulation_payload(db)["pricing"]


@router.get("/pricing/history", response_model=list[dict])
def price_history(
    _user: AnyUser,
    db: Annotated[Session, Depends(get_db)],
    limit: int = 48,
) -> list[dict]:  # type: ignore[type-arg]
    rows = db.scalars(
        select(TickSnapshot).order_by(desc(TickSnapshot.tick)).limit(max(1, min(limit, 288)))
    ).all()
    return [
        {
            "tick": row.tick,
            "simulated_at": row.simulated_at,
            "price_inr_kwh": row.price_inr_kwh,
            "base_price_inr_kwh": row.base_price_inr_kwh,
            "imbalance": row.imbalance,
            "supply_kw": row.physical_surplus_kw,
            "demand_kw": row.physical_deficit_kw,
        }
        for row in reversed(rows)
    ]
