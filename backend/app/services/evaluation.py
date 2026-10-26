"""Static-vs-dynamic pricing evaluation.

Both strategies are replayed over the same weather profile, household
configuration and demand seed. The only difference is the price signal, which
changes seller participation through each household's reservation price.
Buyers' physical demand is inelastic.

Every reported metric is computed from the replay. Nothing is estimated,
projected or hard-coded.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from statistics import pstdev
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings as runtime
from ..models import AppSetting, EvaluationRun, Household, TickSnapshot
from ..utils import as_utc, iso, utcnow
from .allocation import BuyerRequest, SellerOffer, allocate_energy
from .battery import dispatch_battery
from .pricing import calculate_price, seller_participation
from .solar import effective_irradiance, estimate_demand_kw, estimate_generation_kw
from .weather import fetch_current_weather, fetch_forecast


@dataclass(slots=True)
class StrategySeries:
    ticks: int = 0


def _interpolate(rows: list[dict[str, Any]], moment: datetime, key: str) -> float | None:
    points: list[tuple[datetime, float]] = []
    for row in rows:
        stamp = row.get("timestamp")
        value = row.get(key)
        if not stamp or value is None:
            continue
        try:
            points.append((datetime.fromisoformat(stamp), float(value)))
        except (ValueError, TypeError):
            continue
    if not points:
        return None
    points.sort(key=lambda item: item[0])
    if moment <= points[0][0]:
        return points[0][1]
    if moment >= points[-1][0]:
        return points[-1][1]
    for index in range(len(points) - 1):
        left_t, left_v = points[index]
        right_t, right_v = points[index + 1]
        if left_t <= moment <= right_t:
            span = (right_t - left_t).total_seconds() or 1
            ratio = (moment - left_t).total_seconds() / span
            return left_v + (right_v - left_v) * ratio
    return points[-1][1]


def _replay(
    *,
    strategy: str,
    households: list[Household],
    config: AppSetting,
    weather_rows: list[dict[str, Any]],
    start: datetime,
    ticks: int,
    interval_seconds: int,
    cloud_pct: float,
    constant_irradiance: float | None,
    constant_temperature: float | None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    dt_hours = interval_seconds / 3600.0
    soc = {h.id: round(h.battery_capacity_kwh * 0.55, 4) for h in households}
    previous_price: float | None = None
    prices: list[float] = []
    traded_energy = 0.0
    unmet_energy = 0.0
    surplus_remaining = 0.0
    total_surplus = 0.0
    total_generation = 0.0
    total_demand = 0.0
    total_deficit_energy = 0.0
    peak_unmet = 0.0
    weighted_price_value = 0.0
    allocation_ms: list[float] = []
    transaction_count = 0
    series: list[dict[str, Any]] = []

    for index in range(ticks):
        moment = start + timedelta(seconds=interval_seconds * index)
        hour = moment.astimezone(ZoneInfo(runtime.timezone)).hour
        irradiance = (
            _interpolate(weather_rows, moment, "irradiance_w_m2")
            if weather_rows
            else constant_irradiance
        )
        temperature = (
            _interpolate(weather_rows, moment, "temperature_c") if weather_rows else constant_temperature
        )
        scenario_irradiance = effective_irradiance(irradiance, cloud_pct)

        computations = []
        for household in households:
            generation = estimate_generation_kw(
                household.solar_capacity_kw,
                scenario_irradiance,
                orientation_factor=household.orientation_factor,
                ambient_temperature_c=temperature,
            ) or 0.0
            demand = estimate_demand_kw(
                household.demand_base_kw,
                hour=hour,
                seed=runtime.simulation_seed,
                tick=index + 1,
                household_id=household.id,
            )
            net = generation - demand
            battery = dispatch_battery(
                soc_kwh=soc[household.id],
                capacity_kwh=household.battery_capacity_kwh,
                max_rate_kw=household.battery_max_rate_kw,
                surplus_kw=max(0.0, net),
                deficit_kw=max(0.0, -net),
                interval_seconds=interval_seconds,
            )
            soc[household.id] = battery.soc_kwh
            computations.append(
                {
                    "household": household,
                    "generation": generation,
                    "demand": demand,
                    "surplus": battery.surplus_kw,
                    "deficit": battery.deficit_kw,
                }
            )

        supply = round(sum(c["surplus"] for c in computations), 4)
        demand_total = round(sum(c["deficit"] for c in computations), 4)
        if strategy == "static":
            price = config.base_price_inr_kwh
            imbalance = round((demand_total - supply) / max(supply, demand_total, 0.001), 4)
        else:
            price_result = calculate_price(
                supply_kw=supply,
                demand_kw=demand_total,
                base_price_inr_kwh=config.base_price_inr_kwh,
                min_price_inr_kwh=config.min_price_inr_kwh,
                max_price_inr_kwh=config.max_price_inr_kwh,
                sensitivity=config.price_sensitivity,
                smoothing=config.price_smoothing,
                previous_price_inr_kwh=previous_price,
            )
            price = price_result.price_inr_kwh
            imbalance = price_result.imbalance
        previous_price = price
        prices.append(price)

        offers = []
        requests = []
        for comp in computations:
            household = comp["household"]
            reservation = config.base_price_inr_kwh * household.reservation_price_ratio
            participation = seller_participation(price, reservation)
            if comp["surplus"] > 0 and participation > 0:
                offers.append(
                    SellerOffer(
                        household.id,
                        min(comp["surplus"] * participation, runtime.max_trade_kw_per_household),
                    )
                )
            if comp["deficit"] > 0:
                requests.append(BuyerRequest(household.id, comp["deficit"]))

        allocation = allocate_energy(
            offers, requests, max_trade_kw=runtime.max_trade_kw_per_household
        )
        allocation_ms.append(allocation.execution_ms)
        transaction_count += len(allocation.items)
        traded_energy += allocation.allocated_kw * dt_hours
        unmet_energy += allocation.unmet_kw * dt_hours
        surplus_remaining += max(0.0, supply - allocation.allocated_kw) * dt_hours
        total_surplus += supply * dt_hours
        total_deficit_energy += demand_total * dt_hours
        total_generation += sum(c["generation"] for c in computations) * dt_hours
        total_demand += sum(c["demand"] for c in computations) * dt_hours
        peak_unmet = max(peak_unmet, allocation.unmet_kw)
        weighted_price_value += allocation.allocated_kw * dt_hours * price

        series.append(
            {
                "timestamp": iso(moment),
                "tick": index + 1,
                "generation_kw": round(sum(c["generation"] for c in computations), 4),
                "demand_kw": round(sum(c["demand"] for c in computations), 4),
                "physical_surplus_kw": supply,
                "physical_deficit_kw": demand_total,
                "price_inr_kwh": price,
                "imbalance": imbalance,
                "allocated_kw": allocation.allocated_kw,
                "unmet_kw": allocation.unmet_kw,
                "surplus_remaining_kw": round(max(0.0, supply - allocation.allocated_kw), 4),
                "energy_traded_kwh": round(allocation.allocated_kw * dt_hours, 4),
                "irradiance_w_m2": round(scenario_irradiance, 2) if scenario_irradiance is not None else None,
            }
        )

    average_price = round(weighted_price_value / traded_energy, 4) if traded_energy > 0 else None
    metrics = {
        "strategy": strategy,
        "energy_traded_kwh": round(traded_energy, 4),
        "unmet_demand_kwh": round(unmet_energy, 4),
        "unmet_demand_peak_kw": round(peak_unmet, 4),
        "demand_served_pct": round(min(100.0, traded_energy / total_deficit_energy * 100), 2)
        if total_deficit_energy > 0
        else None,
        "renewable_utilization_pct": round(min(100.0, traded_energy / total_surplus * 100), 2)
        if total_surplus > 0
        else None,
        "surplus_remaining_kwh": round(surplus_remaining, 4),
        "total_generation_kwh": round(total_generation, 4),
        "total_demand_kwh": round(total_demand, 4),
        "price_volatility_inr_kwh": round(pstdev(prices), 4) if len(prices) > 1 else 0.0,
        "average_price_inr_kwh": average_price,
        "average_transaction_price_inr_kwh": average_price,
        "min_price_inr_kwh": min(prices) if prices else None,
        "max_price_inr_kwh": max(prices) if prices else None,
        "allocation_avg_execution_ms": round(sum(allocation_ms) / len(allocation_ms), 4)
        if allocation_ms
        else 0.0,
        "transaction_count": transaction_count,
        "ticks": ticks,
    }
    return metrics, series


def compare_strategies(
    *,
    households: list[Household],
    config: AppSetting,
    weather_rows: list[dict[str, Any]],
    start: datetime,
    ticks: int,
    interval_seconds: int,
    cloud_pct: float,
    constant_irradiance: float | None,
    constant_temperature: float | None,
) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    static_metrics, static_series = _replay(
        strategy="static",
        households=households,
        config=config,
        weather_rows=weather_rows,
        start=start,
        ticks=ticks,
        interval_seconds=interval_seconds,
        cloud_pct=cloud_pct,
        constant_irradiance=constant_irradiance,
        constant_temperature=constant_temperature,
    )
    dynamic_metrics, dynamic_series = _replay(
        strategy="dynamic",
        households=households,
        config=config,
        weather_rows=weather_rows,
        start=start,
        ticks=ticks,
        interval_seconds=interval_seconds,
        cloud_pct=cloud_pct,
        constant_irradiance=constant_irradiance,
        constant_temperature=constant_temperature,
    )

    def pct_change(before: float | None, after: float | None) -> float | None:
        if before is None or after is None or abs(before) < 1e-9:
            return None
        return round((after - before) / abs(before) * 100, 2)

    comparison = {
        "unmet_demand_reduction_kwh": round(
            static_metrics["unmet_demand_kwh"] - dynamic_metrics["unmet_demand_kwh"], 4
        ),
        "unmet_demand_reduction_pct": (
            round(
                (
                    static_metrics["unmet_demand_kwh"]
                    - dynamic_metrics["unmet_demand_kwh"]
                )
                / static_metrics["unmet_demand_kwh"]
                * 100,
                2,
            )
            if static_metrics["unmet_demand_kwh"] > 0
            else None
        ),
        "energy_traded_change_kwh": round(
            dynamic_metrics["energy_traded_kwh"] - static_metrics["energy_traded_kwh"], 4
        ),
        "energy_traded_change_pct": pct_change(
            static_metrics["energy_traded_kwh"], dynamic_metrics["energy_traded_kwh"]
        ),
        "utilization_change_pp": (
            round(
                (dynamic_metrics["renewable_utilization_pct"] or 0.0)
                - (static_metrics["renewable_utilization_pct"] or 0.0),
                2,
            )
            if static_metrics["renewable_utilization_pct"] is not None
            and dynamic_metrics["renewable_utilization_pct"] is not None
            else None
        ),
        "price_volatility_change": round(
            dynamic_metrics["price_volatility_inr_kwh"] - static_metrics["price_volatility_inr_kwh"], 4
        ),
        "average_price_change_inr_kwh": (
            round(
                (dynamic_metrics["average_price_inr_kwh"] or 0.0)
                - (static_metrics["average_price_inr_kwh"] or 0.0),
                4,
            )
            if dynamic_metrics["average_price_inr_kwh"] is not None
            and static_metrics["average_price_inr_kwh"] is not None
            else None
        ),
    }
    series = [
        {"strategy": "static", "metrics": static_metrics, "series": static_series},
        {"strategy": "dynamic", "metrics": dynamic_metrics, "series": dynamic_series},
        {"strategy": "comparison", "comparison": comparison},
    ]
    return static_metrics, dynamic_metrics, series


async def run_evaluation(db: Session, *, ticks: int, cloud_cover_pct: float) -> dict[str, Any]:
    ticks = max(8, min(ticks, 96))
    config = db.get(AppSetting, 1)
    if config is None:
        from .simulation import ensure_defaults

        ensure_defaults(db)
        config = db.get(AppSetting, 1)
    assert config is not None

    current = await fetch_current_weather(db)
    if current.snapshot is None:
        raise RuntimeError(current.last_error or "Real weather data is required for evaluation")

    replay_hours = ticks * config.interval_seconds / 3600.0
    # Keep enough forecast horizon to reach the next daylight window when the
    # evaluation is launched after sunset, plus enough rows for the replay.
    forecast_hours = min(72, max(24, math.ceil(replay_hours) + 20))
    forecast = await fetch_forecast(db, hours=forecast_hours)
    weather_rows = forecast.rows
    daylight_rows = [
        row for row in weather_rows if float(row.get("irradiance_w_m2") or 0.0) >= 500.0
    ]
    if weather_rows:
        # Replay a representative daylight window. Starting at the current hour can
        # produce a zero-trade comparison after sunset, which says nothing about
        # the pricing strategies. Both strategies still receive identical inputs.
        start_row = daylight_rows[0] if daylight_rows else weather_rows[0]
        start = datetime.fromisoformat(start_row["timestamp"])
        weather_basis = (
            "mcp_hourly_forecast_daylight_window"
            if daylight_rows
            else "mcp_hourly_forecast"
        )
    else:
        start = utcnow().replace(second=0, microsecond=0)
        weather_basis = "current_observation_held_constant"

    households = db.scalars(
        select(Household)
        .where(Household.owner_user_id.is_(None))
        .order_by(Household.id)
    ).all()
    static_metrics, dynamic_metrics, series = compare_strategies(
        households=households,
        config=config,
        weather_rows=weather_rows,
        start=start,
        ticks=ticks,
        interval_seconds=config.interval_seconds,
        cloud_pct=cloud_cover_pct,
        constant_irradiance=current.snapshot.irradiance_w_m2,
        constant_temperature=current.snapshot.temperature_c,
    )

    latest_tick = db.scalars(select(TickSnapshot).order_by(TickSnapshot.tick.desc()).limit(1)).first()
    window_note = (
        "Replay starts at the first forecast hour with at least 500 W/m² irradiance so the comparison includes solar production."
        if daylight_rows
        else "Replay starts at the first available forecast hour."
    )
    notes = (
        f"{ticks} deterministic intervals of {config.interval_seconds}s, identical demand seeds and weather "
        f"for both strategies ({start.isoformat()}). Weather basis: {weather_basis}. {window_note} "
        "Static price = base tariff for every interval. Dynamic price uses the documented bounded "
        "imbalance formula. Seller participation depends on household reservation prices; buyer demand "
        "is inelastic. Allocation uses the same maximum-flow algorithm for both strategies. "
        "This is a simulated counterfactual, not measured field performance."
    )
    run = EvaluationRun(
        ticks=ticks,
        interval_seconds=config.interval_seconds,
        scenario_cloud_pct=cloud_cover_pct,
        weather_snapshot_id=current.snapshot.id,
        static_metrics=static_metrics,
        dynamic_metrics=dynamic_metrics,
        series=series,
        notes=notes,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    from .realtime import hub

    await hub.broadcast(
        {
            "type": "evaluation.completed",
            "seq": latest_tick.tick if latest_tick else 0,
            "data": {
                "evaluation_id": run.id,
                "ticks": ticks,
                "cloud_cover_pct": cloud_cover_pct,
                "weather_basis": weather_basis,
            },
        }
    )
    return evaluation_payload(run)


def evaluation_payload(run: EvaluationRun) -> dict[str, Any]:
    replay_start = next(
        (
            item["series"][0].get("timestamp")
            for item in run.series
            if item.get("strategy") == "dynamic" and item.get("series")
        ),
        None,
    )
    return {
        "id": run.id,
        "created_at": iso(run.created_at),
        "ticks": run.ticks,
        "interval_seconds": run.interval_seconds,
        "scenario_cloud_pct": run.scenario_cloud_pct,
        "weather_snapshot_id": run.weather_snapshot_id,
        "replay_start": replay_start,
        "static": run.static_metrics,
        "dynamic": run.dynamic_metrics,
        "comparison": next(
            (item["comparison"] for item in run.series if item.get("strategy") == "comparison"),
            {},
        ),
        "series": [item for item in run.series if item.get("strategy") != "comparison"],
        "notes": run.notes,
        "methodology": [
            "Both strategies replay the same household configuration, weather profile and demand seed.",
            "Static pricing holds the base tariff. Dynamic pricing is bounded by configured minimum and maximum prices.",
            "Sellers only offer surplus when the interval price meets their reservation price; this behavioural assumption is shared by both replays.",
            "Buyer demand is inelastic, and allocations use the same bipartite maximum-flow algorithm.",
            "Metrics are computed from replay results. No percentage is assumed in advance.",
        ],
    }
