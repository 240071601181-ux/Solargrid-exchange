"""Household energy estimates for authenticated seller and buyer accounts.

Account households are isolated from the seeded eight-household control-room
simulation. Their solar estimate still uses the same real MCP weather input and
the same documented physical solar/demand models.
"""

from __future__ import annotations

import secrets
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings as runtime
from ..models import (
    AppSetting,
    BuyerProfile,
    EnergyOffer,
    Household,
    SellerProfile,
    SimulationState,
    User,
)
from ..utils import iso
from .security import ROLE_BUYER, ROLE_SELLER
from .solar import demand_factor, estimate_demand_kw, estimate_generation_kw
from .weather import (
    WeatherUnavailable,
    current_payload,
    fetch_current_weather,
    fetch_forecast,
)

CATEGORY_DEMAND_KW = {
    "residential": 0.9,
    "apartment": 0.7,
    "small_business": 1.4,
    "shop": 1.1,
    "farm": 1.6,
    "other": 0.9,
}


def category_demand(category: str) -> float:
    return CATEGORY_DEMAND_KW.get(category, CATEGORY_DEMAND_KW["residential"])


def allocate_household_id(db: Session) -> str:
    for _ in range(10):
        candidate = f"U-{secrets.token_hex(5)}"
        if db.get(Household, candidate) is None:
            return candidate
    raise RuntimeError("Could not allocate a unique account household identifier.")


def create_account_household(
    db: Session,
    *,
    user_id: int,
    role: str,
    display_name: str,
    solar_capacity_kw: float,
    has_battery: bool,
    battery_capacity_kwh: float,
    demand_base_kw: float,
) -> Household:
    household_id = allocate_household_id(db)
    battery = battery_capacity_kwh if has_battery else 0.0
    if has_battery and battery <= 0:
        battery = 5.0
    household = Household(
        id=household_id,
        name=display_name[:80],
        role_hint="seller account" if role == ROLE_SELLER else "buyer account",
        solar_capacity_kw=max(0.0, solar_capacity_kw) if role == ROLE_SELLER else 0.0,
        orientation_factor=0.92,
        demand_base_kw=max(0.05, demand_base_kw),
        battery_capacity_kwh=max(0.0, battery),
        battery_soc_kwh=round(max(0.0, battery) * 0.55, 3),
        battery_max_rate_kw=round(max(0.0, battery) * 0.5, 3),
        reservation_price_ratio=1.0,
        owner_user_id=user_id,
    )
    db.add(household)
    db.flush()
    return household


def profile_for_user(db: Session, user: User) -> SellerProfile | BuyerProfile | None:
    if user.role == ROLE_SELLER:
        return db.get(SellerProfile, user.id)
    if user.role == ROLE_BUYER:
        return db.get(BuyerProfile, user.id)
    return None


def profile_household(db: Session, profile: SellerProfile | BuyerProfile) -> Household | None:
    return db.get(Household, profile.household_id)


def _local_now() -> datetime:
    return datetime.now(ZoneInfo(runtime.timezone))


def _sim_tick(db: Session) -> int:
    state = db.get(SimulationState, 1)
    return state.tick if state else 0


def reserved_offer_kwh(
    db: Session, seller_user_id: int, *, exclude_offer_id: int | None = None
) -> float:
    stmt = select(func.coalesce(func.sum(EnergyOffer.remaining_kwh), 0.0)).where(
        EnergyOffer.seller_user_id == seller_user_id,
        EnergyOffer.status.in_(("active", "paused")),
    )
    if exclude_offer_id is not None:
        stmt = stmt.where(EnergyOffer.id != exclude_offer_id)
    return round(float(db.scalar(stmt) or 0.0), 4)


def daily_price(db: Session) -> dict[str, Any]:
    from .simulation import latest_tick

    config = db.get(AppSetting, 1)
    tick = latest_tick(db)
    base = config.base_price_inr_kwh if config else runtime.base_price_inr_kwh
    return {
        "price_inr_kwh": tick.price_inr_kwh if tick else base,
        "base_price_inr_kwh": base,
        "min_price_inr_kwh": config.min_price_inr_kwh if config else runtime.min_price_inr_kwh,
        "max_price_inr_kwh": config.max_price_inr_kwh if config else runtime.max_price_inr_kwh,
        "imbalance": tick.imbalance if tick else 0.0,
        "supply_kw": tick.physical_surplus_kw if tick else 0.0,
        "demand_kw": tick.physical_deficit_kw if tick else 0.0,
        "reason": tick.pricing_reason if tick else "No simulation tick has run yet.",
        "updated_at": iso(tick.simulated_at) if tick else None,
    }


