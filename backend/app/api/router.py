from __future__ import annotations

from fastapi import APIRouter, Depends

from ..services.security import enforce_csrf, require_admin, require_authenticated
from .routes import (
    auth,
    buyer,
    evaluation,
    forecast,
    health,
    households,
    market,
    metrics,
    optimization,
    seller,
    settings,
    shared,
    simulation,
    transactions,
    weather,
)

api_router = APIRouter(dependencies=[Depends(enforce_csrf)])
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(shared.router)
api_router.include_router(weather.router, dependencies=[Depends(require_authenticated)])
api_router.include_router(forecast.router, dependencies=[Depends(require_authenticated)])
api_router.include_router(market.router)
api_router.include_router(seller.router)
api_router.include_router(buyer.router)
api_router.include_router(households.router, dependencies=[Depends(require_admin)])
api_router.include_router(simulation.router, dependencies=[Depends(require_admin)])
api_router.include_router(optimization.router, dependencies=[Depends(require_admin)])
api_router.include_router(transactions.router, dependencies=[Depends(require_admin)])
api_router.include_router(evaluation.router, dependencies=[Depends(require_admin)])
api_router.include_router(settings.router, dependencies=[Depends(require_admin)])
api_router.include_router(metrics.router)
