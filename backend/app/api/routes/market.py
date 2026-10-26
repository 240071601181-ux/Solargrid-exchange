from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ...db import get_db
from ...schemas import OfferListOut, OfferOut
from ...services.marketplace import MarketError, get_active_offer, marketplace_offers, offer_payload
from ...services.security import AnyUser

router = APIRouter(prefix="/market", tags=["marketplace"])


@router.get("/offers", response_model=OfferListOut)
def list_market_offers(
    _user: AnyUser,
    db: Annotated[Session, Depends(get_db)],
    q: str | None = None,
    max_price: float | None = Query(default=None, ge=0.1, le=50),
    min_quantity: float | None = Query(default=None, ge=0, le=10000),
    sort: str = Query(default="price_asc", pattern="^(price_asc|price_desc|quantity_desc|newest)$"),
    limit: int = Query(default=60, ge=1, le=100),
) -> dict:  # type: ignore[type-arg]
    items = marketplace_offers(
        db,
        q=q,
        max_price=max_price,
        min_quantity=min_quantity,
        sort=sort,
        limit=limit,
    )
    return {"items": items, "count": len(items)}


@router.get("/offers/{offer_id}", response_model=OfferOut)
def market_offer_detail(
    offer_id: int,
    _user: AnyUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict:  # type: ignore[type-arg]
    try:
        offer, profile = get_active_offer(db, offer_id)
    except MarketError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    if offer.status != "active" or offer.remaining_kwh <= 1e-9:
        raise HTTPException(status_code=404, detail="Offer is no longer available.")
    return offer_payload(offer, profile)
