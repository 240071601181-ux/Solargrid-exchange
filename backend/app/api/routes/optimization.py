from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ...db import get_db
from ...models import AllocationRun, Household
from ...schemas import AllocationOut, ExecutionResultOut, ExecuteRequest
from ...services.realtime import hub
from ...services.simulation import (
    DuplicateExecution,
    SimulationError,
    allocation_payload,
    execute_allocation_run,
    latest_run,
    run_optimization_for_latest_tick,
    transaction_payload,
)

router = APIRouter(prefix="/optimization", tags=["optimization"])


@router.get("/latest", response_model=AllocationOut | None)
def latest_optimization(db: Session = Depends(get_db)) -> dict | None:  # type: ignore[type-arg]
    return allocation_payload(db, latest_run(db))


@router.post("/run", response_model=AllocationOut)
async def run_optimization(db: Session = Depends(get_db)) -> dict:  # type: ignore[type-arg]
    try:
        run = run_optimization_for_latest_tick(db)
    except SimulationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    payload = allocation_payload(db, run)
    await hub.broadcast(
        {
            "type": "optimization.completed",
            "seq": run.tick,
            "data": {
                "run_id": run.id,
                "allocated_kw": run.allocated_kw,
                "unmet_kw": run.unmet_kw,
                "execution_ms": run.execution_ms,
                "status": run.status,
            },
        }
    )
    assert payload is not None
    return payload


@router.post("/transactions/execute", response_model=ExecutionResultOut)
async def execute_latest(
    payload: ExecuteRequest, db: Session = Depends(get_db)
) -> dict:  # type: ignore[type-arg]
    run_id = payload.run_id
    if run_id is None:
        run = latest_run(db)
        if run is None:
            raise HTTPException(status_code=404, detail="No allocation proposal exists")
        run_id = run.id
    return await _execute(db, run_id)


@router.post("/{run_id}/execute", response_model=ExecutionResultOut)
async def execute_optimization(
    run_id: int, db: Session = Depends(get_db)
) -> dict:  # type: ignore[type-arg]
    return await _execute(db, run_id)


async def _execute(db: Session, run_id: int) -> dict:  # type: ignore[type-arg]
    run = db.get(AllocationRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Allocation run {run_id} not found")
    try:
        created = execute_allocation_run(db, run_id)
    except DuplicateExecution as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except SimulationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.refresh(run)
    allocation = allocation_payload(db, run)
    names = {household.id: household.name for household in db.scalars(select(Household)).all()}
    await hub.broadcast(
        {
            "type": "transaction.created",
            "seq": run.tick,
            "data": {"run_id": run.id, "count": len(created)},
        }
    )
    return {
        "allocation": allocation,
        "transactions": [transaction_payload(transaction, names) for transaction in created],
        "message": f"Executed {len(created)} simulated transaction(s). No financial settlement occurred.",
    }


@router.get("/runs", response_model=list[AllocationOut])
def list_runs(limit: int = 10, db: Session = Depends(get_db)) -> list[dict]:  # type: ignore[type-arg]
    runs = db.scalars(
        select(AllocationRun).order_by(AllocationRun.id.desc()).limit(max(1, min(limit, 50)))
    ).all()
    payloads = [allocation_payload(db, run) for run in runs]
    return [payload for payload in payloads if payload is not None]


@router.get("/stats", response_model=dict)
def optimization_stats(db: Session = Depends(get_db)) -> dict:  # type: ignore[type-arg]
    count = db.scalar(select(func.count()).select_from(AllocationRun)) or 0
    latest = latest_run(db)
    return {
        "runs": count,
        "latest_algorithm": latest.algorithm if latest else None,
        "latest_execution_ms": latest.execution_ms if latest else None,
        "latest_status": latest.status if latest else None,
        "network_trade_limit_kw": 4.0,
    }
