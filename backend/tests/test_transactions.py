from __future__ import annotations

import pytest
from sqlalchemy import func, select

from app.models import AllocationItem, AllocationRun, Household, Transaction
from app.services.simulation import DuplicateExecution, SimulationError, execute_allocation_run


def add_household(db, household_id: str, name: str) -> Household:  # type: ignore[no-untyped-def]
    household = Household(
        id=household_id,
        name=name,
        role_hint="test",
        solar_capacity_kw=1.0,
        demand_base_kw=0.5,
        battery_capacity_kwh=0.0,
        battery_soc_kwh=0.0,
        battery_max_rate_kw=0.0,
        reservation_price_ratio=1.0,
    )
    db.add(household)
    return household


def make_run(db, *, power_kw: float, price: float, interval: int) -> AllocationRun:  # type: ignore[no-untyped-def]
    add_household(db, "S1", "Seller One")
    add_household(db, "B1", "Buyer One")
    run = AllocationRun(
        tick=1,
        status="proposed",
        algorithm="bipartite_max_flow (Edmonds-Karp)",
        total_supply_kw=power_kw,
        total_demand_kw=power_kw,
        allocated_kw=power_kw,
        price_inr_kwh=price,
        interval_seconds=interval,
        notes="test run",
    )
    db.add(run)
    db.flush()
    db.add(AllocationItem(run_id=run.id, seller_id="S1", buyer_id="B1", power_kw=power_kw))
    db.commit()
    db.refresh(run)
    return run


def test_execution_persists_exact_energy_and_value(db) -> None:  # type: ignore[no-untyped-def]
    run = make_run(db, power_kw=2.0, price=7.5, interval=900)

    transactions = execute_allocation_run(db, run.id)

    assert len(transactions) == 1
    transaction = transactions[0]
    assert transaction.run_id == run.id
    assert transaction.seller_id == "S1"
    assert transaction.buyer_id == "B1"
    assert transaction.power_kw == 2.0
    assert transaction.interval_seconds == 900
    assert transaction.energy_kwh == pytest.approx(0.5)
    assert transaction.price_inr_kwh == 7.5
    assert transaction.total_value_inr == pytest.approx(3.75)
    assert transaction.status == "executed"
    assert transaction.executed_at is not None

    db.refresh(run)
    assert run.status == "executed"
    assert run.executed_at is not None
    assert db.scalar(select(func.count()).select_from(Transaction)) == 1


def test_duplicate_execution_is_rejected_without_new_rows(db) -> None:  # type: ignore[no-untyped-def]
    run = make_run(db, power_kw=1.25, price=8.0, interval=600)
    first = execute_allocation_run(db, run.id)
    assert len(first) == 1

    with pytest.raises(DuplicateExecution):
        execute_allocation_run(db, run.id)

    assert db.scalar(select(func.count()).select_from(Transaction)) == 1
    db.refresh(run)
    assert run.status == "executed"


def test_unknown_run_raises_simulation_error(db) -> None:  # type: ignore[no-untyped-def]
    with pytest.raises(SimulationError, match="does not exist"):
        execute_allocation_run(db, 9999)
