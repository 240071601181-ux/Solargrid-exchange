from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import func, select

from app.models import AppSetting, EvaluationRun, Household, WeatherSnapshot
from app.services.evaluation import compare_strategies, run_evaluation
from app.services.simulation import ensure_defaults
from app.services.weather import ForecastResult, WeatherResult


def seeded(db):  # type: ignore[no-untyped-def]
    ensure_defaults(db)
    config = db.get(AppSetting, 1)
    households = db.scalars(select(Household).order_by(Household.id)).all()
    assert config is not None
    assert len(households) == 8
    return config, list(households)


def weather_row(db) -> WeatherSnapshot:  # type: ignore[no-untyped-def]
    snapshot = WeatherSnapshot(
        kind="current",
        provider="open-meteo",
        transport="mcp-stdio",
        location_name="Test location",
        latitude=10.976,
        longitude=76.914,
        retrieved_at=datetime.now(timezone.utc),
        observed_at=datetime.now(timezone.utc),
        temperature_c=30.0,
        irradiance_w_m2=800.0,
        cloud_cover_pct=20.0,
        status="ok",
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


def test_replay_is_measured_and_keeps_physical_inputs_identical(db) -> None:  # type: ignore[no-untyped-def]
    config, households = seeded(db)
    static, dynamic, series = compare_strategies(
        households=households,
        config=config,
        weather_rows=[],
        start=datetime(2026, 10, 26, 7, 0, tzinfo=timezone.utc),
        ticks=24,
        interval_seconds=900,
        cloud_pct=30,
        constant_irradiance=800.0,
        constant_temperature=30.0,
    )

    assert len(series) == 3
    assert series[0]["strategy"] == "static"
    assert series[1]["strategy"] == "dynamic"
    assert series[2]["strategy"] == "comparison"
    static_series = series[0]["series"]
    dynamic_series = series[1]["series"]
    assert len(static_series) == len(dynamic_series) == 24
    assert series[0]["metrics"] == static
    assert series[1]["metrics"] == dynamic

    for static_point, dynamic_point in zip(static_series, dynamic_series, strict=True):
        assert static_point["timestamp"] == dynamic_point["timestamp"]
        assert static_point["generation_kw"] == pytest.approx(dynamic_point["generation_kw"])
        assert static_point["demand_kw"] == pytest.approx(dynamic_point["demand_kw"])
        assert static_point["physical_surplus_kw"] == pytest.approx(dynamic_point["physical_surplus_kw"])
        assert static_point["physical_deficit_kw"] == pytest.approx(dynamic_point["physical_deficit_kw"])
        assert config.min_price_inr_kwh <= dynamic_point["price_inr_kwh"] <= config.max_price_inr_kwh

    assert static["strategy"] == "static"
    assert dynamic["strategy"] == "dynamic"
    assert static["total_generation_kwh"] == pytest.approx(dynamic["total_generation_kwh"])
    assert static["total_demand_kwh"] == pytest.approx(dynamic["total_demand_kwh"])
    assert static["price_volatility_inr_kwh"] == 0
    assert dynamic["price_volatility_inr_kwh"] >= 0
    assert all(point["price_inr_kwh"] == config.base_price_inr_kwh for point in static_series)

    dt = 900 / 3600
    assert static["energy_traded_kwh"] == pytest.approx(
        sum(point["energy_traded_kwh"] for point in static_series), abs=0.01
    )
    assert static["unmet_demand_kwh"] == pytest.approx(
        sum(point["unmet_kw"] for point in static_series) * dt, abs=0.01
    )
    assert static["surplus_remaining_kwh"] == pytest.approx(
        sum(point["surplus_remaining_kw"] for point in static_series) * dt, abs=0.01
    )
    assert 0 <= static["transaction_count"] <= 24 * 64
    if static["average_transaction_price_inr_kwh"] is not None:
        assert static["average_transaction_price_inr_kwh"] == pytest.approx(config.base_price_inr_kwh)

    comparison = series[2]["comparison"]
    assert comparison["unmet_demand_reduction_kwh"] == pytest.approx(
        static["unmet_demand_kwh"] - dynamic["unmet_demand_kwh"], abs=0.0001
    )
    if static["unmet_demand_kwh"] > 0:
        assert comparison["unmet_demand_reduction_pct"] == pytest.approx(
            (static["unmet_demand_kwh"] - dynamic["unmet_demand_kwh"])
            / static["unmet_demand_kwh"]
            * 100,
            abs=0.01,
        )
    assert comparison["energy_traded_change_kwh"] == pytest.approx(
        dynamic["energy_traded_kwh"] - static["energy_traded_kwh"], abs=0.0001
    )
    assert comparison["utilization_change_pp"] == pytest.approx(
        (dynamic["renewable_utilization_pct"] or 0) - (static["renewable_utilization_pct"] or 0),
        abs=0.01,
    )


@pytest.mark.asyncio
async def test_evaluation_starts_at_a_representative_daylight_forecast_hour(db, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    seeded(db)
    snapshot = weather_row(db)
    rows = [
        {
            "timestamp": "2026-10-27T00:00:00+00:00",
            "irradiance_w_m2": 0.0,
            "temperature_c": 24.0,
        },
        {
            "timestamp": "2026-10-27T03:30:00+00:00",
            "irradiance_w_m2": 620.0,
            "temperature_c": 27.0,
        },
        {
            "timestamp": "2026-10-27T04:30:00+00:00",
            "irradiance_w_m2": 740.0,
            "temperature_c": 28.0,
        },
    ]

    async def current(_db, force=False):  # type: ignore[no-untyped-def]
        return WeatherResult(snapshot=snapshot, freshness="live", age_seconds=0)

    async def forecast(_db, hours, force=False):  # type: ignore[no-untyped-def]
        return ForecastResult(rows=rows, freshness="live")

    monkeypatch.setattr("app.services.evaluation.fetch_current_weather", current)
    monkeypatch.setattr("app.services.evaluation.fetch_forecast", forecast)

    payload = await run_evaluation(db, ticks=8, cloud_cover_pct=25)

    assert payload["replay_start"] == "2026-10-27T03:30:00+00:00"
    assert payload["series"][0]["series"][0]["timestamp"] == payload["replay_start"]
    assert payload["series"][1]["series"][0]["timestamp"] == payload["replay_start"]
    assert "first forecast hour with at least 500 W/m" in payload["notes"]


def test_replay_metrics_stay_within_physical_bounds(db) -> None:  # type: ignore[no-untyped-def]
    config, households = seeded(db)
    static, dynamic, _ = compare_strategies(
        households=households,
        config=config,
        weather_rows=[],
        start=datetime(2026, 10, 26, 7, 0, tzinfo=timezone.utc),
        ticks=12,
        interval_seconds=600,
        cloud_pct=0,
        constant_irradiance=1000.0,
        constant_temperature=28.0,
    )

    for metrics in (static, dynamic):
        assert metrics["energy_traded_kwh"] >= 0
        assert metrics["unmet_demand_kwh"] >= 0
        assert metrics["surplus_remaining_kwh"] >= 0
        assert metrics["transaction_count"] >= 0
        assert metrics["total_generation_kwh"] >= 0
        assert metrics["total_demand_kwh"] > 0
        if metrics["demand_served_pct"] is not None:
            assert 0 <= metrics["demand_served_pct"] <= 100
        if metrics["renewable_utilization_pct"] is not None:
            assert 0 <= metrics["renewable_utilization_pct"] <= 100
        assert config.min_price_inr_kwh <= metrics["min_price_inr_kwh"] <= config.max_price_inr_kwh
        assert config.min_price_inr_kwh <= metrics["max_price_inr_kwh"] <= config.max_price_inr_kwh


@pytest.mark.asyncio
async def test_evaluation_service_persists_a_real_replay(db, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    seeded(db)
    snapshot = weather_row(db)

    async def current(_db, force=False):  # type: ignore[no-untyped-def]
        return WeatherResult(snapshot=snapshot, freshness="live", age_seconds=0)

    async def forecast(_db, hours, force=False):  # type: ignore[no-untyped-def]
        return ForecastResult(rows=[], freshness="unavailable", error="test forecast unavailable")

    monkeypatch.setattr("app.services.evaluation.fetch_current_weather", current)
    monkeypatch.setattr("app.services.evaluation.fetch_forecast", forecast)

    payload = await run_evaluation(db, ticks=12, cloud_cover_pct=40)

    assert payload["id"] > 0
    assert payload["ticks"] == 12
    assert payload["scenario_cloud_pct"] == 40
    assert payload["weather_snapshot_id"] == snapshot.id
    assert len(payload["series"]) == 2
    assert payload["series"][0]["strategy"] == "static"
    assert payload["series"][1]["strategy"] == "dynamic"
    assert "unmet_demand_reduction_kwh" in payload["comparison"]
    assert "current_observation_held_constant" in payload["notes"]
    assert db.scalar(select(func.count()).select_from(EvaluationRun)) == 1

    stored = db.scalars(select(EvaluationRun)).one()
    assert stored.static_metrics == payload["static"]
    assert stored.dynamic_metrics == payload["dynamic"]


@pytest.mark.asyncio
async def test_evaluation_fails_honestly_without_weather(db, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    seeded(db)

    async def current(_db, force=False):  # type: ignore[no-untyped-def]
        return WeatherResult(snapshot=None, freshness="unavailable", last_error="MCP down")

    async def forecast(_db, hours, force=False):  # type: ignore[no-untyped-def]
        raise AssertionError("forecast must not be called when current weather is missing")

    monkeypatch.setattr("app.services.evaluation.fetch_current_weather", current)
    monkeypatch.setattr("app.services.evaluation.fetch_forecast", forecast)

    with pytest.raises(RuntimeError, match="MCP down"):
        await run_evaluation(db, ticks=12, cloud_cover_pct=0)
    assert db.scalar(select(func.count()).select_from(EvaluationRun)) == 0
