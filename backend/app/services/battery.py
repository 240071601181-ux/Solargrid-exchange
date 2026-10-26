from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class BatteryResult:
    soc_kwh: float
    surplus_kw: float
    deficit_kw: float
    charged_kwh: float
    discharged_kwh: float


def dispatch_battery(
    *,
    soc_kwh: float,
    capacity_kwh: float,
    max_rate_kw: float,
    surplus_kw: float,
    deficit_kw: float,
    interval_seconds: int,
) -> BatteryResult:
    """Move energy through a battery for one interval, respecting C-rate and SOC limits."""
    soc = max(0.0, min(soc_kwh, capacity_kwh))
    hours = interval_seconds / 3600.0
    charged = 0.0
    discharged = 0.0

    if capacity_kwh > 0 and max_rate_kw > 0 and hours > 0:
        if surplus_kw > 0:
            charged = min(surplus_kw * hours, max_rate_kw * hours, max(0.0, capacity_kwh - soc))
            soc += charged
        elif deficit_kw > 0:
            discharged = min(deficit_kw * hours, max_rate_kw * hours, soc)
            soc -= discharged

    return BatteryResult(
        soc_kwh=round(soc, 4),
        surplus_kw=round(max(0.0, surplus_kw - charged / hours), 4) if hours else surplus_kw,
        deficit_kw=round(max(0.0, deficit_kw - discharged / hours), 4) if hours else deficit_kw,
        charged_kwh=round(charged, 4),
        discharged_kwh=round(discharged, 4),
    )
