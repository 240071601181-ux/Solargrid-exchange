from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ...db import get_db
from ...models import EnergyOffer, Household, SellerProfile
from ...schemas import (
    AccountEnergyOut,
    EarningsOut,
    MarketDemandOut,
    OfferAvailabilityOut,
    OfferCreate,
    OfferListOut,
    OfferOut,
    OfferUpdate,
    ProfilePatch,
    PurchaseListOut,
    SellerDashboardOut,
    SellerProfileOut,
)
from ...services.accounts import (
    account_energy_snapshot,
    daily_price,
    seller_surplus,
)
from ...services.marketplace import (
    MarketError,
    change_offer_status,
    create_offer,
    market_demand_summary,
    offer_payload,
    sales_for_seller,
    seller_earnings,
    seller_today_totals,
    update_offer,
)
from ...services.security import SellerUser
from ...utils import iso

router = APIRouter(prefix="/seller", tags=["seller"])


def _profile_out(profile: SellerProfile) -> dict[str, Any]:
    return {
        "user_id": profile.user_id,
        "display_name": profile.display_name,
        "location_name": profile.location_name,
        "latitude": profile.latitude,
        "longitude": profile.longitude,
        "solar_capacity_kw": profile.solar_capacity_kw,
        "has_battery": profile.has_battery,
        "battery_capacity_kwh": profile.battery_capacity_kwh,
        "household_category": profile.household_category,
        "demand_base_kw": profile.demand_base_kw,
        "household_id": profile.household_id,
        "updated_at": iso(profile.updated_at),
    }


def _seller_context(db: Session, user_id: int) -> tuple[SellerProfile, Household]:
    profile = db.get(SellerProfile, user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Seller profile not found.")
    household = db.get(Household, profile.household_id)
    if household is None:
        raise HTTPException(status_code=409, detail="Seller household is missing.")
    return profile, household


def _own_offers(db: Session, user_id: int, profile: SellerProfile) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(EnergyOffer)
        .where(EnergyOffer.seller_user_id == user_id)
        .order_by(desc(EnergyOffer.created_at), desc(EnergyOffer.id))
    ).all()
    return [offer_payload(row, profile) for row in rows]


def _pricing(db: Session) -> dict[str, Any]:
    from ...services.simulation import get_config

    config = get_config(db)
    payload = daily_price(db)
    payload["sensitivity"] = config.price_sensitivity
    payload["smoothing"] = config.price_smoothing
    return payload


