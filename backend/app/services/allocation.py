"""Deterministic energy allocation.

A bipartite max-flow network is solved with Edmonds–Karp:

    source → seller (offer, capped by household trade limit)
    seller → buyer (link cap = household trade limit)
    buyer → sink (request, capped by household trade limit)

This maximises served demand without exceeding any seller offer, buyer request
or household trade limit. It is a genuine max-flow implementation, not an LP
solver, and is described as such throughout the UI.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from time import perf_counter


@dataclass(slots=True)
class SellerOffer:
    household_id: str
    available_kw: float


@dataclass(slots=True)
class BuyerRequest:
    household_id: str
    requested_kw: float


@dataclass(slots=True)
class AllocationItemResult:
    seller_id: str
    buyer_id: str
    power_kw: float


@dataclass(slots=True)
class AllocationResult:
    items: list[AllocationItemResult] = field(default_factory=list)
    total_supply_kw: float = 0.0
    total_demand_kw: float = 0.0
    allocated_kw: float = 0.0
    unmet_kw: float = 0.0
    unallocated_kw: float = 0.0
    execution_ms: float = 0.0
    objective_value: float = 0.0
    algorithm: str = "bipartite_max_flow (Edmonds-Karp)"

    @property
    def fully_served(self) -> bool:
        return self.unmet_kw < 0.001


def allocate_energy(
    sellers: list[SellerOffer],
    buyers: list[BuyerRequest],
    *,
    max_trade_kw: float = 4.0,
    epsilon: float = 0.001,
) -> AllocationResult:
    started = perf_counter()
    sellers = [s for s in sellers if s.available_kw > epsilon]
    buyers = [b for b in buyers if b.requested_kw > epsilon]

    total_supply = sum(max(0.0, s.available_kw) for s in sellers)
    total_demand = sum(max(0.0, b.requested_kw) for b in buyers)
    if not sellers or not buyers:
        elapsed_ms = (perf_counter() - started) * 1000
        return AllocationResult(
            total_supply_kw=round(total_supply, 3),
            total_demand_kw=round(total_demand, 3),
            unmet_kw=round(total_demand, 3),
            unallocated_kw=round(total_supply, 3),
            execution_ms=round(elapsed_ms, 3),
        )

    # Work in watts so the flow arithmetic is stable.
    source = 0
    seller_nodes = {s.household_id: index + 1 for index, s in enumerate(sellers)}
    buyer_offset = 1 + len(sellers)
    buyer_nodes = {b.household_id: buyer_offset + index for index, b in enumerate(buyers)}
    sink = 1 + len(sellers) + len(buyers)
    node_count = sink + 1
    capacity = [[0] * node_count for _ in range(node_count)]

    def add_edge(u: int, v: int, cap: int) -> None:
        capacity[u][v] += cap
        capacity[v][u] += 0

    seller_caps: dict[int, int] = {}
    buyer_caps: dict[int, int] = {}
    link_cap = max(0, int(round(max_trade_kw * 1000)))

    for seller in sellers:
        node = seller_nodes[seller.household_id]
        cap = max(0, int(round(min(seller.available_kw, max_trade_kw) * 1000)))
        seller_caps[node] = cap
        add_edge(source, node, cap)
    for buyer in buyers:
        node = buyer_nodes[buyer.household_id]
        cap = max(0, int(round(min(buyer.requested_kw, max_trade_kw) * 1000)))
        buyer_caps[node] = cap
        add_edge(node, sink, cap)
    for seller in sellers:
        for buyer in buyers:
            add_edge(seller_nodes[seller.household_id], buyer_nodes[buyer.household_id], link_cap)

    residual = [row[:] for row in capacity]
    flow = 0
    while True:
        parent = [-1] * node_count
        parent[source] = source
        queue: deque[int] = deque([source])
        while queue and parent[sink] == -1:
            u = queue.popleft()
            for v in range(node_count):
                if parent[v] == -1 and residual[u][v] > 0:
                    parent[v] = u
                    queue.append(v)
        if parent[sink] == -1:
            break
        push = None
        v = sink
        while v != source:
            u = parent[v]
            push = residual[u][v] if push is None else min(push, residual[u][v])
            v = u
        if not push:
            break
        v = sink
        while v != source:
            u = parent[v]
            residual[u][v] -= push
            residual[v][u] += push
            v = u
        flow += push

    items: list[AllocationItemResult] = []
    for seller in sellers:
        seller_node = seller_nodes[seller.household_id]
        for buyer in buyers:
            buyer_node = buyer_nodes[buyer.household_id]
            used = residual[buyer_node][seller_node]
            if used > 0:
                items.append(
                    AllocationItemResult(
                        seller_id=seller.household_id,
                        buyer_id=buyer.household_id,
                        power_kw=round(used / 1000, 4),
                    )
                )

    allocated = round(flow / 1000, 4)
    elapsed_ms = (perf_counter() - started) * 1000
    items.sort(key=lambda item: (-item.power_kw, item.seller_id, item.buyer_id))
    return AllocationResult(
        items=items,
        total_supply_kw=round(total_supply, 3),
        total_demand_kw=round(total_demand, 3),
        allocated_kw=allocated,
        unmet_kw=round(max(0.0, total_demand - allocated), 4),
        unallocated_kw=round(max(0.0, total_supply - allocated), 4),
        execution_ms=round(elapsed_ms, 3),
        objective_value=allocated,
    )
