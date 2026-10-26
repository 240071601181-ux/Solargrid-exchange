from __future__ import annotations

import asyncio
import contextlib
import secrets
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.router import api_router
from .config import settings
from .db import SessionLocal, init_db
from .models import AppSetting, SimulationState
from .services.realtime import hub
from .services.security import ensure_bootstrap_admin, log_csrf_rejection
from .services.simulation import advance_simulation, ensure_defaults, get_state
from .services.weather import WeatherUnavailable, weather_status


async def _auto_tick_loop() -> None:
    last_tick = 0.0
    while True:
        await asyncio.sleep(0.5)
        try:
            with SessionLocal() as db:
                state = db.get(SimulationState, 1)
                config = db.get(AppSetting, 1)
                if state is None or config is None or state.status != "running":
                    last_tick = time.monotonic()
                    continue
                if time.monotonic() - last_tick < max(1.0, config.tick_seconds):
                    continue
                last_tick = time.monotonic()
                try:
                    await advance_simulation(db)
                except Exception as exc:
                    db.rollback()
                    state = db.get(SimulationState, 1)
                    if state is not None:
                        state.status = "error"
                        state.last_error = f"{type(exc).__name__}: {exc}"
                        state.seq += 1
                        db.commit()
                        await hub.broadcast(
                            {
                                "type": "simulation.error",
                                "seq": state.seq,
                                "data": {"message": state.last_error, "status": "error"},
                            }
                        )
        except Exception:
            # Keep the operations loop alive; individual failures are surfaced above.
            continue


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    with SessionLocal() as db:
        ensure_defaults(db)
        ensure_bootstrap_admin(db)
        state = get_state(db)
        if state.status == "running":
            state.status = "paused"
            state.last_error = "Server restarted; simulation paused. Press Start to resume."
            state.seq += 1
            db.commit()
    task = asyncio.create_task(_auto_tick_loop())
    yield
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "Peer-to-peer solar microgrid simulation. Weather is retrieved from Open-Meteo "
        "through a local MCP stdio server. Household demand, allocations and transactions are simulated."
    ),
    lifespan=lifespan,
)


@app.middleware("http")
async def csrf_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
    """Double-submit CSRF validation for every state-changing API request.

    The CSRF value is a readable same-site cookie while the session itself is
    HttpOnly. Cross-origin JavaScript cannot read the cookie, and the API's CORS
    policy only permits the configured frontend origins.
    """
    if (
        request.method in {"POST", "PUT", "PATCH", "DELETE"}
        and request.url.path.startswith(settings.api_prefix)
    ):
        header = request.headers.get("x-csrf-token")
        cookie = request.cookies.get(settings.csrf_cookie_name)
        if not header or not cookie or not secrets.compare_digest(header, cookie):
            log_csrf_rejection(request, "missing or mismatched double-submit token")
            return JSONResponse(status_code=403, content={"detail": "CSRF validation failed."})
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(WeatherUnavailable)
async def weather_unavailable_handler(_request, exc: WeatherUnavailable):  # type: ignore[no-untyped-def]
    return JSONResponse(
        status_code=503,
        content={"detail": f"Real weather data unavailable: {exc}"},
    )


app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:  # type: ignore[type-arg]
    return {
        "service": settings.app_name,
        "version": "1.0.0",
        "health": f"{settings.api_prefix}/health",
        "docs": "/docs",
        "websocket": "/ws/simulation",
    }


@app.websocket("/ws/simulation")
async def simulation_socket(websocket: WebSocket) -> None:
    await hub.connect(websocket)
    try:
        with SessionLocal() as db:
            state = get_state(db)
            weather = weather_status(db)
            await websocket.send_json(
                {
                    "type": "simulation.status",
                    "seq": state.seq,
                    "data": {
                        "status": state.status,
                        "tick": state.tick,
                        "weather_status": weather["status"],
                        "connected_at": datetime.now(timezone.utc).isoformat(),
                    },
                }
            )
        while True:
            message = await websocket.receive_text()
            if message == "ping":
                await websocket.send_json(
                    {"type": "pong", "seq": 0, "data": {"at": datetime.now(timezone.utc).isoformat()}}
                )
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await hub.disconnect(websocket)
