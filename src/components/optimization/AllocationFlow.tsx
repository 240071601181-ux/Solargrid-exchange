import { GitMerge } from "lucide-react";
import type { Allocation } from "../../types/api";
import { formatNumber } from "../../utils/format";
import { EmptyState } from "../common/States";

interface FlowNode {
  id: string;
  name: string;
  kw: number;
}

function uniqueNodes(items: Allocation["items"], side: "seller" | "buyer"): FlowNode[] {
  const map = new Map<string, FlowNode>();
  for (const item of items) {
    const id = side === "seller" ? item.seller_id : item.buyer_id;
    const name = side === "seller" ? item.seller_name : item.buyer_name;
    const existing = map.get(id);
    if (existing) existing.kw += item.power_kw;
    else map.set(id, { id, name, kw: item.power_kw });
  }
  return [...map.values()];
}

export function AllocationFlow({ allocation }: { allocation: Allocation }) {
  if (allocation.items.length === 0) {
    return (
      <EmptyState
        icon={<GitMerge className="size-4.5" aria-hidden="true" />}
        title="No flow to visualize"
        description="The last allocation has no matched links. Run the maximum-flow solver after a tick with both offers and requests."
        className="border-0 bg-transparent"
      />
    );
  }

  const sellers = uniqueNodes(allocation.items, "seller");
  const buyers = uniqueNodes(allocation.items, "buyer");
  const height = Math.max(230, Math.max(sellers.length, buyers.length) * 64 + 60);
  const top = 44;
  const available = height - top - 24;
  const yFor = (index: number, count: number) => top + ((index + 0.5) * available) / Math.max(1, count);
  const sellerY = new Map(sellers.map((node, index) => [node.id, yFor(index, sellers.length)]));
  const buyerY = new Map(buyers.map((node, index) => [node.id, yFor(index, buyers.length)]));
  const maxLink = Math.max(...allocation.items.map((item) => item.power_kw), 0.001);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 760 ${height}`}
        role="img"
        aria-label="Matched seller to buyer allocations with link thickness proportional to power"
        className="block min-w-[620px]"
        style={{ height }}
      >
        <text x="18" y="22" fill="#94a3b8" fontSize="9" letterSpacing="0.8">
          SELLERS
        </text>
        <text x="742" y="22" textAnchor="end" fill="#94a3b8" fontSize="9" letterSpacing="0.8">
          BUYERS
        </text>

        {allocation.items.map((item) => {
          const y1 = sellerY.get(item.seller_id);
          const y2 = buyerY.get(item.buyer_id);
          if (y1 === undefined || y2 === undefined) return null;
          const width = 1.2 + (item.power_kw / maxLink) * 6.5;
          return (
            <path
              key={item.id}
              d={`M 148 ${y1} C 310 ${y1}, 450 ${y2}, 612 ${y2}`}
              fill="none"
              stroke="#16a34a"
              strokeWidth={width}
              strokeLinecap="round"
              opacity="0.42"
            >
              <title>
                {item.seller_name} → {item.buyer_name}: {formatNumber(item.power_kw, 2)} kW
              </title>
            </path>
          );
        })}

        {sellers.map((node, index) => {
          const y = yFor(index, sellers.length);
          return (
            <g key={node.id}>
              <rect x="18" y={y - 21} width="130" height="42" rx="8" fill="#effaf3" stroke="#a7e3bb" />
              <text x="30" y={y - 5} fill="#334155" fontSize="10" fontWeight="600">
                {node.name.length > 17 ? `${node.name.slice(0, 16)}…` : node.name}
              </text>
              <text x="30" y={y + 9} fill="#0e6b31" fontSize="10" fontWeight="600">
                {formatNumber(node.kw, 2)} kW
              </text>
              <circle cx="138" cy={y} r="2.5" fill="#16a34a" />
            </g>
          );
        })}

        {buyers.map((node, index) => {
          const y = yFor(index, buyers.length);
          return (
            <g key={node.id}>
              <rect x="612" y={y - 21} width="130" height="42" rx="8" fill="#eff6ff" stroke="#bfdbfe" />
              <text x="624" y={y - 5} fill="#334155" fontSize="10" fontWeight="600">
                {node.name.length > 17 ? `${node.name.slice(0, 16)}…` : node.name}
              </text>
              <text x="624" y={y + 9} fill="#1d4ed8" fontSize="10" fontWeight="600">
                {formatNumber(node.kw, 2)} kW
              </text>
              <circle cx="622" cy={y} r="2.5" fill="#2563eb" />
            </g>
          );
        })}

        <g>
          <rect x="330" y={height / 2 - 18} width="100" height="36" rx="7" fill="#0b1220" />
          <text x="380" y={height / 2 - 4} textAnchor="middle" fill="#94a3b8" fontSize="8" letterSpacing="0.8">
            MAX FLOW
          </text>
          <text x="380" y={height / 2 + 9} textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="600">
            {formatNumber(allocation.allocated_kw, 2)} kW
          </text>
        </g>
      </svg>
    </div>
  );
}
