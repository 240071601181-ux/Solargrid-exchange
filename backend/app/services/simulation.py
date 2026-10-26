"""Microgrid simulation orchestration.

All authoritative energy balances, trades, prices and transaction values are
computed here on the backend. The frontend only presents these results.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import delete, desc, func, select
from sqlalchemy.orm import Session

from ..config import settings as runtime
from ..models import (
    AllocationItem,
    AllocationRun,
    AppSetting,
    Household,
    HouseholdSnapshot,
    SimulationState,
    TickSnapshot,
    Transaction,
    EvaluationRun,
    WeatherSnapshot,
)
from ..utils import as_utc, iso, utcnow
from .allocation import BuyerRequest, SellerOffer, allocate_energy
from .battery import dispatch_battery
from .pricing import PriceResult, calculate_price, seller_participation
from .realtime import hub
from .solar import effective_irradiance, estimate_demand_kw, estimate_generation_kw
from .weather import WeatherResult, WeatherUnavailable, fetch_current_weather

TICK_INTERVAL_SECONDS = 300
_tick_lock = asyncio.Lock()


class SimulationError(RuntimeError):
    pass


class DuplicateExecution(SimulationError):
    pass


@dataclass(slots=True)
class HouseholdComputation:
    household: Household
    generation_kw: float | None
    demand_kw: float
    battery_soc_kwh: float
    surplus_kw: float
    deficit_kw: float
    sell_offer_kw: float
    buy_request_kw: float
    status: str
    served_kw: float = 0.0


DEFAULT_HOUSEHOLDS = (
    # id, name, role, capacity kW, orientation, demand base kW, battery kWh, reservation ratio
    ("H-01", "Ravi Kumar", "residential", 3.0, 0.95, 0.80, 5.0, 0.78),
    ("H-02", "Lakshmi Devi", "residential", 2.2, 0.88, 0.55, 4.0, 0.86),
    ("H-03", "Arjun Patel", "residential", 2.6, 0.92, 0.90, 6.0, 0.92),
    ("H-04", "Meena Stores", "small enterprise", 4.0, 0.86, 1.20, 8.0, 0.82),
    ("H-05", "Suresh Gowda", "residential", 1.0, 1.00, 1.25, 0.0, 0.80),
    ("H-06", "Fatima Begum", "residential", 2.4, 0.90, 0.70, 3.0, 0.94),
    ("H-07", "Ganesh Iyer", "residential", 2.8, 0.94, 0.85, 5.0, 0.76),
    ("H-08", "Priya Nair", "residential", 0.8, 0.84, 1.10, 0.0, 0.88),
)


def ensure_defaults(db: Session) -> None:
    config = db.get(AppSetting, 1)
    if config is None:
        db.add(
            AppSetting(
                id=1,
                base_price_inr_kwh=runtime.base_price_inr_kwh,
                min_price_inr_kwh=runtime.min_price_inr_kwh,
                max_price_inr_kwh=runtime.max_price_inr_kwh,
                price_sensitivity=runtime.price_sensitivity,
                price_smoothing=runtime.price_smoothing,
                forecast_horizon_hours=runtime.weather_forecast_hours,
                tick_seconds=runtime.simulation_tick_seconds,
                interval_seconds=runtime.simulation_interval_seconds,
                auto_execute_trades=runtime.auto_execute_trades,
                latitude=runtime.latitude,
                longitude=runtime.longitude,
                location_name=runtime.location_name,
            )
        )

    household_count = db.scalar(select(func.count()).select_from(Household)) or 0
    if household_count == 0:
        for household_id, name, role, capacity, orientation, demand, battery, reservation in DEFAULT_HOUSEHOLDS:
            max_rate = round(battery * 0.05, 2)
            db.add(
                Household(
                    id=household_id,
                    name=name,
                    role_hint=role,
                    solar_capacity_kw=capacity,
                    orientation_factor=orientation,
                    demand_base_kw=demand,
                    battery_capacity_kwh=battery,
                    battery_soc_kwh=round(battery * 0.55, 2),
                    battery_max_rate_kw=max_rate,
                    reservation_price_ratio=reservation,
                )
            )

    state = db.get(SimulationState, 1)
    if state is None:
        state = SimulationState(
            id=1,
            status="idle",
            tick=0,
            seq=0,
            simulated_at=utcnow(),
            cloud_scenario_pct=0.0,
            scenario_label="Live weather",
        )
        db.add(state)

    db.commit()


def get_config(db: Session) -> AppSetting:
    config = db.get(AppSetting, 1)
    if config is None:
        ensure_defaults(db)
        config = db.get(AppSetting, 1)
    assert config is not None
    return config


def get_state(db: Session) -> SimulationState:
    state = db.get(SimulationState, 1)
    if state is None:
        ensure_defaults(db)
        state = db.get(SimulationState, 1)
    assert state is not None
    return state


def latest_tick(db: Session) -> TickSnapshot | None:
    return db.scalars(select(TickSnapshot).order_by(desc(TickSnapshot.tick)).limit(1)).first()


def latest_run(db: Session) -> AllocationRun | None:
    return db.scalars(select(AllocationRun).order_by(desc(AllocationRun.id)).limit(1)).first()


def _local_hour(moment: datetime) -> int:
    aware = as_utc(moment) or utcnow()
    return aware.astimezone(ZoneInfo(runtime.timezone)).hour


def _trade_status(sell_offer: float, buy_request: float) -> str:
    if sell_offer > 0.001:
        return "seller"
    if buy_request > 0.001:
        return "buyer"
    return "balanced"


async def advance_simulation(db: Session, *, force_weather: bool = False, broadcast: bool = True) -> dict[str, Any]:
    """Advance one deterministic simulation step using the latest real weather input."""
    async with _tick_lock:
        config = get_config(db)
        state = get_state(db)
        weather = await fetch_current_weather(db, force=force_weather)
        if weather.snapshot is None or weather.freshness == "expired":
            message = weather.last_error or "No current weather observation is available."
            state.last_error = f"Weather data unavailable: {message}"
            state.seq += 1
            db.commit()
            await _broadcast_error(state, message)
            raise WeatherUnavailable(message)

        interval = config.interval_seconds
        next_tick = state.tick + 1
        simulated_at = (as_utc(state.simulated_at) or utcnow()) + timedelta(seconds=interval)
        hour = _local_hour(simulated_at)

        provider_irradiance = weather.snapshot.irradiance_w_m2
        scenario_irradiance = effective_irradiance(provider_irradiance, state.cloud_scenario_pct)
        ambient = weather.snapshot.temperature_c

        computations: list[HouseholdComputation] = []
        for household in db.scalars(select(Household).order_by(Household.id)).all():
            generation = estimate_generation_kw(
                household.solar_capacity_kw,
                scenario_irradiance,
                orientation_factor=household.orientation_factor,
                ambient_temperature_c=ambient,
            )
            generation_value = generation if generation is not None else 0.0
            demand = estimate_demand_kw(
                household.demand_base_kw,
                hour=hour,
                seed=runtime.simulation_seed,
                tick=next_tick,
                household_id=household.id,
            )
            net = generation_value - demand
            battery = dispatch_battery(
                soc_kwh=household.battery_soc_kwh,
                capacity_kwh=household.battery_capacity_kwh,
                max_rate_kw=household.battery_max_rate_kw,
                surplus_kw=max(0.0, net),
                deficit_kw=max(0.0, -net),
                interval_seconds=interval,
            )
            household.battery_soc_kwh = battery.soc_kwh
            computations.append(
                HouseholdComputation(
                    household=household,
                    generation_kw=generation,
                    demand_kw=demand,
                    battery_soc_kwh=battery.soc_kwh,
                    surplus_kw=battery.surplus_kw,
                    deficit_kw=battery.deficit_kw,
                    sell_offer_kw=0.0,
                    buy_request_kw=battery.deficit_kw,
                    status="balanced",
                )
            )

        physical_supply = round(sum(c.surplus_kw for c in computations), 4)
        physical_demand = round(sum(c.deficit_kw for c in computations), 4)
        previous = latest_tick(db)
        price = calculate_price(
            supply_kw=physical_supply,
            demand_kw=physical_demand,
            base_price_inr_kwh=config.base_price_inr_kwh,
            min_price_inr_kwh=config.min_price_inr_kwh,
            max_price_inr_kwh=config.max_price_inr_kwh,
            sensitivity=config.price_sensitivity,
            smoothing=config.price_smoothing,
            previous_price_inr_kwh=previous.price_inr_kwh if previous else None,
        )

        withheld = 0
        for comp in computations:
            reservation = config.base_price_inr_kwh * comp.household.reservation_price_ratio
            participation = seller_participation(price.price_inr_kwh, reservation)
            if comp.surplus_kw > 0:
                comp.sell_offer_kw = min(
                    comp.surplus_kw * participation, runtime.max_trade_kw_per_household
                )
            if comp.surplus_kw > 0 and participation < 0.999:
                withheld += 1
            comp.status = _trade_status(comp.sell_offer_kw, comp.buy_request_kw)

        allocation = allocate_energy(
            [SellerOffer(c.household.id, c.sell_offer_kw) for c in computations if c.sell_offer_kw > 0],
            [BuyerRequest(c.household.id, c.buy_request_kw) for c in computations if c.buy_request_kw > 0],
            max_trade_kw=runtime.max_trade_kw_per_household,
        )

        served_by_buyer: dict[str, float] = {}
        for item in allocation.items:
            served_by_buyer[item.buyer_id] = served_by_buyer.get(item.buyer_id, 0.0) + item.power_kw
        for comp in computations:
            comp.served_kw = round(served_by_buyer.get(comp.household.id, 0.0), 4)

        state.tick = next_tick
        state.simulated_at = simulated_at
        state.last_error = None
        state.seq += 1
        state.status = state.status if state.status == "running" else state.status

        for comp in computations:
            db.add(
                HouseholdSnapshot(
                    tick=next_tick,
                    household_id=comp.household.id,
                    simulated_at=simulated_at,
                    generation_kw=comp.generation_kw or 0.0,
                    demand_kw=comp.demand_kw,
                    battery_soc_kwh=comp.battery_soc_kwh,
                    surplus_kw=comp.surplus_kw,
                    deficit_kw=comp.deficit_kw,
                    sell_offer_kw=comp.sell_offer_kw,
                    buy_request_kw=comp.buy_request_kw,
                    served_kw=comp.served_kw,
                    status=comp.status,
                )
            )

        tick_row = TickSnapshot(
            tick=next_tick,
            simulated_at=simulated_at,
            generation_kw=round(sum(c.generation_kw or 0.0 for c in computations), 4),
            demand_kw=round(sum(c.demand_kw for c in computations), 4),
            physical_surplus_kw=physical_supply,
            physical_deficit_kw=physical_demand,
            offered_supply_kw=round(sum(c.sell_offer_kw for c in computations), 4),
            requested_demand_kw=round(sum(c.buy_request_kw for c in computations), 4),
            allocated_kw=allocation.allocated_kw,
            unmet_kw=allocation.unmet_kw,
            unallocated_kw=allocation.unallocated_kw,
            energy_traded_kwh=round(allocation.allocated_kw * interval / 3600, 4),
            price_inr_kwh=price.price_inr_kwh,
            base_price_inr_kwh=price.base_price_inr_kwh,
            imbalance=price.imbalance,
            cloud_cover_pct=weather.snapshot.cloud_cover_pct,
            irradiance_w_m2=provider_irradiance,
            effective_irradiance_w_m2=scenario_irradiance,
            pricing_reason=price.reason,
            weather_snapshot_id=weather.snapshot.id,
            scenario_label=state.scenario_label,
        )
        db.add(tick_row)
        db.flush()

        notes = (
            f"Maximum-flow allocation over {len(allocation.items)} links. "
            f"Household trade limit {runtime.max_trade_kw_per_household:.1f} kW. "
            f"{withheld} surplus household(s) released less than their full surplus at the current price."
        )
        run = AllocationRun(
            tick=next_tick,
            status="proposed",
            algorithm=allocation.algorithm,
            objective_value=allocation.objective_value,
            execution_ms=allocation.execution_ms,
            total_supply_kw=allocation.total_supply_kw,
            total_demand_kw=allocation.total_demand_kw,
            allocated_kw=allocation.allocated_kw,
            unmet_kw=allocation.unmet_kw,
            unallocated_kw=allocation.unallocated_kw,
            price_inr_kwh=price.price_inr_kwh,
            interval_seconds=interval,
            notes=notes,
        )
        db.add(run)
        db.flush()
        for item in allocation.items:
            db.add(
                AllocationItem(
                    run_id=run.id,
                    seller_id=item.seller_id,
                    buyer_id=item.buyer_id,
                    power_kw=item.power_kw,
                )
            )
        db.commit()
        db.refresh(run)

        if config.auto_execute_trades and allocation.items:
            executed = execute_allocation_run(db, run.id)
        else:
            executed = []

        payload = {
            "type": "simulation.state_updated",
            "seq": state.seq,
            "data": {
                "tick": state.tick,
                "status": state.status,
                "simulated_at": iso(state.simulated_at),
                "price_inr_kwh": price.price_inr_kwh,
                "allocated_kw": allocation.allocated_kw,
                "unmet_kw": allocation.unmet_kw,
                "energy_traded_kwh": tick_row.energy_traded_kwh,
                "run_id": run.id,
                "run_status": "executed" if executed else "proposed",
                "weather_freshness": weather.freshness,
                "transactions_executed": len(executed),
            },
        }
        if broadcast:
            await hub.broadcast(payload)
            if executed:
                await hub.broadcast(
                    {
                        "type": "transaction.created",
                        "seq": state.seq,
                        "data": {"tick": state.tick, "count": len(executed), "run_id": run.id},
                    }
                )
            await hub.broadcast(
                {
                    "type": "pricing.updated",
                    "seq": state.seq,
                    "data": {"price_inr_kwh": price.price_inr_kwh, "imbalance": price.imbalance},
                }
            )
            await hub.broadcast(
                {
                    "type": "optimization.completed",
                    "seq": state.seq,
                    "data": {
                        "run_id": run.id,
                        "allocated_kw": allocation.allocated_kw,
                        "execution_ms": allocation.execution_ms,
                        "status": "executed" if executed else "proposed",
                    },
                }
            )
        return payload


async def _broadcast_error(state: SimulationState, message: str) -> None:
    await hub.broadcast(
        {
            "type": "simulation.error",
            "seq": state.seq,
            "data": {"message": message, "status": state.status},
        }
    )


def execute_allocation_run(db: Session, run_id: int) -> list[Transaction]:
    run = db.get(AllocationRun, run_id)
    if run is None:
        raise SimulationError(f"Allocation run {run_id} does not exist")
    if run.status == "executed":
        raise DuplicateExecution(f"Allocation run {run_id} has already been executed")

    existing = db.scalar(select(func.count()).select_from(Transaction).where(Transaction.run_id == run_id)) or 0
    if existing:
        run.status = "executed"
        db.commit()
        raise DuplicateExecution(f"Allocation run {run_id} already has transactions")

    created: list[Transaction] = []
    for item in run.items:
        energy_kwh = item.power_kw * run.interval_seconds / 3600.0
        total_value = energy_kwh * run.price_inr_kwh
        transaction = Transaction(
            run_id=run.id,
            seller_id=item.seller_id,
            buyer_id=item.buyer_id,
            power_kw=item.power_kw,
            interval_seconds=run.interval_seconds,
            energy_kwh=round(energy_kwh, 4),
            price_inr_kwh=run.price_inr_kwh,
            total_value_inr=round(total_value, 4),
            status="executed",
            executed_at=utcnow(),
        )
        db.add(transaction)
        created.append(transaction)
    run.status = "executed"
    run.executed_at = utcnow()
    db.commit()
    for transaction in created:
        db.refresh(transaction)
    return created


def run_optimization_for_latest_tick(db: Session) -> AllocationRun:
    """Re-run allocation against the latest household state, yielding a new proposal."""
    tick = latest_tick(db)
    if tick is None:
        raise SimulationError("No simulation tick exists yet. Advance the simulation first.")
    rows = db.scalars(
        select(HouseholdSnapshot).where(HouseholdSnapshot.tick == tick.tick).order_by(HouseholdSnapshot.household_id)
    ).all()
    if not rows:
        raise SimulationError("No household snapshot is available for the latest tick.")

    allocation = allocate_energy(
        [SellerOffer(row.household_id, row.sell_offer_kw) for row in rows if row.sell_offer_kw > 0],
        [BuyerRequest(row.household_id, row.buy_request_kw) for row in rows if row.buy_request_kw > 0],
        max_trade_kw=runtime.max_trade_kw_per_household,
    )
    run = AllocationRun(
        tick=tick.tick,
        status="proposed",
        algorithm=allocation.algorithm,
        objective_value=allocation.objective_value,
        execution_ms=allocation.execution_ms,
        total_supply_kw=allocation.total_supply_kw,
        total_demand_kw=allocation.total_demand_kw,
        allocated_kw=allocation.allocated_kw,
        unmet_kw=allocation.unmet_kw,
        unallocated_kw=allocation.unallocated_kw,
        price_inr_kwh=tick.price_inr_kwh,
        interval_seconds=get_config(db).interval_seconds,
        notes=(
            f"Manual re-run on tick {tick.tick}. Bipartite maximum flow with a "
            f"{runtime.max_trade_kw_per_household:.1f} kW household trade limit. "
            "Proposed trades are not executed until confirmed."
        ),
    )
    db.add(run)
    db.flush()
    for item in allocation.items:
        db.add(
            AllocationItem(
                run_id=run.id,
                seller_id=item.seller_id,
                buyer_id=item.buyer_id,
                power_kw=item.power_kw,
            )
        )
    db.commit()
    db.refresh(run)
    return run


def reset_simulation(db: Session) -> SimulationState:
    state = get_state(db)
    db.execute(delete(Transaction))
    run_ids = list(db.scalars(select(AllocationRun.id)).all())
    if run_ids:
        db.execute(delete(AllocationItem).where(AllocationItem.run_id.in_(run_ids)))
    db.execute(delete(AllocationRun))
    db.execute(delete(HouseholdSnapshot))
    db.execute(delete(TickSnapshot))
    db.execute(delete(EvaluationRun))
    for household in db.scalars(select(Household)).all():
        household.battery_soc_kwh = round(household.battery_capacity_kwh * 0.55, 2)
    state.status = "idle"
    state.tick = 0
    state.seq += 1
    state.simulated_at = utcnow()
    state.cloud_scenario_pct = 0.0
    state.scenario_label = "Live weather"
    state.last_error = None
    db.commit()
    return state


def _household_payload(db: Session, state: SimulationState) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(HouseholdSnapshot)
        .where(HouseholdSnapshot.tick == state.tick)
        .order_by(HouseholdSnapshot.household_id)
    ).all()
    by_id = {row.household_id: row for row in rows}
    households = db.scalars(select(Household).order_by(Household.id)).all()
    payload: list[dict[str, Any]] = []
    for household in households:
        row = by_id.get(household.id)
        soc_pct = (
            round(household.battery_soc_kwh / household.battery_capacity_kwh * 100, 1)
            if household.battery_capacity_kwh > 0
            else None
        )
        payload.append(
            {
                "id": household.id,
                "name": household.name,
                "role_hint": household.role_hint,
                "solar_capacity_kw": household.solar_capacity_kw,
                "generation_kw": row.generation_kw if row else None,
                "demand_kw": row.demand_kw if row else None,
                "net_power_kw": round(row.generation_kw - row.demand_kw, 4) if row else None,
                "surplus_kw": row.surplus_kw if row else None,
                "deficit_kw": row.deficit_kw if row else None,
                "available_selling_kw": row.sell_offer_kw if row else None,
                "requested_buying_kw": row.buy_request_kw if row else None,
                "unmet_demand_kw": round(row.buy_request_kw - row.served_kw, 4) if row else None,
                "served_kw": row.served_kw if row else None,
                "battery_capacity_kwh": household.battery_capacity_kwh,
                "battery_soc_kwh": household.battery_soc_kwh,
                "battery_soc_pct": soc_pct,
                "reservation_price_inr_kwh": round(
                    household.reservation_price_ratio * (get_config(db).base_price_inr_kwh), 2
                ),
                "status": row.status if row else "unavailable",
                "withheld_kw": round(row.surplus_kw - row.sell_offer_kw, 4) if row else None,
            }
        )
    return payload


def allocation_payload(db: Session, run: AllocationRun | None = None) -> dict[str, Any] | None:
    run = run or latest_run(db)
    if run is None:
        return None
    names = {household.id: household.name for household in db.scalars(select(Household)).all()}
    items = [
        {
            "id": item.id,
            "seller_id": item.seller_id,
            "seller_name": names.get(item.seller_id, item.seller_id),
            "buyer_id": item.buyer_id,
            "buyer_name": names.get(item.buyer_id, item.buyer_id),
            "power_kw": item.power_kw,
            "energy_kwh": round(item.power_kw * run.interval_seconds / 3600, 4),
            "value_inr": round(item.power_kw * run.interval_seconds / 3600 * run.price_inr_kwh, 2),
        }
        for item in run.items
    ]
    return {
        "id": run.id,
        "tick": run.tick,
        "status": run.status,
        "algorithm": run.algorithm,
        "objective_value": run.objective_value,
        "execution_ms": run.execution_ms,
        "total_supply_kw": run.total_supply_kw,
        "total_demand_kw": run.total_demand_kw,
        "allocated_kw": run.allocated_kw,
        "unmet_kw": run.unmet_kw,
        "unallocated_kw": run.unallocated_kw,
        "price_inr_kwh": run.price_inr_kwh,
        "interval_seconds": run.interval_seconds,
        "notes": run.notes,
        "created_at": iso(run.created_at),
        "executed_at": iso(run.executed_at),
        "items": items,
    }


def history_payload(db: Session, limit: int = 48) -> list[dict[str, Any]]:
    rows = db.scalars(select(TickSnapshot).order_by(desc(TickSnapshot.tick)).limit(limit)).all()
    return [
        {
            "tick": row.tick,
            "simulated_at": iso(row.simulated_at),
            "generation_kw": row.generation_kw,
            "demand_kw": row.demand_kw,
            "surplus_kw": row.physical_surplus_kw,
            "deficit_kw": row.physical_deficit_kw,
            "allocated_kw": row.allocated_kw,
            "unmet_kw": row.unmet_kw,
            "unallocated_kw": row.unallocated_kw,
            "energy_traded_kwh": row.energy_traded_kwh,
            "price_inr_kwh": row.price_inr_kwh,
            "base_price_inr_kwh": row.base_price_inr_kwh,
            "imbalance": row.imbalance,
            "cloud_cover_pct": row.cloud_cover_pct,
            "irradiance_w_m2": row.irradiance_w_m2,
            "effective_irradiance_w_m2": row.effective_irradiance_w_m2,
            "scenario_label": row.scenario_label,
        }
        for row in reversed(rows)
    ]


def simulation_payload(db: Session, weather_payload: dict[str, Any] | None = None) -> dict[str, Any]:
    state = get_state(db)
    config = get_config(db)
    tick = latest_tick(db)
    households = _household_payload(db, state)
    allocation = allocation_payload(db)
    transactions = db.scalars(
        select(Transaction)
        .where(Transaction.status == "executed")
        .order_by(desc(Transaction.executed_at), desc(Transaction.id))
        .limit(6)
    ).all()
    names = {household.id: household.name for household in db.scalars(select(Household)).all()}
    total_traded = db.scalar(select(func.coalesce(func.sum(Transaction.energy_kwh), 0.0))) or 0.0
    recent = [
        {
            "id": transaction.id,
            "seller_id": transaction.seller_id,
            "seller_name": names.get(transaction.seller_id, transaction.seller_id),
            "buyer_id": transaction.buyer_id,
            "buyer_name": names.get(transaction.buyer_id, transaction.buyer_id),
            "power_kw": transaction.power_kw,
            "interval_seconds": transaction.interval_seconds,
            "energy_kwh": transaction.energy_kwh,
            "price_inr_kwh": transaction.price_inr_kwh,
            "total_value_inr": transaction.total_value_inr,
            "status": transaction.status,
            "created_at": iso(transaction.created_at),
            "executed_at": iso(transaction.executed_at),
            "run_id": transaction.run_id,
        }
        for transaction in transactions
    ]
    active_transactions = db.scalar(
        select(func.count())
        .select_from(Transaction)
        .where(Transaction.status == "executed", Transaction.run_id == (allocation or {}).get("id", -1))
    ) or 0

    return {
        "state": {
            "status": state.status,
            "tick": state.tick,
            "seq": state.seq,
            "simulated_at": iso(state.simulated_at),
            "cloud_scenario_pct": state.cloud_scenario_pct,
            "scenario_label": state.scenario_label,
            "last_error": state.last_error,
            "tick_seconds": config.tick_seconds,
            "interval_seconds": config.interval_seconds,
            "auto_execute_trades": config.auto_execute_trades,
        },
        "weather": weather_payload,
        "totals": {
            "generation_kw": tick.generation_kw if tick else None,
            "demand_kw": tick.demand_kw if tick else None,
            "surplus_kw": tick.physical_surplus_kw if tick else None,
            "deficit_kw": tick.physical_deficit_kw if tick else None,
            "offered_supply_kw": tick.offered_supply_kw if tick else None,
            "allocated_kw": tick.allocated_kw if tick else None,
            "unmet_kw": tick.unmet_kw if tick else None,
            "unallocated_kw": tick.unallocated_kw if tick else None,
            "energy_traded_kwh": round(total_traded, 4),
            "tick_energy_traded_kwh": tick.energy_traded_kwh if tick else None,
            "price_inr_kwh": tick.price_inr_kwh if tick else None,
            "base_price_inr_kwh": config.base_price_inr_kwh,
            "min_price_inr_kwh": config.min_price_inr_kwh,
            "max_price_inr_kwh": config.max_price_inr_kwh,
            "imbalance": tick.imbalance if tick else None,
            "pricing_reason": tick.pricing_reason if tick else None,
            "active_households": len(households),
            "active_transactions": active_transactions,
            "cloud_cover_pct": tick.cloud_cover_pct if tick else None,
            "irradiance_w_m2": tick.irradiance_w_m2 if tick else None,
            "effective_irradiance_w_m2": tick.effective_irradiance_w_m2 if tick else None,
        },
        "pricing": _pricing_payload(tick, config),
        "households": households,
        "allocation": allocation,
        "recent_transactions": recent,
        "history": history_payload(db),
    }


def _pricing_payload(tick: TickSnapshot | None, config: AppSetting) -> dict[str, Any]:
    base = config.base_price_inr_kwh
    return {
        "price_inr_kwh": tick.price_inr_kwh if tick else base,
        "base_price_inr_kwh": base,
        "min_price_inr_kwh": config.min_price_inr_kwh,
        "max_price_inr_kwh": config.max_price_inr_kwh,
        "imbalance": tick.imbalance if tick else 0.0,
        "supply_kw": tick.physical_surplus_kw if tick else 0.0,
        "demand_kw": tick.physical_deficit_kw if tick else 0.0,
        "reason": tick.pricing_reason if tick else "No tick has run yet.",
        "sensitivity": config.price_sensitivity,
        "smoothing": config.price_smoothing,
    }


def transaction_payload(transaction: Transaction, names: dict[str, str]) -> dict[str, Any]:
    return {
        "id": transaction.id,
        "run_id": transaction.run_id,
        "seller_id": transaction.seller_id,
        "seller_name": names.get(transaction.seller_id, transaction.seller_id),
        "buyer_id": transaction.buyer_id,
        "buyer_name": names.get(transaction.buyer_id, transaction.buyer_id),
        "power_kw": transaction.power_kw,
        "interval_seconds": transaction.interval_seconds,
        "energy_kwh": transaction.energy_kwh,
        "price_inr_kwh": transaction.price_inr_kwh,
        "total_value_inr": transaction.total_value_inr,
        "status": transaction.status,
        "created_at": iso(transaction.created_at),
        "executed_at": iso(transaction.executed_at),
    }


def latest_weather_snapshot(db: Session) -> WeatherSnapshot | None:
    return db.scalars(
        select(WeatherSnapshot)
        .where(WeatherSnapshot.kind == "current", WeatherSnapshot.status == "ok")
        .order_by(desc(WeatherSnapshot.retrieved_at))
        .limit(1)
    ).first()
