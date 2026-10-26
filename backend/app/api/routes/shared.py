from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...db import get_db
from ...schemas import SharedStatusOut
from ...services.accounts import daily_price
from ...services.security import AnyUser
from ...services.simulation import get_config, get_state
from ...services.weather import WeatherUnavailable, current_payload, fetch_current_weather
from ...utils import iso

router = APIRouter(prefix="/shared", tags=["shared"])


def status_payload(db: Session, weather: dict[str, Any] | None) -> dict[str, Any]:
    state = get_state(db)
    config = get_config(db)
    pricing = daily_price(db)
    pricing.update({"sensitivity": config.price_sensitivity, "smoothing": config.price_smoothing})
    return {
        "state": {
            "status": state.status,
            "tick": state.tick,
            "seq": state.seq,
            "simulated_at": iso(state.simulated_at),
            "cloud_scenario_pct": state.cloud_scenario_pct,
            "scenario_label": state.scenario_label,
            "last_error": state.last_error,
            "tick_seconds": config.tick_seconds,
            "interval_seconds": config.interval_seconds,
            "auto_execute_trades": config.auto_execute_trades,
        },
        "weather": weather,
        "pricing": pricing,
        "shared_note": "Shared microgrid status contains no account-private purchase or offer data.",
    }


@router.get("/status", response_model=SharedStatusOut)
async def shared_status(
    _user: AnyUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    weather = None
    try:
        result = await fetch_current_weather(db)
        weather = current_payload(result, db)
    except WeatherUnavailable:
        pass
    return status_payload(db, weather)
