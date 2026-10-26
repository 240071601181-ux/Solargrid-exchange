import { useId } from "react";
import type { Household, HouseholdStatus } from "../../types/api";
import { formatNumber, formatPrice } from "../../utils/format";
import { cn } from "../../utils/cn";

const NODE_POSITIONS = [
  { x: 360, y: 58, labelY: 100 },
  { x: 542, y: 106, labelY: 148 },
  { x: 628, y: 214, labelY: 256 },
  { x: 542, y: 322, labelY: 364 },
  { x: 360, y: 370, labelY: 412 },
  { x: 178, y: 322, labelY: 364 },
  { x: 92, y: 214, labelY: 256 },
  { x: 178, y: 106, labelY: 148 },
] as const;

const STATUS_STYLE: Record<
  HouseholdStatus,
  { fill: string; stroke: string; text: string; label: string }
> = {
  seller: { fill: "#effaf3", stroke: "#16a34a", text: "#0e6b31", label: "Seller" },
  buyer: { fill: "#eff6ff", stroke: "#2563eb", text: "#1d4ed8", label: "Buyer" },
  balanced: { fill: "#f8fafc", stroke: "#94a3b8", text: "#475569", label: "Balanced" },
  unavailable: { fill: "#ffffff", stroke: "#cbd5e1", text: "#94a3b8", label: "No data" },
};

function HouseGlyph({ color }: { color: string }) {
  return (
    <g transform="translate(-8, -18) scale(0.65)" aria-hidden="true">
      <path
        d="M2 8.5 12 1l10 7.5V20a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 20V8.5Z"
        fill="none"
        stroke={color}
        strokeWidth="1.3"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <path d="M9 21v-6h6v6" fill="none" stroke={color} strokeWidth="1.2" opacity="0.55" />
    </g>
  );
}

export function MicrogridMap({
  households,
  price,
  tick,
  onSelect,
  selectedId,
}: {
  households: Household[];
  price: number | null;
  tick: number;
  onSelect: (id: string) => void;
  selectedId?: string | null;
}) {
  const uid = useId().replaceAll(":", "");
  const gridId = `microgrid-grid-${uid}`;
  const glowId = `microgrid-glow-${uid}`;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 720 440"
        role="img"
        aria-label={`Schematic logical network of ${households.length} households around the peer-to-peer exchange bus`}
        className="mx-auto block min-w-[580px] max-w-[760px]"
      >
        <defs>
          <pattern id={gridId} width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#eef2f6" strokeWidth="1" />
          </pattern>
          <radialGradient id={glowId}>
            <stop offset="0%" stopColor="#d9f3e3" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#d9f3e3" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="720" height="440" rx="12" fill={`url(#${gridId})`} />
        <circle cx="360" cy="214" r="150" fill={`url(#${glowId})`} />

        {households.map((household, index) => {
          const position = NODE_POSITIONS[index];
          if (!position) return null;
          const style = STATUS_STYLE[household.status];
          const active = household.status === "seller" || household.status === "buyer";
          return (
            <line
              key={`link-${household.id}`}
              x1="360"
              y1="214"
              x2={position.x}
              y2={position.y}
              stroke={active ? style.stroke : "#dbe2ea"}
              strokeWidth={active ? 1.6 : 1}
              strokeDasharray={active ? "5 5" : undefined}
              className={active ? "flow-dash" : undefined}
              opacity={active ? 0.7 : 1}
            />
          );
        })}

        <g>
          <rect x="286" y="180" width="148" height="68" rx="11" fill="#0b1220" />
          <rect x="286.5" y="180.5" width="147" height="67" rx="10.5" fill="none" stroke="#334155" />
          <text x="360" y="199" textAnchor="middle" fill="#94a3b8" fontSize="8.5" letterSpacing="1.2">
            P2P EXCHANGE BUS
          </text>
          <text x="360" y="218" textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="600">
            {price !== null ? `${formatPrice(price)}/kWh` : "Awaiting tick"}
          </text>
          <text x="360" y="234" textAnchor="middle" fill="#94a3b8" fontSize="8.5">
            {tick > 0 ? `Simulated tick ${tick}` : "No allocation yet"}
          </text>
        </g>

        {households.map((household, index) => {
          const position = NODE_POSITIONS[index];
          if (!position) return null;
          const style = STATUS_STYLE[household.status];
          const selected = selectedId === household.id;
          const net = household.net_power_kw;
          const netLabel = net === null || net === undefined ? "—" : `${net > 0 ? "+" : ""}${formatNumber(net, 2)} kW`;
          return (
            <g
              key={household.id}
              role="button"
              tabIndex={0}
              aria-label={`${household.name}, ${style.label}, net ${netLabel}`}
              onClick={() => onSelect(household.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(household.id);
                }
              }}
              className="focus-ring cursor-pointer"
            >
              <title>
                {household.name} · {style.label} · net {netLabel} · {formatNumber(household.battery_soc_pct, 0)}% battery
              </title>
              {selected ? (
                <circle cx={position.x} cy={position.y} r="33" fill="none" stroke="#0b1220" strokeWidth="1.5" opacity="0.5" />
              ) : null}
              <circle
                cx={position.x}
                cy={position.y}
                r="26"
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={household.status === "unavailable" ? 1.2 : 1.8}
                strokeDasharray={household.status === "unavailable" ? "3 3" : undefined}
                className="transition-[stroke-width] duration-150 hover:stroke-[2.6]"
              />
              <HouseGlyph color={style.stroke} />
              <text x={position.x} y={position.y - 3} textAnchor="middle" fill={style.text} fontSize="8.5" fontWeight="600" letterSpacing="0.4">
                {household.id}
              </text>
              <text x={position.x} y={position.y + 9} textAnchor="middle" fill={style.text} fontSize="9" fontWeight="600">
                {netLabel}
              </text>
              <circle cx={position.x + 21} cy={position.y - 21} r="4" fill={style.stroke} stroke="#ffffff" strokeWidth="1.4" />
              <text x={position.x} y={position.labelY} textAnchor="middle" fill="#334155" fontSize="9.5" fontWeight="600">
                {household.name}
              </text>
              <text x={position.x} y={position.labelY + 11} textAnchor="middle" fill="#94a3b8" fontSize="8">
                {style.label} · {formatNumber(household.battery_soc_pct, 0)}% SOC
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function MicrogridMapLegend() {
  const dotClass: Record<HouseholdStatus, string> = {
    seller: "bg-energy-500",
    buyer: "bg-info-500",
    balanced: "bg-slate-400",
    unavailable: "border border-slate-300 bg-white",
  };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-slate-500">
      {(["seller", "buyer", "balanced", "unavailable"] as const).map((status) => (
        <span key={status} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", dotClass[status])} />
          {STATUS_STYLE[status].label}
        </span>
      ))}
      <span className="text-slate-400">Dashed link = active market participant</span>
    </div>
  );
}
