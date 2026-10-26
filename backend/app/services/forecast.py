"""Forward-looking forecast baseline.

Generation is derived from the MCP hourly weather forecast through the same
documented solar model used by the simulation. Demand uses a transparent
hour-of-day profile (optionally blended with recent simulated ticks when enough
history exists). No machine-learning model is trained or implied.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..config import settings as runtime
from ..models import AppSetting, Household, TickSnapshot
from ..utils import as_utc, iso
from .solar import demand_factor, estimate_generation_kw
from .weather import fetch_forecast

MODEL_NAME = "weather_driven_physical_baseline"
MODEL_VERSION = "1.0"


def _historical_demand_factor(db: Session) -> dict[int, float]:
    """Average simulated demand by local hour, when enough ticks exist."""
    rows = db.scalars(select(TickSnapshot).order_by(desc(TickSnapshot.tick)).limit(144)).all()
    buckets: dict[int, list[float]] = {}
    for row in rows:
        moment = as_utc(row.simulated_at)
        if not moment:
            continue
        hour = moment.astimezone(ZoneInfo(runtime.timezone)).hour
        buckets.setdefault(hour, []).append(row.demand_kw)
    if len(rows) < 12:
        return {}
    return {hour: sum(values) / len(values) for hour, values in buckets.items() if values}


async def build_forecast(db: Session, hours: int) -> dict[str, Any]:
    config = db.get(AppSetting, 1)
    hours = max(1, min(hours, 72))
    forecast = await fetch_forecast(db, hours=hours)
    if not forecast.rows:
        return {
            "generated_at": iso(forecast.retrieved_at),
            "provider": forecast.provider,
            "transport": forecast.transport,
            "mcp_server": forecast.mcp_server,
            "model": MODEL_NAME,
            "model_version": MODEL_VERSION,
            "model_status": "unavailable",
            "freshness": "unavailable",
            "horizon_hours": hours,
            "error": forecast.error,
            "assumptions": _assumptions(),
            "series": [],
        }

    households = db.scalars(
        select(Household)
        .where(Household.owner_user_id.is_(None))
        .order_by(Household.id)
    ).all()
    base_price = config.base_price_inr_kwh if config else 6.0
    historical = _historical_demand_factor(db)
    total_base_demand = sum(h.demand_base_kw for h in households)

    series: list[dict[str, Any]] = []
    for row in forecast.rows:
        stamp = row.get("timestamp")
        if not stamp:
            continue
        try:
            moment = datetime.fromisoformat(stamp)
        except ValueError:
            continue
        irradiance = row.get("irradiance_w_m2")
        ambient = row.get("temperature_c")
        generation = 0.0
        for household in households:
            estimate = estimate_generation_kw(
                household.solar_capacity_kw,
                irradiance,
                orientation_factor=household.orientation_factor,
                ambient_temperature_c=ambient,
            )
            generation += estimate or 0.0

        hour = moment.astimezone(ZoneInfo(runtime.timezone)).hour
        if historical and hour in historical:
            demand = historical[hour]
            demand_basis = "recent_simulated_hourly_average"
        else:
            demand = total_base_demand * demand_factor(hour)
            demand_basis = "documented_demand_profile"
        demand = max(0.0, round(demand, 4))

        series.append(
            {
                "timestamp": moment.isoformat(),
                "kind": "predicted",
                "generation_kw": round(generation, 4),
                "demand_kw": demand,
                "imbalance_kw": round(generation - demand, 4),
                "irradiance_w_m2": irradiance,
                "cloud_cover_pct": row.get("cloud_cover_pct"),
                "temperature_c": ambient,
                "wind_speed_ms": row.get("wind_speed_ms"),
                "demand_basis": demand_basis,
                "base_price_inr_kwh": base_price,
            }
        )

    latest = db.scalars(select(TickSnapshot).order_by(desc(TickSnapshot.tick)).limit(1)).first()
    observed = None
    if latest:
        observed = {
            "tick": latest.tick,
            "simulated_at": iso(latest.simulated_at),
            "generation_kw": latest.generation_kw,
            "demand_kw": latest.demand_kw,
            "price_inr_kwh": latest.price_inr_kwh,
            "kind": "simulated_current",
        }

    return {
        "generated_at": iso(forecast.retrieved_at),
        "provider": forecast.provider,
        "transport": forecast.transport,
        "mcp_server": forecast.mcp_server,
        "model": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "model_status": "baseline" if forecast.freshness in {"live", "stale"} else "stale",
        "freshness": forecast.freshness,
        "horizon_hours": len(series),
        "error": forecast.error,
        "observed": observed,
        "assumptions": _assumptions(historical_used=bool(historical)),
        "series": series,
    }


def _assumptions(historical_used: bool = False) -> list[str]:
    notes = [
        "Predicted generation uses provider forecast irradiance, installed capacity, a 0.86 performance factor, roof orientation and a cell-temperature derate.",
        "Predicted demand is a deterministic hour-of-day profile scaled by each household's base demand; it is simulated, not metered.",
        "This is a physical baseline forecast, not a trained machine-learning model.",
        "Past-hour rows are excluded; timestamps follow the provider forecast timezone and are returned in UTC.",
    ]
    if historical_used:
        notes.append("Demand for hours with recent simulation history uses the simulated hourly average for that hour.")
    return notes
