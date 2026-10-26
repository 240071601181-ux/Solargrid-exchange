from __future__ import annotations

from collections import defaultdict

import pytest

from app.services.allocation import BuyerRequest, SellerOffer, allocate_energy


def totals_by(items, key: str):  # type: ignore[no-untyped-def]
    totals: dict[str, float] = defaultdict(float)
    for item in items:
        totals[getattr(item, key)] += item.power_kw
    return totals


def test_single_household_cap_limits_flow() -> None:
    result = allocate_energy([SellerOffer("S1", 10)], [BuyerRequest("B1", 10)], max_trade_kw=4)
    assert result.allocated_kw == 4
    assert result.unmet_kw == 6
    assert result.unallocated_kw == 6
    assert result.items[0].seller_id == "S1"
    assert result.items[0].buyer_id == "B1"
    assert result.algorithm.startswith("bipartite_max_flow")


def test_multi_party_flow_respects_every_constraint() -> None:
    sellers = [SellerOffer("S1", 10), SellerOffer("S2", 1.5), SellerOffer("S3", 0.4)]
    buyers = [BuyerRequest("B1", 9), BuyerRequest("B2", 2), BuyerRequest("B3", 0.2)]
    result = allocate_energy(sellers, buyers, max_trade_kw=4)

    offers = {seller.household_id: seller.available_kw for seller in sellers}
    requests = {buyer.household_id: buyer.requested_kw for buyer in buyers}
    sold = totals_by(result.items, "seller_id")
    bought = totals_by(result.items, "buyer_id")

    assert result.allocated_kw == pytest.approx(sum(item.power_kw for item in result.items))
    assert result.allocated_kw <= result.total_supply_kw + 1e-9
    assert result.allocated_kw <= result.total_demand_kw + 1e-9
    assert result.unmet_kw == pytest.approx(result.total_demand_kw - result.allocated_kw)
    assert result.unallocated_kw == pytest.approx(result.total_supply_kw - result.allocated_kw)

    for seller_id, power in sold.items():
        assert power <= offers[seller_id] + 1e-9
        assert power <= 4 + 1e-9
    for buyer_id, power in bought.items():
        assert power <= requests[buyer_id] + 1e-9
        assert power <= 4 + 1e-9


def test_flow_maximizes_without_exceeding_total_demand() -> None:
    sellers = [SellerOffer(f"S{index}", 4) for index in range(3)]
    buyers = [BuyerRequest(f"B{index}", 2) for index in range(3)]
    result = allocate_energy(sellers, buyers, max_trade_kw=4)

    assert result.allocated_kw == 6
    assert result.unmet_kw == 0
    assert result.unallocated_kw == 6
    assert sum(item.power_kw for item in result.items) == pytest.approx(6)


def test_demand_beyond_caps_remains_unmet() -> None:
    sellers = [SellerOffer("S1", 4), SellerOffer("S2", 4)]
    buyers = [BuyerRequest("B1", 20), BuyerRequest("B2", 20)]
    result = allocate_energy(sellers, buyers, max_trade_kw=4)

    assert result.allocated_kw == 8
    assert result.unmet_kw == 32
    assert result.unallocated_kw == 0


def test_missing_side_returns_empty_result() -> None:
    no_sellers = allocate_energy([], [BuyerRequest("B1", 3)])
    assert no_sellers.items == []
    assert no_sellers.allocated_kw == 0
    assert no_sellers.unmet_kw == 3
    assert no_sellers.unallocated_kw == 0

    no_buyers = allocate_energy([SellerOffer("S1", 3)], [])
    assert no_buyers.items == []
    assert no_buyers.allocated_kw == 0
    assert no_buyers.unmet_kw == 0
    assert no_buyers.unallocated_kw == 3


def test_tiny_or_negative_orders_are_ignored() -> None:
    result = allocate_energy(
        [SellerOffer("S1", 0.0001), SellerOffer("S2", -2)],
        [BuyerRequest("B1", 0.0001), BuyerRequest("B2", -2)],
        max_trade_kw=4,
    )
    assert result.items == []
    assert result.allocated_kw == 0


def test_allocation_is_deterministic() -> None:
    sellers = [SellerOffer("S2", 3), SellerOffer("S1", 2)]
    buyers = [BuyerRequest("B2", 2), BuyerRequest("B1", 2)]
    first = allocate_energy(sellers, buyers, max_trade_kw=4)
    second = allocate_energy(sellers, buyers, max_trade_kw=4)

    assert [(i.seller_id, i.buyer_id, i.power_kw) for i in first.items] == [
        (i.seller_id, i.buyer_id, i.power_kw) for i in second.items
    ]
