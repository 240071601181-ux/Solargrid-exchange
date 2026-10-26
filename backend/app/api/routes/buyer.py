from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ...db import get_db
from ...models import BuyerProfile, Household, TickSnapshot
from ...schemas import (
    AccountEnergyOut,
    BuyerDashboardOut,
    BuyerPricesOut,
    BuyerProfileOut,
    BuyerUsageOut,
    PricingOut,
    ProfilePatch,
    PurchaseCreate,
    PurchaseListOut,
    PurchaseOut,
    SpendingOut,
)
from ...services.accounts import account_energy_snapshot, daily_price
from ...services.forecast import build_forecast
from ...services.marketplace import (
    MarketError,
    buyer_spending,
    marketplace_offers,
    purchase_offer,
    purchases_for_buyer,
    purchase_payload,
    seller_profile_map,
)
from ...services.pricing import calculate_price
from ...services.security import BuyerUser
from ...services.simulation import _pricing_payload, get_config, latest_tick
from ...services.weather import WeatherUnavailable, current_payload, fetch_current_weather
from ...utils import iso

router = APIRouter(prefix="/buyer", tags=["buyer"])


def _profile_out(profile: BuyerProfile) -> dict[str, Any]:
    return {
        "user_id": profile.user_id,
        "display_name": profile.display_name,
        "location_name": profile.location_name,
        "latitude": profile.latitude,
        "longitude": profile.longitude,
        "household_category": profile.household_category,
        "demand_base_kw": profile.demand_base_kw,
        "household_id": profile.household_id,
        "updated_at": iso(profile.updated_at),
    }


