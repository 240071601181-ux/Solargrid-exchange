from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...config import settings as runtime
from ...db import get_db
from ...models import AppSetting
from ...schemas import SettingsOut, SettingsPageOut, SettingsPatch
from ...services.realtime import hub
from ...services.simulation import ensure_defaults, get_config
from ...services.weather import fetch_current_weather, weather_status
from ...utils import iso

router = APIRouter(prefix="/settings", tags=["settings"])


def _settings_payload(config: AppSetting) -> dict:  # type: ignore[type-arg]
    return {
        "base_price_inr_kwh": config.base_price_inr_kwh,
        "min_price_inr_kwh": config.min_price_inr_kwh,
        "max_price_inr_kwh": config.max_price_inr_kwh,
        "price_sensitivity": config.price_sensitivity,
        "price_smoothing": config.price_smoothing,
        "forecast_horizon_hours": config.forecast_horizon_hours,
        "tick_seconds": config.tick_seconds,
        "interval_seconds": config.interval_seconds,
        "auto_execute_trades": config.auto_execute_trades,
        "latitude": config.latitude,
        "longitude": config.longitude,
        "location_name": config.location_name,
        "updated_at": config.updated_at,
    }


def _page_payload(db: Session, config: AppSetting) -> dict:  # type: ignore[type-arg]
    status = weather_status(db)
    return {
        "settings": _settings_payload(config),
        "weather": status,
        "backend": {
            "api_prefix": runtime.api_prefix,
            "websocket_path": "/ws/simulation",
            "database": "SQLite (persistent transactions and evaluations)",
            "environment": runtime.environment,
            "tick_loop": f"1 tick every {config.tick_seconds:g}s when running",
            "simulated_interval": f"{config.interval_seconds}s per tick",
            "version": "1.0.0",
        },
        "data_sources": [
            {
                "name": "Weather observations and forecast",
                "kind": "external",
                "provider": "Open-Meteo via MCP (stdio)",
                "identity": "real external provider data",
                "status": status["status"],
                "last_retrieved_at": status["last_retrieved_at"],
                "error": status["last_error"],
            },
            {
                "name": "Solar generation",
                "kind": "derived",
                "provider": "Physical solar model",
                "identity": "estimated from real irradiance; not metered",
                "status": "derived",
                "last_retrieved_at": status["last_retrieved_at"],
                "error": None,
            },
            {
                "name": "Household demand",
                "kind": "simulated",
                "provider": "Deterministic demand profile",
                "identity": "simulated; no smart meters connected",
                "status": "simulated",
                "last_retrieved_at": None,
                "error": None,
            },
            {
                "name": "Allocations, prices, transactions",
                "kind": "derived",
                "provider": "Backend simulation",
                "identity": "computed by backend services; transactions are simulated",
                "status": "active",
                "last_retrieved_at": None,
                "error": None,
            },
        ],
        "supported": {
            "price_settings": True,
            "simulation_speed": True,
            "forecast_horizon": True,
            "location_change": True,
            "auto_execute": True,
            "household_creation": False,
            "payments": False,
            "blockchain": False,
        },
    }


@router.get("", response_model=SettingsPageOut)
def get_settings(db: Session = Depends(get_db)) -> dict:  # type: ignore[type-arg]
    ensure_defaults(db)
    return _page_payload(db, get_config(db))


@router.patch("", response_model=SettingsPageOut)
async def update_settings(payload: SettingsPatch, db: Session = Depends(get_db)) -> dict:  # type: ignore[type-arg]
    config = get_config(db)
    changes = payload.model_dump(exclude_none=True)
    location_changed = "latitude" in changes or "longitude" in changes or "location_name" in changes

    for field, value in changes.items():
        setattr(config, field, value)

    if not (config.min_price_inr_kwh <= config.base_price_inr_kwh <= config.max_price_inr_kwh):
        db.rollback()
        raise HTTPException(
            status_code=422,
            detail="Price bounds are inconsistent: minimum ≤ base ≤ maximum is required.",
        )
    db.commit()
    db.refresh(config)

    if location_changed:
        try:
            await fetch_current_weather(db, force=True)
        except Exception:
            # The save succeeded; the weather status endpoint exposes the provider error.
            pass

    await hub.broadcast(
        {
            "type": "settings.updated",
            "seq": 0,
            "data": {"updated_at": iso(config.updated_at), "location_changed": location_changed},
        }
    )
    return _page_payload(db, config)
