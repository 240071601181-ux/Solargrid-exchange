from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...db import get_db
from ...models import SimulationState
from ...schemas import ScenarioRequest, SimulationSnapshotOut, WeatherCurrentOut
from ...services.realtime import hub
from ...services.simulation import (
    SimulationError,
    advance_simulation,
    ensure_defaults,
    get_state,
    reset_simulation,
    simulation_payload,
)
from ...services.weather import current_payload, fetch_current_weather
from ...utils import iso

router = APIRouter(prefix="/simulation", tags=["simulation"])


async def _snapshot(db: Session, *, force_weather: bool = False) -> dict[str, Any]:
    result = await fetch_current_weather(db, force=force_weather)
    return simulation_payload(db, current_payload(result, db))


@router.get("/state", response_model=SimulationSnapshotOut)
async def state(db: Session = Depends(get_db)) -> dict[str, Any]:
    return await _snapshot(db)


@router.get("/dashboard", response_model=SimulationSnapshotOut)
async def dashboard(db: Session = Depends(get_db)) -> dict[str, Any]:
    return await _snapshot(db)


@router.get("/history", response_model=list[dict[str, Any]])
def history(limit: int = 48, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    from ...services.simulation import history_payload

    return history_payload(db, limit=max(1, min(limit, 288)))


@router.post("/start", response_model=SimulationSnapshotOut)
async def start(db: Session = Depends(get_db)) -> dict[str, Any]:
    ensure_defaults(db)
    current = get_state(db)
    current.status = "running"
    current.last_error = None
    current.seq += 1
    db.commit()
    await hub.broadcast(
        {"type": "simulation.status", "seq": current.seq, "data": {"status": "running"}}
    )
    try:
        await advance_simulation(db)
    except Exception as exc:
        message = str(exc)
        current = get_state(db)
        current.status = "error"
        current.last_error = message
        current.seq += 1
        db.commit()
        await hub.broadcast(
            {"type": "simulation.error", "seq": current.seq, "data": {"message": message}}
        )
        raise HTTPException(status_code=503, detail=f"Simulation could not start: {message}") from exc
    return await _snapshot(db)


@router.post("/pause", response_model=SimulationSnapshotOut)
async def pause(db: Session = Depends(get_db)) -> dict[str, Any]:
    current = get_state(db)
    current.status = "paused"
    current.seq += 1
    db.commit()
    await hub.broadcast(
        {"type": "simulation.status", "seq": current.seq, "data": {"status": "paused"}}
    )
    return await _snapshot(db)


@router.post("/step", response_model=SimulationSnapshotOut)
async def step(db: Session = Depends(get_db)) -> dict[str, Any]:
    current = get_state(db)
    if current.status in {"idle", "error"}:
        current.status = "paused"
        db.commit()
    try:
        await advance_simulation(db)
    except Exception as exc:
        message = str(exc)
        current = get_state(db)
        current.last_error = message
        current.seq += 1
        db.commit()
        await hub.broadcast(
            {"type": "simulation.error", "seq": current.seq, "data": {"message": message}}
        )
        raise HTTPException(status_code=503, detail=message) from exc
    return await _snapshot(db)


@router.post("/reset", response_model=SimulationSnapshotOut)
async def reset(db: Session = Depends(get_db)) -> dict[str, Any]:
    state_row = reset_simulation(db)
    await hub.broadcast(
        {"type": "simulation.status", "seq": state_row.seq, "data": {"status": state_row.status}}
    )
    return await _snapshot(db)


@router.post("/scenario/cloud", response_model=SimulationSnapshotOut)
async def cloud_scenario(payload: ScenarioRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    current = get_state(db)
    current.cloud_scenario_pct = payload.cloud_cover_pct
    if payload.cloud_cover_pct <= 0:
        current.scenario_label = "Live weather"
    else:
        current.scenario_label = f"Cloud-cover scenario: {payload.cloud_cover_pct:.0f}% attenuation overlay"
    current.seq += 1
    db.commit()
    await hub.broadcast(
        {
            "type": "scenario.started",
            "seq": current.seq,
            "data": {
                "cloud_cover_pct": payload.cloud_cover_pct,
                "scenario_label": current.scenario_label,
            },
        }
    )
    if payload.advance and current.status != "running":
        try:
            await advance_simulation(db)
        except Exception as exc:
            current = get_state(db)
            current.last_error = str(exc)
            db.commit()
            raise HTTPException(status_code=503, detail=str(exc)) from exc
    return await _snapshot(db)


@router.get("/status", response_model=dict[str, Any])
def status(db: Session = Depends(get_db)) -> dict[str, Any]:
    current = get_state(db)
    return {
        "status": current.status,
        "tick": current.tick,
        "seq": current.seq,
        "simulated_at": iso(current.simulated_at),
        "last_error": current.last_error,
        "cloud_scenario_pct": current.cloud_scenario_pct,
        "scenario_label": current.scenario_label,
    }
