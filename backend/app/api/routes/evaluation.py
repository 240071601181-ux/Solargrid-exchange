from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from ...db import get_db
from ...models import EvaluationRun
from ...schemas import EvaluationOut, EvaluationRequest
from ...services.evaluation import evaluation_payload, run_evaluation
from ...services.weather import WeatherUnavailable

router = APIRouter(prefix="/evaluation", tags=["evaluation"])


@router.get("/latest", response_model=EvaluationOut | None)
def latest_evaluation(db: Session = Depends(get_db)) -> dict | None:  # type: ignore[type-arg]
    run = db.scalars(select(EvaluationRun).order_by(desc(EvaluationRun.id)).limit(1)).first()
    return evaluation_payload(run) if run else None


@router.get("/summary", response_model=dict)
def evaluation_summary(db: Session = Depends(get_db)) -> dict:  # type: ignore[type-arg]
    count = db.scalar(select(func.count()).select_from(EvaluationRun)) or 0
    run = db.scalars(select(EvaluationRun).order_by(desc(EvaluationRun.id)).limit(1)).first()
    return {"count": count, "latest": evaluation_payload(run) if run else None}


@router.post("/run", response_model=EvaluationOut)
async def create_evaluation(
    payload: EvaluationRequest, db: Session = Depends(get_db)
) -> dict:  # type: ignore[type-arg]
    try:
        return await run_evaluation(
            db, ticks=payload.ticks, cloud_cover_pct=payload.cloud_cover_pct
        )
    except WeatherUnavailable as exc:
        raise HTTPException(status_code=503, detail=f"Real weather data unavailable: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {exc}") from exc
