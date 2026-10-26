import { Handshake, IndianRupee, House, SunMedium, TriangleAlert, Zap } from "lucide-react";
import type { SimulationSnapshot } from "../../types/api";
import { formatInr, formatKwh, formatNumber, formatPrice } from "../../utils/format";
import { StatCard } from "../common/StatCard";

export function MetricGrid({ snapshot }: { snapshot: SimulationSnapshot }) {
  const { totals, state } = snapshot;
  const hasTick = state.tick > 0;

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
      <StatCard
        label="Solar generation"
        value={formatNumber(totals.generation_kw, 2)}
        unit="kW"
        icon={<SunMedium className="size-4" aria-hidden="true" />}
        tone="success"
        hint={hasTick ? "Estimated from real MCP irradiance" : "Awaiting first tick"}
      />
      <StatCard
        label="Household demand"
        value={formatNumber(totals.demand_kw, 2)}
        unit="kW"
        icon={<House className="size-4" aria-hidden="true" />}
        tone="info"
        hint={hasTick ? `${formatNumber(totals.active_households, 0)} simulated households` : "Awaiting first tick"}
      />
      <StatCard
        label="P2P cleared"
        value={formatNumber(totals.allocated_kw, 2)}
        unit="kW"
        icon={<Handshake className="size-4" aria-hidden="true" />}
        tone="success"
        hint={hasTick ? "Maximum-flow allocation" : "No allocation yet"}
      />
      <StatCard
        label="Unmet demand"
        value={formatNumber(totals.unmet_kw, 2)}
        unit="kW"
        icon={<TriangleAlert className="size-4" aria-hidden="true" />}
        tone={(totals.unmet_kw ?? 0) > 0.001 ? "warning" : "neutral"}
        hint={hasTick ? "Buyer requests after matching" : "No requests yet"}
      />
      <StatCard
        label="Energy traded"
        value={formatKwh(totals.energy_traded_kwh, 3)}
        unit="kWh"
        icon={<Zap className="size-4" aria-hidden="true" />}
        tone="neutral"
        hint={
          hasTick
            ? `${formatKwh(totals.tick_energy_traded_kwh, 3)} kWh this tick`
            : "Cumulative simulated volume"
        }
      />
      <StatCard
        label="Dynamic price"
        value={
          <span className="inline-flex items-baseline">
            {formatPrice(totals.price_inr_kwh)}
            <span className="ml-1 text-[11px] font-medium text-slate-500">/kWh</span>
          </span>
        }
        icon={<IndianRupee className="size-4" aria-hidden="true" />}
        tone="warning"
        hint={
          hasTick
            ? `Base ${formatInr(totals.base_price_inr_kwh)} · cap ${formatInr(totals.max_price_inr_kwh)}`
            : "Base tariff until first tick"
        }
      />
    </div>
  );
}