async def account_energy_snapshot(
    db: Session,
    household: Household,
    *,
    hours: int = 24,
    exclude_offer_id: int | None = None,
) -> dict[str, Any]:
    """Current and forward household estimate. Never described as metered data."""
    current = _local_now()
    weather_payload: dict[str, Any] | None = None
    weather_error: str | None = None
    generation_kw: float | None = None
    demand_kw: float | None = None
    try:
        result = await fetch_current_weather(db)
        weather_payload = current_payload(result, db)
        generation_kw = estimate_generation_kw(
            household.solar_capacity_kw,
            result.snapshot.irradiance_w_m2 if result.snapshot else None,
            orientation_factor=household.orientation_factor,
            ambient_temperature_c=result.snapshot.temperature_c if result.snapshot else None,
        )
    except WeatherUnavailable as exc:
        weather_error = str(exc)

    demand_kw = estimate_demand_kw(
        household.demand_base_kw,
        hour=current.hour,
        seed=runtime.simulation_seed,
        tick=_sim_tick(db) + 1,
        household_id=household.id,
    )
    gen_value = generation_kw if generation_kw is not None else 0.0
    net_kw = round(gen_value - demand_kw, 4)
    surplus_kw = round(max(0.0, net_kw), 4)
    deficit_kw = round(max(0.0, -net_kw), 4)

    forecast = await fetch_forecast(db, hours=max(4, min(hours, 72)))
    series: list[dict[str, Any]] = []
    generation_kwh = 0.0
    demand_kwh = 0.0
    for row in forecast.rows:
        stamp = row.get("timestamp")
        if not stamp:
            continue
        try:
            moment = datetime.fromisoformat(str(stamp))
        except ValueError:
            continue
        hour = moment.astimezone(ZoneInfo(runtime.timezone)).hour
        estimated_generation = estimate_generation_kw(
            household.solar_capacity_kw,
            row.get("irradiance_w_m2"),
            orientation_factor=household.orientation_factor,
            ambient_temperature_c=row.get("temperature_c"),
        )
        predicted_demand = round(household.demand_base_kw * demand_factor(hour), 4)
        generation_value = estimated_generation or 0.0
        generation_kwh += generation_value
        demand_kwh += predicted_demand
        series.append(
            {
                "timestamp": moment.isoformat(),
                "kind": "predicted",
                "generation_kw": round(generation_value, 4),
                "demand_kw": predicted_demand,
                "imbalance_kw": round(generation_value - predicted_demand, 4),
                "irradiance_w_m2": row.get("irradiance_w_m2"),
                "cloud_cover_pct": row.get("cloud_cover_pct"),
                "temperature_c": row.get("temperature_c"),
                "demand_basis": "household_baseline_demand_profile",
            }
        )

    daily_surplus = round(max(0.0, generation_kwh - demand_kwh), 4)
    daily_deficit = round(max(0.0, demand_kwh - generation_kwh), 4)
    reserved = (
        reserved_offer_kwh(db, household.owner_user_id, exclude_offer_id=exclude_offer_id)
        if household.owner_user_id
        else 0.0
    )
    available = round(max(0.0, daily_surplus - reserved), 4)

    return {
        "household": {
            "id": household.id,
            "display_name": household.name,
            "category": (
                db.get(SellerProfile, household.owner_user_id).household_category
                if household.owner_user_id and db.get(SellerProfile, household.owner_user_id)
                else (
                    db.get(BuyerProfile, household.owner_user_id).household_category
                    if household.owner_user_id and db.get(BuyerProfile, household.owner_user_id)
                    else "residential"
                )
            ),
            "solar_capacity_kw": household.solar_capacity_kw,
            "has_battery": household.battery_capacity_kwh > 0,
            "battery_capacity_kwh": household.battery_capacity_kwh,
            "battery_soc_kwh": household.battery_soc_kwh,
            "battery_soc_pct": (
                round(household.battery_soc_kwh / household.battery_capacity_kwh * 100, 1)
                if household.battery_capacity_kwh > 0
                else None
            ),
            "location_name": (
                db.get(SellerProfile, household.owner_user_id).location_name
                if household.owner_user_id and db.get(SellerProfile, household.owner_user_id)
                else (
                    db.get(BuyerProfile, household.owner_user_id).location_name
                    if household.owner_user_id and db.get(BuyerProfile, household.owner_user_id)
                    else runtime.location_name
                )
            ),
            "demand_base_kw": household.demand_base_kw,
        },
        "current": {
            "generation_kw": round(generation_kw, 4) if generation_kw is not None else None,
            "demand_kw": demand_kw,
            "net_kw": net_kw,
            "surplus_kw": surplus_kw,
            "deficit_kw": deficit_kw,
            "estimated_at": current.isoformat(),
        },
        "daily": {
            "generation_kwh": round(generation_kwh, 4),
            "demand_kwh": round(demand_kwh, 4),
            "surplus_kwh": daily_surplus,
            "deficit_kwh": daily_deficit,
            "reserved_offer_kwh": reserved,
            "available_to_offer_kwh": available,
        },
        "forecast": {
            "provider": forecast.provider,
            "transport": forecast.transport,
            "mcp_server": forecast.mcp_server,
            "freshness": forecast.freshness,
            "generated_at": iso(forecast.retrieved_at),
            "error": forecast.error,
            "horizon_hours": len(series),
            "series": series,
        },
        "weather": weather_payload,
        "weather_error": weather_error,
        "assumptions": [
            "Generation is estimated from real provider irradiance through the documented solar model; there are no on-site meters.",
            "Household demand is simulated from a deterministic hour-of-day profile, not smart-meter data.",
            "Daily surplus subtracts estimated demand from forecast generation for the next 24 hours.",
            "Offers reserve their remaining quantity so the same estimated energy cannot be offered twice.",
            "Simulated values are not payments or settled financial claims.",
        ],
    }


async def seller_surplus(
    db: Session, household: Household, *, exclude_offer_id: int | None = None
) -> dict[str, Any]:
    snapshot = await account_energy_snapshot(
        db, household, hours=24, exclude_offer_id=exclude_offer_id
    )
    return {
        "available_to_offer_kwh": snapshot["daily"]["available_to_offer_kwh"],
        "daily_surplus_kwh": snapshot["daily"]["surplus_kwh"],
        "reserved_offer_kwh": snapshot["daily"]["reserved_offer_kwh"],
        "forecast_freshness": snapshot["forecast"]["freshness"],
        "has_forecast": bool(snapshot["forecast"]["series"]),
        "snapshot": snapshot,
    }
