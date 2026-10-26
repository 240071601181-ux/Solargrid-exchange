from __future__ import annotations

import pytest

from app.services.pricing import (
    calculate_price,
    seller_participation,
    supply_demand_imbalance,
)


def price(supply: float, demand: float, **overrides: object):
    arguments = {
        "base_price_inr_kwh": 6.0,
        "min_price_inr_kwh": 3.0,
        "max_price_inr_kwh": 12.0,
        "sensitivity": 3.0,
        "smoothing": 0.65,
    }
    arguments.update(overrides)
    return calculate_price(supply_kw=supply, demand_kw=demand, **arguments)


def test_imbalance_is_bounded_and_signed() -> None:
    assert supply_demand_imbalance(0, 0) == 0
    assert supply_demand_imbalance(10, 0) == -1
    assert supply_demand_imbalance(0, 10) == 1
    assert supply_demand_imbalance(10, 5) == pytest.approx(-0.5)
    assert supply_demand_imbalance(-10, 5) == 1


def test_price_moves_toward_bounds_and_never_leaves_them() -> None:
    surplus = price(10, 0)
    deficit = price(0, 10)
    extreme_deficit = price(0, 10, sensitivity=100)

    assert surplus.price_inr_kwh == 3.0
    assert deficit.price_inr_kwh == 9.0
    assert extreme_deficit.price_inr_kwh == 12.0
    assert extreme_deficit.target_inr_kwh == 12.0


def test_previous_price_is_clamped_before_smoothing() -> None:
    result = price(10, 0, previous_price_inr_kwh=100)
    # Previous is clamped to 12, target is the floor 3.
    assert result.price_inr_kwh == pytest.approx(0.65 * 12 + 0.35 * 3)
    assert result.min_price_inr_kwh <= result.price_inr_kwh <= result.max_price_inr_kwh

    result = price(0, 10, previous_price_inr_kwh=-100)
    assert result.price_inr_kwh == pytest.approx(0.65 * 3 + 0.35 * 9)


def test_smoothing_is_bounded_and_reason_is_populated() -> None:
    result = price(0, 10, smoothing=5.0)
    assert 3.0 <= result.price_inr_kwh <= 12.0
    assert "Deficit" in result.reason

    result = price(10, 0, smoothing=-1.0)
    assert "Surplus" in result.reason

    result = price(0, 0)
    assert result.price_inr_kwh == 6.0
    assert "base tariff" in result.reason.lower()


def test_seller_participation_curve_is_monotonic_and_bounded() -> None:
    reservation = 8.0
    assert seller_participation(0, reservation) == 0
    assert seller_participation(5.6, reservation) == 0
    assert seller_participation(8.0, reservation) == pytest.approx(0.6)
    assert seller_participation(9.6, reservation) == 1
    assert seller_participation(100, reservation) == 1
    assert seller_participation(7.2, 0) == 1

    points = [seller_participation(price, reservation) for price in (5.6, 6.4, 7.2, 8.0, 8.8, 9.6)]
    assert points == sorted(points)
    assert all(0.0 <= value <= 1.0 for value in points)
