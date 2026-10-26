from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...db import get_db
from ...schemas import ForecastOut
from ...services.forecast import build_forecast

router = APIRouter(tags=["forecast"])


@router.get("/forecast", response_model=ForecastOut)
async def generation_and_demand_forecast(
    horizon_hours: int = Query(default=24, ge=1, le=72),
    db: Session = Depends(get_db),
) -> dict:  # type: ignore[type-arg]
    return await build_forecast(db, horizon_hours)