def _buyer_context(db: Session, user_id: int) -> tuple[BuyerProfile, Household]:
    profile = db.get(BuyerProfile, user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Buyer profile not found.")
    household = db.get(Household, profile.household_id)
    if household is None:
        raise HTTPException(status_code=409, detail="Buyer household is missing.")
    return profile, household


def _current_pricing(db: Session) -> dict[str, Any]:
    return _pricing_payload(latest_tick(db), get_config(db))


@router.get("/dashboard", response_model=BuyerDashboardOut)
async def buyer_dashboard(
    user: BuyerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    profile, household = _buyer_context(db, user.id)
    energy = await account_energy_snapshot(db, household)
    offers = marketplace_offers(db, sort="price_asc", limit=6)
    spending = buyer_spending(db, user.id)
    return {
        "profile": _profile_out(profile),
        "energy": energy,
        "available_offers": offers,
        "spending": spending,
        "pricing": _current_pricing(db),
        "assumptions": [
            "Buyer demand is a simulated household profile, not smart-meter data.",
            "Weather is real Open-Meteo data retrieved through the MCP server.",
            "Purchases move simulated energy and simulated value only; no financial settlement occurs.",
        ],
    }


@router.get("/profile", response_model=BuyerProfileOut)
def buyer_profile(
    user: BuyerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    profile, _household = _buyer_context(db, user.id)
    return _profile_out(profile)


@router.patch("/profile", response_model=BuyerProfileOut)
def update_buyer_profile(
    payload: ProfilePatch,
    user: BuyerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    profile, household = _buyer_context(db, user.id)
    changes = payload.model_dump(exclude_none=True)
    for field in ("display_name", "location_name", "latitude", "longitude", "household_category"):
        if field in changes:
            setattr(profile, field, changes[field])
    if "display_name" in changes:
        household.name = str(changes["display_name"])[:80]
    if "demand_base_kw" in changes:
        profile.demand_base_kw = float(changes["demand_base_kw"])
        household.demand_base_kw = float(changes["demand_base_kw"])
    db.commit()
    db.refresh(profile)
    return _profile_out(profile)


@router.get("/purchases", response_model=PurchaseListOut)
def buyer_purchases(
    user: BuyerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    items = purchases_for_buyer(db, user.id)
    return {"items": items, "count": len(items)}


@router.post("/purchases", response_model=PurchaseOut, status_code=201)
def create_purchase(
    payload: PurchaseCreate,
    user: BuyerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    profile, household = _buyer_context(db, user.id)
    try:
        purchase = purchase_offer(
            db,
            buyer=user,
            buyer_profile=profile,
            buyer_household=household,
            offer_id=payload.offer_id,
            quantity_kwh=payload.quantity_kwh,
        )
    except MarketError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    seller_map = seller_profile_map(db, {purchase.seller_user_id})
    seller_name = (
        seller_map[purchase.seller_user_id].display_name
        if purchase.seller_user_id in seller_map
        else "Solar seller"
    )
    return purchase_payload(
        purchase,
        buyer_name=profile.display_name,
        seller_name=seller_name,
    )


@router.get("/spending", response_model=SpendingOut)
def buyer_spending_endpoint(
    user: BuyerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    return buyer_spending(db, user.id)


@router.get("/usage", response_model=BuyerUsageOut)
async def buyer_usage(
    user: BuyerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    profile, household = _buyer_context(db, user.id)
    energy = await account_energy_snapshot(db, household)
    return {
        "profile": _profile_out(profile),
        "energy": energy,
        "spending": buyer_spending(db, user.id),
    }


@router.get("/prices", response_model=BuyerPricesOut)
async def buyer_prices(
    _user: BuyerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    config = get_config(db)
    current = _current_pricing(db)
    tick_rows = db.scalars(
        select(TickSnapshot).order_by(desc(TickSnapshot.tick)).limit(48)
    ).all()
    history = [
        {
            "tick": row.tick,
            "simulated_at": iso(row.simulated_at),
            "price_inr_kwh": row.price_inr_kwh,
            "base_price_inr_kwh": row.base_price_inr_kwh,
            "imbalance": row.imbalance,
            "supply_kw": row.physical_surplus_kw,
            "demand_kw": row.physical_deficit_kw,
            "cloud_cover_pct": row.cloud_cover_pct,
            "irradiance_w_m2": row.irradiance_w_m2,
            "reason": row.pricing_reason,
        }
        for row in reversed(tick_rows)
    ]

    forecast = await build_forecast(db, 24)
    forecast_points: list[dict[str, Any]] = []
    previous = float(current["price_inr_kwh"])
    for point in forecast.get("series", []):
        generation = float(point.get("generation_kw") or 0.0)
        demand = float(point.get("demand_kw") or 0.0)
        supply = max(0.0, generation - demand)
        deficit = max(0.0, demand - generation)
        price = calculate_price(
            supply_kw=supply,
            demand_kw=deficit,
            base_price_inr_kwh=config.base_price_inr_kwh,
            min_price_inr_kwh=config.min_price_inr_kwh,
            max_price_inr_kwh=config.max_price_inr_kwh,
            sensitivity=config.price_sensitivity,
            smoothing=config.price_smoothing,
            previous_price_inr_kwh=previous,
        )
        previous = price.price_inr_kwh
        forecast_points.append(
            {
                "timestamp": point.get("timestamp") or "",
                "generation_kw": generation,
                "demand_kw": demand,
                "price_inr_kwh": price.price_inr_kwh,
                "cloud_cover_pct": point.get("cloud_cover_pct"),
                "irradiance_w_m2": point.get("irradiance_w_m2"),
                "demand_basis": point.get("demand_basis"),
            }
        )

    weather = None
    try:
        result = await fetch_current_weather(db)
        weather = current_payload(result, db)
    except WeatherUnavailable:
        pass

    return {
        "current": current,
        "history": history,
        "forecast": forecast_points,
        "weather": weather,
        "freshness": forecast.get("freshness", "unavailable"),
        "assumptions": [
            "Historical prices are model outputs from completed simulation ticks.",
            "Forecast prices apply the same bounded supply/demand rule to the MCP weather forecast.",
            "Forecast prices are scenario estimates and are not trade guarantees.",
        ],
    }
