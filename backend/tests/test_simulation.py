from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import func, select

from app.config import settings as runtime
from app.models import (
    AllocationItem,
    AllocationRun,
    Household,
    HouseholdSnapshot,
    SimulationState,
    TickSnapshot,
    Transaction,
    WeatherSnapshot,
)
from app.services.battery import dispatch_battery
from app.services.simulation import advance_simulation, ensure_defaults, get_config
from app.services.weather import WeatherResult, WeatherUnavailable


def weather_snapshot(db, *, irradiance: float = 900.0) -> WeatherSnapshot:  # type: ignore[no-untyped-def]
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
        humidity_pct=54.0,
        cloud_cover_pct=10.0,
        wind_speed_ms=2.4,
        irradiance_w_m2=irradiance,
        is_day=True,
        status="ok",
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


@pytest.mark.asyncio
async def test_tick_energy_balance_constraints_and_persistence(db, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    ensure_defaults(db)
    config = get_config(db)
    config.auto_execute_trades = True
    config.interval_seconds = 900
    state = db.get(SimulationState, 1)
    assert state is not None
    state.cloud_scenario_pct = 50
    db.commit()

    snapshot = weather_snapshot(db)

    async def ready_weather(_db, force=False):  # type: ignore[no-untyped-def]
        return _ready_weather(snapshot)

    monkeypatch.setattr("app.services.simulation.fetch_current_weather", ready_weather)

    households_before = {
        household.id: {
            "soc_kwh": household.battery_soc_kwh,
            "capacity_kwh": household.battery_capacity_kwh,
            "max_rate_kw": household.battery_max_rate_kw,
        }
        for household in db.scalars(select(Household)).all()
    }

    payload = await advance_simulation(db, broadcast=False)
    tick = db.scalars(select(TickSnapshot)).one()
    run = db.scalars(select(AllocationRun)).one()
    transactions = db.scalars(select(Transaction).order_by(Transaction.id)).all()
    household_rows = db.scalars(select(HouseholdSnapshot).order_by(HouseholdSnapshot.household_id)).all()

    assert payload["type"] == "simulation.state_updated"
    assert payload["data"]["tick"] == 1
    assert tick.tick == 1
    assert tick.generation_kw > 0
    assert tick.demand_kw > 0
    assert tick.physical_surplus_kw >= 0
    assert tick.physical_deficit_kw >= 0

    # Recompute every battery independently. Generation/demand is not the same as
    # post-battery surplus/deficit while storage is charging or discharging.
    hours = 900 / 3600
    expected_surplus = 0.0
    expected_deficit = 0.0
    net_stored_kwh = 0.0
    for row in household_rows:
        before = households_before[row.household_id]
        net = row.generation_kw - row.demand_kw
        expected = dispatch_battery(
            soc_kwh=before["soc_kwh"],
            capacity_kwh=before["capacity_kwh"],
            max_rate_kw=before["max_rate_kw"],
            surplus_kw=max(0.0, net),
            deficit_kw=max(0.0, -net),
            interval_seconds=900,
        )
        assert row.battery_soc_kwh == pytest.approx(expected.soc_kwh, abs=0.0001)
        assert row.surplus_kw == pytest.approx(expected.surplus_kw, abs=0.0001)
        assert row.deficit_kw == pytest.approx(expected.deficit_kw, abs=0.0001)
        expected_surplus += expected.surplus_kw
        expected_deficit += expected.deficit_kw
        net_stored_kwh += expected.soc_kwh - before["soc_kwh"]

    assert tick.physical_surplus_kw == pytest.approx(expected_surplus, abs=0.001)
    assert tick.physical_deficit_kw == pytest.approx(expected_deficit, abs=0.001)
    # Energy balance including battery storage (kWh converted back to average kW).
    assert tick.generation_kw - tick.demand_kw == pytest.approx(
        tick.physical_surplus_kw - tick.physical_deficit_kw + net_stored_kwh / hours,
        abs=0.02,
    )

    assert tick.allocated_kw <= tick.offered_supply_kw + 0.001
    assert tick.allocated_kw <= tick.requested_demand_kw + 0.001
    assert tick.unmet_kw == pytest.approx(tick.requested_demand_kw - tick.allocated_kw, abs=0.001)
    assert tick.unallocated_kw == pytest.approx(tick.offered_supply_kw - tick.allocated_kw, abs=0.001)
    assert tick.energy_traded_kwh == pytest.approx(tick.allocated_kw * 900 / 3600, abs=0.0002)
    assert config.min_price_inr_kwh <= tick.price_inr_kwh <= config.max_price_inr_kwh

    assert len(household_rows) == 8
    for row in household_rows:
        assert row.generation_kw >= 0
        assert row.demand_kw > 0
        assert row.sell_offer_kw <= row.surplus_kw + 0.001
        assert row.buy_request_kw == pytest.approx(row.deficit_kw)
        assert row.served_kw <= row.buy_request_kw + 0.001
        assert row.sell_offer_kw <= runtime.max_trade_kw_per_household + 0.001
    assert sum(row.served_kw for row in household_rows) == pytest.approx(tick.allocated_kw, abs=0.001)

    assert run.status == "executed"
    assert run.executed_at is not None
    assert len(transactions) == payload["data"]["transactions_executed"]
    assert len(transactions) == len(run.items)
    assert run.allocated_kw == pytest.approx(tick.allocated_kw)
    for transaction in transactions:
        assert transaction.status == "executed"
        assert transaction.energy_kwh == pytest.approx(
            transaction.power_kw * transaction.interval_seconds / 3600, abs=0.0002
        )
        assert transaction.total_value_inr == pytest.approx(
            transaction.power_kw * transaction.interval_seconds / 3600 * transaction.price_inr_kwh,
            abs=0.001,
        )
        assert transaction.price_inr_kwh == pytest.approx(run.price_inr_kwh)
        assert transaction.run_id == run.id

    item_total = db.scalar(select(func.coalesce(func.sum(AllocationItem.power_kw), 0.0))) or 0.0
    assert item_total == pytest.approx(run.allocated_kw, abs=0.001)


def _ready_weather(snapshot: WeatherSnapshot) -> WeatherResult:
    return WeatherResult(snapshot=snapshot, freshness="live", age_seconds=0)


@pytest.mark.asyncio
async def test_missing_weather_aborts_tick_and_records_error(db, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    ensure_defaults(db)

    async def unavailable(_db, force=False):  # type: ignore[no-untyped-def]
        return WeatherResult(
            snapshot=None,
            freshness="unavailable",
            last_error="MCP provider unavailable",
        )

    monkeypatch.setattr("app.services.simulation.fetch_current_weather", unavailable)

    with pytest.raises(WeatherUnavailable):
        await advance_simulation(db, broadcast=False)

    state = db.get(SimulationState, 1)
    assert state is not None
    assert state.tick == 0
    assert "MCP provider unavailable" in (state.last_error or "")
    assert db.scalar(select(func.count()).select_from(TickSnapshot)) == 0
    assert db.scalar(select(func.count()).select_from(AllocationRun)) == 0
    assert db.scalar(select(func.count()).select_from(Transaction)) == 0
