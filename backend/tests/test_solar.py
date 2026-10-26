from __future__ import annotations

import pytest

from app.services.solar import (
    cell_temperature_c,
    demand_factor,
    effective_irradiance,
    estimate_demand_kw,
    estimate_generation_kw,
)


def test_effective_irradiance_is_clamped_and_uses_documented_attenuation() -> None:
    assert effective_irradiance(None) is None
    assert effective_irradiance(1000, 0) == 1000
    assert effective_irradiance(1000, 50) == pytest.approx(650)
    assert effective_irradiance(1000, 100) == pytest.approx(300)
    assert effective_irradiance(1000, 200) == pytest.approx(300)
    assert effective_irradiance(1000, -20) == pytest.approx(1000)


def test_cell_temperature_matches_model_equation() -> None:
    assert cell_temperature_c(None, 800) is None
    assert cell_temperature_c(25, 800) == pytest.approx(50)
    assert cell_temperature_c(30, 1000) == pytest.approx(61.25)


def test_generation_estimate_respects_irradiance_capacity_and_temperature() -> None:
    assert estimate_generation_kw(3.0, None) is None
    assert estimate_generation_kw(3.0, 0) == 0
    assert estimate_generation_kw(3.0, 1000, orientation_factor=1.0) == pytest.approx(2.58)
    # At 1200 W/m² the raw power exceeds capacity, so the estimate is capped.
    assert estimate_generation_kw(3.0, 1200, orientation_factor=1.0) == pytest.approx(3.0)
    # Hot cells derate output; the exact expected value follows the documented coefficients.
    hot = estimate_generation_kw(3.0, 1000, orientation_factor=1.0, ambient_temperature_c=35)
    assert hot == pytest.approx(2.1543, abs=1e-4)
    assert hot < estimate_generation_kw(3.0, 1000, orientation_factor=1.0)


def test_negative_irradiance_produces_no_generation() -> None:
    assert estimate_generation_kw(4.0, -50) == 0


def test_demand_profile_wraps_hours_and_is_deterministic() -> None:
    assert demand_factor(0) == pytest.approx(0.34)
    assert demand_factor(18) == pytest.approx(1.40)
    assert demand_factor(24) == pytest.approx(0.34)
    assert demand_factor(25) == pytest.approx(0.30)

    first = estimate_demand_kw(1.0, hour=18, seed=42, tick=3, household_id="H-01")
    second = estimate_demand_kw(1.0, hour=18, seed=42, tick=3, household_id="H-01")
    other_tick = estimate_demand_kw(1.0, hour=18, seed=42, tick=4, household_id="H-01")

    assert first == second
    assert 1.0 * 1.40 * 0.94 <= first <= 1.0 * 1.40 * 1.06
    assert other_tick != first


def test_demand_has_a_positive_floor() -> None:
    assert estimate_demand_kw(0.0001, hour=2, seed=1, tick=1, household_id="H-99") == 0.05