@router.get("/dashboard", response_model=SellerDashboardOut)
async def seller_dashboard(
    user: SellerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    profile, household = _seller_context(db, user.id)
    energy = await account_energy_snapshot(db, household)
    offers = _own_offers(db, user.id, profile)
    earnings = seller_earnings(db, user.id)
    return {
        "profile": _profile_out(profile),
        "energy": energy,
        "offers": offers,
        "today": seller_today_totals(db, user.id),
        "earnings": earnings,
        "market_demand": market_demand_summary(db),
        "pricing": _pricing(db),
        "assumptions": [
            "Seller dashboards use the account's own household estimate only.",
            "Weather is real Open-Meteo data retrieved through the MCP server.",
            "Demand, generation and simulated sales values are model output, not metered or settled money.",
        ],
    }


@router.get("/profile", response_model=SellerProfileOut)
def seller_profile(
    user: SellerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    profile, _household = _seller_context(db, user.id)
    return _profile_out(profile)


@router.patch("/profile", response_model=SellerProfileOut)
def update_seller_profile(
    payload: ProfilePatch,
    user: SellerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    profile, household = _seller_context(db, user.id)
    changes = payload.model_dump(exclude_none=True)
    for field in ("display_name", "location_name", "latitude", "longitude", "household_category"):
        if field in changes:
            setattr(profile, field, changes[field])
    if "display_name" in changes:
        household.name = str(changes["display_name"])[:80]
    if "demand_base_kw" in changes:
        profile.demand_base_kw = float(changes["demand_base_kw"])
        household.demand_base_kw = float(changes["demand_base_kw"])
    if "solar_capacity_kw" in changes:
        profile.solar_capacity_kw = float(changes["solar_capacity_kw"])
        household.solar_capacity_kw = float(changes["solar_capacity_kw"])
    if "has_battery" in changes or "battery_capacity_kwh" in changes:
        has_battery = bool(changes.get("has_battery", profile.has_battery))
        capacity = float(changes.get("battery_capacity_kwh", profile.battery_capacity_kwh))
        if has_battery and capacity <= 0:
            capacity = 5.0
        if not has_battery:
            capacity = 0.0
        profile.has_battery = has_battery
        profile.battery_capacity_kwh = capacity
        household.battery_capacity_kwh = capacity
        household.battery_soc_kwh = round(capacity * 0.55, 3)
        household.battery_max_rate_kw = round(capacity * 0.5, 3)
    db.commit()
    db.refresh(profile)
    return _profile_out(profile)


@router.get("/solar", response_model=AccountEnergyOut)
async def seller_solar(
    user: SellerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    _profile, household = _seller_context(db, user.id)
    return await account_energy_snapshot(db, household)


@router.get("/forecast", response_model=AccountEnergyOut)
async def seller_forecast(
    user: SellerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    _profile, household = _seller_context(db, user.id)
    return await account_energy_snapshot(db, household)


@router.get("/offers", response_model=OfferListOut)
def seller_offers(
    user: SellerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    profile, _household = _seller_context(db, user.id)
    items = _own_offers(db, user.id, profile)
    return {"items": items, "count": len(items)}


@router.get("/offers/availability", response_model=OfferAvailabilityOut)
async def offer_availability(
    user: SellerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    _profile, household = _seller_context(db, user.id)
    result = await seller_surplus(db, household)
    return {
        "available_to_offer_kwh": result["available_to_offer_kwh"],
        "daily_surplus_kwh": result["daily_surplus_kwh"],
        "reserved_offer_kwh": result["reserved_offer_kwh"],
        "forecast_freshness": result["forecast_freshness"],
        "has_forecast": result["has_forecast"],
    }


@router.get("/offers/{offer_id}", response_model=OfferOut)
def seller_offer_detail(
    offer_id: int,
    user: SellerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    profile, _household = _seller_context(db, user.id)
    offer = db.get(EnergyOffer, offer_id)
    if offer is None or offer.seller_user_id != user.id:
        raise HTTPException(status_code=404, detail="Offer not found.")
    return offer_payload(offer, profile)


@router.post("/offers", response_model=OfferOut, status_code=201)
async def create_seller_offer(
    payload: OfferCreate,
    user: SellerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    profile, household = _seller_context(db, user.id)
    surplus = await seller_surplus(db, household)
    try:
        offer = create_offer(
            db,
            user=user,
            seller_profile=profile,
            household=household,
            payload=payload,
            available_to_offer_kwh=surplus["available_to_offer_kwh"],
        )
    except MarketError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return offer_payload(offer, profile)


@router.patch("/offers/{offer_id}", response_model=OfferOut)
async def edit_seller_offer(
    offer_id: int,
    payload: OfferUpdate,
    user: SellerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    profile, household = _seller_context(db, user.id)
    offer = db.get(EnergyOffer, offer_id)
    if offer is None or offer.seller_user_id != user.id:
        raise HTTPException(status_code=404, detail="Offer not found.")
    surplus = await seller_surplus(db, household, exclude_offer_id=offer_id)
    try:
        updated = update_offer(
            db,
            offer_id=offer_id,
            user=user,
            payload=payload,
            available_to_offer_kwh=surplus["available_to_offer_kwh"],
        )
    except MarketError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return offer_payload(updated, profile)


@router.post("/offers/{offer_id}/pause", response_model=OfferOut)
def pause_offer(
    offer_id: int,
    user: SellerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    profile, _household = _seller_context(db, user.id)
    try:
        offer = change_offer_status(db, offer_id=offer_id, user=user, action="pause")
    except MarketError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return offer_payload(offer, profile)


@router.post("/offers/{offer_id}/resume", response_model=OfferOut)
def resume_offer(
    offer_id: int,
    user: SellerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    profile, _household = _seller_context(db, user.id)
    try:
        offer = change_offer_status(db, offer_id=offer_id, user=user, action="resume")
    except MarketError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return offer_payload(offer, profile)


@router.post("/offers/{offer_id}/cancel", response_model=OfferOut)
def cancel_offer(
    offer_id: int,
    user: SellerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    profile, _household = _seller_context(db, user.id)
    try:
        offer = change_offer_status(db, offer_id=offer_id, user=user, action="cancel")
    except MarketError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return offer_payload(offer, profile)


@router.get("/sales", response_model=PurchaseListOut)
def seller_sales(
    user: SellerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    items = sales_for_seller(db, user.id)
    return {"items": items, "count": len(items)}


@router.get("/earnings", response_model=EarningsOut)
def seller_earnings_endpoint(
    user: SellerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    return seller_earnings(db, user.id)


@router.get("/market-demand", response_model=MarketDemandOut)
def seller_market_demand(
    _user: SellerUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    return market_demand_summary(db)
