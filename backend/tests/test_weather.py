from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app.models import WeatherSnapshot
from app.services import weather as weather_service
from app.services.simulation import ensure_defaults
from app.services.weather import WeatherUnavailable, fetch_current_weather, fetch_forecast, weather_status


def good_snapshot(db, *, age_seconds: int = 0) -> WeatherSnapshot:  # type: ignore[no-untyped-def]
    snapshot = WeatherSnapshot(
        kind="current",
        provider="open-meteo",
        transport="mcp-stdio",
        location_name="Test location",
        latitude=10.976,
        longitude=76.914,
        retrieved_at=datetime.now(timezone.utc) - timedelta(seconds=age_seconds),
        observed_at=datetime.now(timezone.utc) - timedelta(seconds=age_seconds),
        temperature_c=29.0,
        humidity_pct=60.0,
        cloud_cover_pct=15.0,
        wind_speed_ms=1.5,
        irradiance_w_m2=720.0,
        is_day=True,
        status="ok",
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


def test_freshness_boundaries() -> None:
    assert weather_service._freshness(None) == "unavailable"
    assert weather_service._freshness(0) == "live"
    assert weather_service._freshness(weather_service.settings.weather_stale_after_seconds) == "live"
    assert weather_service._freshness(weather_service.settings.weather_stale_after_seconds + 1) == "stale"
    assert weather_service._freshness(weather_service.settings.weather_expire_after_seconds + 1) == "expired"


@pytest.mark.asyncio
async def test_cached_observation_avoids_mcp_call(db, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    ensure_defaults(db)
    snapshot = good_snapshot(db)

    async def must_not_call(*_args, **_kwargs):  # type: ignore[no-untyped-def]
        raise AssertionError("MCP should not be called for a cache hit")

    monkeypatch.setattr(weather_service, "_call_mcp_tool", must_not_call)
    result = await fetch_current_weather(db)

    assert result.snapshot is not None
    assert result.snapshot.id == snapshot.id
    assert result.freshness == "live"
    assert result.age_seconds is not None and result.age_seconds < weather_service.settings.weather_cache_ttl_seconds
    assert db.scalar(select(func.count()).select_from(WeatherSnapshot).where(WeatherSnapshot.status == "error")) == 0


@pytest.mark.asyncio
async def test_missing_weather_raises_and_records_provider_error(db, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    ensure_defaults(db)

    async def unavailable(*_args, **_kwargs):  # type: ignore[no-untyped-def]
        raise WeatherUnavailable("MCP provider unavailable")

    monkeypatch.setattr(weather_service, "_call_mcp_tool", unavailable)

    with pytest.raises(WeatherUnavailable, match="MCP provider unavailable"):
        await fetch_current_weather(db, force=True)

    errors = db.scalars(select(WeatherSnapshot).where(WeatherSnapshot.status == "error")).all()
    assert len(errors) == 1
    assert errors[0].kind == "current"
    assert "MCP provider unavailable" in (errors[0].error or "")
    assert weather_status(db)["status"] == "unavailable"
    assert "MCP provider unavailable" in (weather_status(db)["last_error"] or "")


@pytest.mark.asyncio
async def test_stale_cached_observation_is_returned_with_a_visible_error(db, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    ensure_defaults(db)
    snapshot = good_snapshot(db, age_seconds=2_000)

    async def unavailable(*_args, **_kwargs):  # type: ignore[no-untyped-def]
        raise WeatherUnavailable("refresh failed")

    monkeypatch.setattr(weather_service, "_call_mcp_tool", unavailable)
    result = await fetch_current_weather(db, force=True)

    assert result.snapshot is not None
    assert result.snapshot.id == snapshot.id
    assert result.freshness == "stale"
    assert result.last_error == "refresh failed"
    assert result.last_attempt_at is not None


@pytest.mark.asyncio
async def test_forecast_failure_returns_unavailable_without_synthetic_rows(db, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    ensure_defaults(db)

    async def unavailable(*_args, **_kwargs):  # type: ignore[no-untyped-def]
        raise WeatherUnavailable("forecast provider unavailable")

    monkeypatch.setattr(weather_service, "_call_mcp_tool", unavailable)
    result = await fetch_forecast(db, hours=6)

    assert result.rows == []
    assert result.freshness == "unavailable"
    assert "forecast provider unavailable" in (result.error or "")


@pytest.mark.asyncio
async def test_cached_forecast_is_truncated_to_requested_horizon(db, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    ensure_defaults(db)
    rows = [
        {
            "timestamp": f"2026-10-26T{hour:02d}:00:00+05:30",
            "irradiance_w_m2": 500.0,
            "temperature_c": 30.0,
        }
        for hour in range(8)
    ]
    snapshot = WeatherSnapshot(
        kind="forecast",
        provider="open-meteo",
        transport="mcp-stdio",
        location_name="Test location",
        latitude=10.976,
        longitude=76.914,
        retrieved_at=datetime.now(timezone.utc),
        status="ok",
        raw_json={"hours": rows, "model_note": "test model"},
    )
    db.add(snapshot)
    db.commit()

    async def must_not_call(*_args, **_kwargs):  # type: ignore[no-untyped-def]
        raise AssertionError("MCP should not be called for a cache hit")

    monkeypatch.setattr(weather_service, "_call_mcp_tool", must_not_call)
    result = await fetch_forecast(db, hours=4)

    assert len(result.rows) == 4
    assert result.freshness == "live"
    assert result.provider == "open-meteo"
    assert result.model_note == "test model"


@pytest.mark.asyncio
async def test_short_cached_forecast_is_refreshed_for_a_longer_horizon(db, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    ensure_defaults(db)
    short_rows = [
        {
            "timestamp": f"2026-10-26T{hour:02d}:00:00+00:00",
            "irradiance_w_m2": 100.0,
            "temperature_c": 30.0,
        }
        for hour in range(4)
    ]
    snapshot = WeatherSnapshot(
        kind="forecast",
        provider="open-meteo",
        transport="mcp-stdio",
        location_name="Test location",
        latitude=10.976,
        longitude=76.914,
        retrieved_at=datetime.now(timezone.utc),
        status="ok",
        raw_json={"hours": short_rows},
    )
    db.add(snapshot)
    db.commit()

    calls = 0
    long_rows = [
        {
            "timestamp": f"2026-10-27T{hour:02d}:00:00+00:00",
            "irradiance_w_m2": 600.0,
            "temperature_c": 30.0,
        }
        for hour in range(8)
    ]

    async def fresh_forecast(*_args, **_kwargs):  # type: ignore[no-untyped-def]
        nonlocal calls
        calls += 1
        return {
            "status": "ok",
            "provider": "open-meteo",
            "location": {"latitude": 10.976, "longitude": 76.914},
            "hours": long_rows,
            "model_note": "test model",
        }

    monkeypatch.setattr(weather_service, "_call_mcp_tool", fresh_forecast)
    result = await fetch_forecast(db, hours=8)

    assert calls == 1
    assert len(result.rows) == 8
    assert result.rows[0]["timestamp"] == long_rows[0]["timestamp"]
