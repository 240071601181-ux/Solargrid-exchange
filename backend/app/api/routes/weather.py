from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...db import get_db
from ...schemas import ForecastOut, WeatherCurrentOut, WeatherStatusOut
from ...services.forecast import build_forecast
from ...services.weather import current_payload, fetch_current_weather, fetch_forecast, weather_status

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/current", response_model=WeatherCurrentOut)
async def current_weather(
    refresh: bool = Query(default=False), db: Session = Depends(get_db)
) -> dict:  # type: ignore[type-arg]
    result = await fetch_current_weather(db, force=refresh)
    return current_payload(result, db)


@router.get("/status", response_model=WeatherStatusOut)
def status(db: Session = Depends(get_db)) -> dict:  # type: ignore[type-arg]
    return weather_status(db)


@router.get("/forecast", response_model=ForecastOut)
async def weather_forecast(
    hours: int = Query(default=24, ge=1, le=72), db: Session = Depends(get_db)
) -> dict:  # type: ignore[type-arg]
    return await build_forecast(db, hours)
