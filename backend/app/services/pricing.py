"""Supply/demand responsive price model.

price_target = base + sensitivity * imbalance
price        = clamp(previous * smoothing + target * (1 - smoothing), min, max)

imbalance = (demand - supply) / max(demand, supply, epsilon)

The model is intentionally small, bounded and documented. It is not a market
clearing engine and transaction volume is not derived from price.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..utils import clamp


@dataclass(slots=True)
class PriceResult:
    price_inr_kwh: float
    base_price_inr_kwh: float
    min_price_inr_kwh: float
    max_price_inr_kwh: float
    imbalance: float
    supply_kw: float
    demand_kw: float
    target_inr_kwh: float
    reason: str


def supply_demand_imbalance(supply_kw: float, demand_kw: float) -> float:
    supply = max(0.0, supply_kw)
    demand = max(0.0, demand_kw)
    denominator = max(supply, demand, 0.001)
    return clamp((demand - supply) / denominator, -1.0, 1.0)


def seller_participation(price_inr_kwh: float, reservation_price_inr_kwh: float) -> float:
    """Fraction of physical surplus a seller offers at a given price.

    Sellers progressively release stored/curtailable surplus as the price rises
    relative to their reservation price. The curve is documented, bounded and
    shared by the live simulation and the static-vs-dynamic replay.
    """
    if reservation_price_inr_kwh <= 0:
        return 1.0
    ratio = price_inr_kwh / reservation_price_inr_kwh
    return round(clamp((ratio - 0.70) / 0.50, 0.0, 1.0), 4)


def calculate_price(
    *,
    supply_kw: float,
    demand_kw: float,
    base_price_inr_kwh: float,
    min_price_inr_kwh: float,
    max_price_inr_kwh: float,
    sensitivity: float,
    smoothing: float = 0.65,
    previous_price_inr_kwh: float | None = None,
) -> PriceResult:
    imbalance = supply_demand_imbalance(supply_kw, demand_kw)
    target = clamp(base_price_inr_kwh + sensitivity * imbalance, min_price_inr_kwh, max_price_inr_kwh)

    if previous_price_inr_kwh is None:
        price = target
    else:
        weight = clamp(smoothing, 0.0, 0.95)
        previous = clamp(previous_price_inr_kwh, min_price_inr_kwh, max_price_inr_kwh)
        price = weight * previous + (1.0 - weight) * target

    price = round(clamp(price, min_price_inr_kwh, max_price_inr_kwh), 2)

    if demand_kw <= 0.001 and supply_kw <= 0.001:
        reason = "No active surplus or deficit; price held at the base tariff."
    elif imbalance > 0.15:
        reason = (
            f"Deficit of {demand_kw - supply_kw:.2f} kW against available supply. "
            f"Price moved above the ₹{base_price_inr_kwh:.2f} base toward the cap."
        )
    elif imbalance < -0.15:
        reason = (
            f"Surplus of {supply_kw - demand_kw:.2f} kW against demand. "
            f"Price moved below the ₹{base_price_inr_kwh:.2f} base to encourage consumption."
        )
    else:
        reason = "Supply and demand are closely balanced; price is near the base tariff."

    return PriceResult(
        price_inr_kwh=price,
        base_price_inr_kwh=base_price_inr_kwh,
        min_price_inr_kwh=min_price_inr_kwh,
        max_price_inr_kwh=max_price_inr_kwh,
        imbalance=round(imbalance, 4),
        supply_kw=round(max(0.0, supply_kw), 3),
        demand_kw=round(max(0.0, demand_kw), 3),
        target_inr_kwh=round(target, 2),
        reason=reason,
    )
