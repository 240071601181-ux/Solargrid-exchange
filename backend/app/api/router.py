from __future__ import annotations

from fastapi import APIRouter

from .routes import (
    evaluation,
    forecast,
    health,
    households,
    metrics,
    optimization,
    settings,
    simulation,
    transactions,
    weather,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(weather.router)
api_router.include_router(households.router)
api_router.include_router(simulation.router)
api_router.include_router(forecast.router)
api_router.include_router(optimization.router)
api_router.include_router(transactions.router)
api_router.include_router(evaluation.router)
api_router.include_router(settings.router)
api_router.include_router(metrics.router)
