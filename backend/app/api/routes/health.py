from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from ...config import settings
from ...db import get_db
from ...schemas import HealthOut
from ...services.weather import weather_status

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
def health(db: Session = Depends(get_db)) -> dict:  # type: ignore[type-arg]
    db_ok = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:  # pragma: no cover - only on a broken database
        db_ok = f"error: {exc}"
    return {
        "status": "ok" if db_ok == "ok" else "degraded",
        "service": settings.app_name,
        "version": "1.0.0",
        "database": db_ok,
        "environment": settings.environment,
        "timestamp": datetime.now(timezone.utc),
        "weather": weather_status(db),
    }
