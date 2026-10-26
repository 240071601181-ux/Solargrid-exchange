"""Transparent solar-generation model.

Power is a function of provider irradiance, installed capacity, a fixed
performance factor, roof orientation and an optional cell-temperature derate.
All outputs are estimates, never metered generation.
"""

from __future__ import annotations

from ..utils import clamp

PERFORMANCE_FACTOR = 0.86
TEMPERATURE_COEFFICIENT = -0.004  # per °C above 25 °C cell temperature
NOCT_C = 45.0


def effective_irradiance(provider_irradiance_w_m2: float | None, cloud_scenario_pct: float = 0.0) -> float | None:
    """Apply a synthetic cloud-cover overlay to an observed irradiance value.

    The provider irradiance already reflects real cloud conditions. The scenario
    overlay exists only for the cloud-cover demonstration and is always labeled.
    """
    if provider_irradiance_w_m2 is None:
        return None
    attenuation = clamp(cloud_scenario_pct, 0.0, 100.0) / 100.0 * 0.7
    return max(0.0, provider_irradiance_w_m2 * (1.0 - attenuation))


def cell_temperature_c(ambient_c: float | None, irradiance_w_m2: float) -> float | None:
    if ambient_c is None:
        return None
    return ambient_c + (NOCT_C - 20.0) / 800.0 * irradiance_w_m2


def estimate_generation_kw(
    capacity_kw: float,
    irradiance_w_m2: float | None,
    *,
    orientation_factor: float = 0.92,
    ambient_temperature_c: float | None = None,
    performance_factor: float = PERFORMANCE_FACTOR,
) -> float | None:
    """Estimate AC power in kW. Returns None when irradiance is unavailable."""
    if irradiance_w_m2 is None:
        return None
    irradiance = clamp(irradiance_w_m2, 0.0, 1200.0)
    cell_temp = cell_temperature_c(ambient_temperature_c, irradiance)
    derate = 1.0
    if cell_temp is not None:
        derate = 1.0 + TEMPERATURE_COEFFICIENT * (cell_temp - 25.0)
    derate = clamp(derate, 0.75, 1.05)
    power = capacity_kw * (irradiance / 1000.0) * performance_factor * orientation_factor * derate
    return round(clamp(power, 0.0, capacity_kw), 4)


DEMAND_PROFILE = (
    0.34, 0.30, 0.28, 0.28, 0.32, 0.48, 0.72, 0.90,
    1.02, 1.00, 0.94, 0.90, 0.92, 0.90, 0.86, 0.90,
    0.98, 1.16, 1.40, 1.48, 1.30, 1.04, 0.78, 0.52,
)


def demand_factor(hour: int) -> float:
    return DEMAND_PROFILE[hour % 24]


def estimate_demand_kw(
    base_kw: float,
    *,
    hour: int,
    seed: int,
    tick: int,
    household_id: str,
    variability: float = 0.06,
) -> float:
    """Deterministic simulated demand (not a smart-meter reading)."""
    import random

    rng = random.Random(f"{seed}:{tick}:{household_id}")
    noise = 1.0 + rng.uniform(-variability, variability)
    return round(max(0.05, base_kw * demand_factor(hour) * noise), 4)
