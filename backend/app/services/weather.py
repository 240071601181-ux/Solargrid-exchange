from __future__ import annotations

import asyncio
import json
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import AppSetting, WeatherSnapshot
from ..utils import as_utc, utcnow


class WeatherUnavailable(RuntimeError):
    """Raised when no usable live or cached weather observation exists."""


@dataclass(slots=True)
class WeatherResult:
    snapshot: WeatherSnapshot | None
    freshness: str
    age_seconds: int | None = None
    last_error: str | None = None
    last_attempt_at: datetime | None = None
    provider: str = "open-meteo"
    transport: str = "mcp-stdio"
    mcp_server: str = "open-meteo-weather"

    @property
    def usable(self) -> bool:
        return self.snapshot is not None and self.freshness in {"live", "stale"}


@dataclass(slots=True)
class ForecastResult:
    rows: list[dict[str, Any]] = field(default_factory=list)
    retrieved_at: datetime | None = None
    provider: str = "open-meteo"
    transport: str = "mcp-stdio"
    freshness: str = "unavailable"
    error: str | None = None
    model_note: str = ""
    mcp_server: str = "open-meteo-weather"


_lock = asyncio.Lock()
_forecast_lock = asyncio.Lock()


def _latest(db: Session, kind: str, status: str | None = None) -> WeatherSnapshot | None:
    stmt = select(WeatherSnapshot).where(WeatherSnapshot.kind == kind)
    if status:
        stmt = stmt.where(WeatherSnapshot.status == status)
    stmt = stmt.order_by(desc(WeatherSnapshot.retrieved_at), desc(WeatherSnapshot.id)).limit(1)
    return db.scalars(stmt).first()


def _age_seconds(snapshot: WeatherSnapshot | None) -> int | None:
    retrieved = as_utc(snapshot.retrieved_at) if snapshot else None
    if not retrieved:
        return None
    return max(0, int((utcnow() - retrieved).total_seconds()))


def _freshness(age: int | None) -> str:
    if age is None:
        return "unavailable"
    if age <= settings.weather_stale_after_seconds:
        return "live"
    if age <= settings.weather_expire_after_seconds:
        return "stale"
    return "expired"


def _location(db: Session) -> AppSetting | None:
    return db.get(AppSetting, 1)


async def _call_mcp_tool(tool: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Open a genuine MCP stdio session, invoke a tool, and close it."""
    if not settings.weather_mcp_enabled:
        raise WeatherUnavailable("Weather MCP integration is disabled (WEATHER_MCP_ENABLED=false).")

    script_path = Path(settings.weather_mcp_script)
    if not script_path.exists():
        raise WeatherUnavailable(f"Weather MCP server script not found: {script_path}")

    command = settings.weather_mcp_command or sys.executable
    params = StdioServerParameters(
        command=command,
        args=[str(script_path)],
        env={"PYTHONUNBUFFERED": "1"},
    )

    async def _run() -> dict[str, Any]:
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool(tool, arguments)
                if result.isError:
                    raise WeatherUnavailable(f"MCP tool {tool} returned an error result")
                if not result.content:
                    raise WeatherUnavailable(f"MCP tool {tool} returned no content")
                block = result.content[0]
                text = getattr(block, "text", None)
                if text is None:
                    raise WeatherUnavailable(f"MCP tool {tool} returned non-text content")
                return json.loads(text)

    try:
        return await asyncio.wait_for(_run(), timeout=settings.weather_mcp_timeout_seconds)
    except TimeoutError as exc:
        raise WeatherUnavailable(
            f"MCP weather request timed out after {settings.weather_mcp_timeout_seconds:.0f}s"
        ) from exc


def _record_error(db: Session, kind: str, message: str) -> None:
    db.add(
        WeatherSnapshot(
            kind=kind,
            provider="open-meteo",
            transport="mcp-stdio",
            location_name=settings.location_name,
            latitude=settings.latitude,
            longitude=settings.longitude,
            retrieved_at=utcnow(),
            status="error",
            error=message,
        )
    )
    db.commit()


async def fetch_current_weather(db: Session, force: bool = False) -> WeatherResult:
    """Return the latest MCP observation, refreshing it when the cache is older than the TTL.

    A stale-but-real observation is returned with an explicit freshness status if the
    provider is temporarily unavailable. No synthetic weather is ever substituted.
    """
    last_good = _latest(db, "current", "ok")
    age = _age_seconds(last_good)
    if not force and age is not None and age < settings.weather_cache_ttl_seconds:
        return WeatherResult(snapshot=last_good, freshness=_freshness(age), age_seconds=age)

    async with _lock:
        # Another request may have refreshed while we waited for the lock.
        last_good = _latest(db, "current", "ok")
        age = _age_seconds(last_good)
        if not force and age is not None and age < settings.weather_cache_ttl_seconds:
            return WeatherResult(snapshot=last_good, freshness=_freshness(age), age_seconds=age)

        config = _location(db)
        latitude = config.latitude if config else settings.latitude
        longitude = config.longitude if config else settings.longitude
        location_name = config.location_name if config else settings.location_name
        try:
            payload = await _call_mcp_tool(
                "get_current_weather",
                {
                    "latitude": latitude,
                    "longitude": longitude,
                    "timezone_name": settings.timezone,
                },
            )
            if payload.get("status") != "ok":
                raise WeatherUnavailable(payload.get("error") or "Weather provider returned an error")
            if payload.get("irradiance_w_m2") is None:
                raise WeatherUnavailable("Weather provider did not return shortwave irradiance")

            snapshot = WeatherSnapshot(
                kind="current",
                provider=str(payload.get("provider", "open-meteo")),
                transport="mcp-stdio",
                location_name=location_name,
                latitude=float(payload["location"]["latitude"]),
                longitude=float(payload["location"]["longitude"]),
                retrieved_at=utcnow(),
                observed_at=_parse_dt(payload.get("observed_at")),
                temperature_c=_as_float(payload.get("temperature_c")),
                humidity_pct=_as_float(payload.get("humidity_pct")),
                cloud_cover_pct=_as_float(payload.get("cloud_cover_pct")),
                wind_speed_ms=_as_float(payload.get("wind_speed_ms")),
                irradiance_w_m2=_as_float(payload.get("irradiance_w_m2")),
                is_day=payload.get("is_day"),
                status="ok",
                raw_json=payload,
            )
            db.add(snapshot)
            db.commit()
            db.refresh(snapshot)
            return WeatherResult(snapshot=snapshot, freshness="live", age_seconds=0)
        except Exception as exc:
            message = str(exc) if isinstance(exc, WeatherUnavailable) else f"{type(exc).__name__}: {exc}"
            _record_error(db, "current", message)
            last_good = _latest(db, "current", "ok")
            age = _age_seconds(last_good)
            freshness = _freshness(age)
            if last_good and freshness in {"live", "stale"}:
                return WeatherResult(
                    snapshot=last_good,
                    freshness=freshness,
                    age_seconds=age,
                    last_error=message,
                    last_attempt_at=utcnow(),
                )
            raise WeatherUnavailable(message) from exc


async def fetch_forecast(db: Session, hours: int, force: bool = False) -> ForecastResult:
    last_good = _latest(db, "forecast", "ok")
    age = _age_seconds(last_good)
    if not force and last_good and age is not None and age < settings.weather_cache_ttl_seconds:
        rows = (last_good.raw_json or {}).get("hours", [])
        if len(rows) >= hours:
            return ForecastResult(
                rows=rows[:hours],
                retrieved_at=as_utc(last_good.retrieved_at),
                provider=last_good.provider,
                freshness=_freshness(age),
                model_note=(last_good.raw_json or {}).get("model_note", ""),
            )

    async with _forecast_lock:
        last_good = _latest(db, "forecast", "ok")
        age = _age_seconds(last_good)
        if not force and last_good and age is not None and age < settings.weather_cache_ttl_seconds:
            rows = (last_good.raw_json or {}).get("hours", [])
            if len(rows) >= hours:
                return ForecastResult(
                    rows=rows[:hours],
                    retrieved_at=as_utc(last_good.retrieved_at),
                    provider=last_good.provider,
                    freshness=_freshness(age),
                    model_note=(last_good.raw_json or {}).get("model_note", ""),
                )

        config = _location(db)
        latitude = config.latitude if config else settings.latitude
        longitude = config.longitude if config else settings.longitude
        location_name = config.location_name if config else settings.location_name
        try:
            payload = await _call_mcp_tool(
                "get_weather_forecast",
                {
                    "latitude": latitude,
                    "longitude": longitude,
                    "timezone_name": settings.timezone,
                    "hours": max(1, min(hours, 72)),
                },
            )
            if payload.get("status") != "ok":
                raise WeatherUnavailable(payload.get("error") or "Forecast provider returned an error")
            rows = payload.get("hours") or []
            if not rows:
                raise WeatherUnavailable("Forecast provider returned no hourly rows")
            snapshot = WeatherSnapshot(
                kind="forecast",
                provider=str(payload.get("provider", "open-meteo")),
                transport="mcp-stdio",
                location_name=location_name,
                latitude=float(payload["location"]["latitude"]),
                longitude=float(payload["location"]["longitude"]),
                retrieved_at=utcnow(),
                observed_at=_parse_dt(rows[0].get("timestamp")),
                status="ok",
                raw_json=payload,
            )
            db.add(snapshot)
            db.commit()
            return ForecastResult(
                rows=rows,
                retrieved_at=snapshot.retrieved_at,
                provider=snapshot.provider,
                freshness="live",
                model_note=str(payload.get("model_note", "")),
            )
        except Exception as exc:
            message = str(exc) if isinstance(exc, WeatherUnavailable) else f"{type(exc).__name__}: {exc}"
            _record_error(db, "forecast", message)
            last_good = _latest(db, "forecast", "ok")
            age = _age_seconds(last_good)
            freshness = _freshness(age)
            if last_good and freshness in {"live", "stale"}:
                return ForecastResult(
                    rows=(last_good.raw_json or {}).get("hours", [])[:hours],
                    retrieved_at=as_utc(last_good.retrieved_at),
                    provider=last_good.provider,
                    freshness=freshness,
                    error=message,
                    model_note=(last_good.raw_json or {}).get("model_note", ""),
                )
            return ForecastResult(freshness="unavailable", error=message)


def weather_status(db: Session) -> dict[str, Any]:
    last_good = _latest(db, "current", "ok")
    last_error = _latest(db, "current", "error")
    age = _age_seconds(last_good)
    return {
        "provider": "open-meteo",
        "transport": "mcp-stdio",
        "mcp_server": "open-meteo-weather",
        "enabled": settings.weather_mcp_enabled,
        "status": _freshness(age) if last_good else "unavailable",
        "age_seconds": age,
        "last_retrieved_at": last_good.retrieved_at if last_good else None,
        "last_attempt_at": last_error.retrieved_at if last_error else None,
        "last_error": last_error.error if last_error else None,
        "cache_ttl_seconds": settings.weather_cache_ttl_seconds,
    }


def current_payload(result: WeatherResult, db: Session | None = None) -> dict[str, Any]:
    snapshot = result.snapshot
    status = result.freshness
    if snapshot is None and db is not None:
        status = "unavailable"
    return {
        "provider": snapshot.provider if snapshot else result.provider,
        "transport": snapshot.transport if snapshot else result.transport,
        "mcp_server": result.mcp_server,
        "status": status,
        "age_seconds": result.age_seconds,
        "retrieved_at": snapshot.retrieved_at if snapshot else None,
        "observed_at": snapshot.observed_at if snapshot else None,
        "location_name": snapshot.location_name if snapshot else None,
        "latitude": snapshot.latitude if snapshot else None,
        "longitude": snapshot.longitude if snapshot else None,
        "temperature_c": snapshot.temperature_c if snapshot else None,
        "humidity_pct": snapshot.humidity_pct if snapshot else None,
        "cloud_cover_pct": snapshot.cloud_cover_pct if snapshot else None,
        "wind_speed_ms": snapshot.wind_speed_ms if snapshot else None,
        "irradiance_w_m2": snapshot.irradiance_w_m2 if snapshot else None,
        "is_day": snapshot.is_day if snapshot else None,
        "last_error": result.last_error,
        "last_attempt_at": result.last_attempt_at,
        "cache_ttl_seconds": settings.weather_cache_ttl_seconds,
        "note": (
            "Current conditions retrieved through an MCP stdio session from Open-Meteo. "
            "Irradiance is the provider's shortwave radiation field, not an on-site sensor."
        )
        if snapshot
        else "No real weather observation is available. Nothing has been substituted.",
    }


def _parse_dt(value: str | None):  # type: ignore[no-untyped-def]
    if not value:
        return None
    try:
        from datetime import datetime

        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _as_float(value: Any) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None
