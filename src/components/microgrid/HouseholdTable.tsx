import { ArrowUpRight, BatteryCharging, Home, SunMedium } from "lucide-react";
import type { Household, HouseholdStatus } from "../../types/api";
import { formatInr, formatKwh, formatNumber, formatPct, formatSigned } from "../../utils/format";
import { Badge, type Tone } from "../common/Badge";
import { ProgressBar } from "../common/ProgressBar";
import { EmptyState } from "../common/States";

const STATUS_TONE: Record<HouseholdStatus, Tone> = {
  seller: "success",
  buyer: "info",
  balanced: "neutral",
  unavailable: "warning",
};

export function HouseholdTable({
  households,
  onSelect,
  selectedId,
}: {
  households: Household[];
  onSelect: (id: string) => void;
  selectedId?: string | null;
}) {
  if (households.length === 0) {
    return (
      <EmptyState
        icon={<Home className="size-4.5" aria-hidden="true" />}
        title="No households loaded"
        description="The backend seeds eight simulated households on first startup."
        className="border-0 bg-transparent"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-xs">
        <thead>
          <tr className="border-b border-line text-[10px] uppercase tracking-[0.06em] text-slate-400">
            <th className="py-2 pr-3 pl-4 font-medium sm:pl-5">Household</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Generation</th>
            <th className="px-3 py-2 text-right font-medium">Demand</th>
            <th className="px-3 py-2 text-right font-medium">Net</th>
            <th className="px-3 py-2 text-right font-medium">Offer / request</th>
            <th className="px-3 py-2 text-right font-medium">Unmet</th>
            <th className="px-3 py-2 font-medium">Battery</th>
            <th className="py-2 pr-4 font-medium sm:pr-5" aria-label="Open" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {households.map((household) => {
            const net = household.net_power_kw;
            return (
              <tr
                key={household.id}
                className={
                  selectedId === household.id
                    ? "bg-slate-50/80"
                    : "transition-colors hover:bg-slate-50/60"
                }
              >
                <td className="py-3 pr-3 pl-4 sm:pl-5">
                  <button
                    type="button"
                    onClick={() => onSelect(household.id)}
                    className="focus-ring rounded text-left"
                  >
                    <span className="flex items-center gap-1.5 font-medium text-ink-900">
                      {household.name}
                      <ArrowUpRight className="size-3 text-slate-300" aria-hidden="true" />
                    </span>
                    <span className="mt-0.5 block text-[10px] text-slate-400">
                      {household.id} · {household.role_hint}
                    </span>
                  </button>
                </td>
                <td className="px-3 py-3">
                  <Badge tone={STATUS_TONE[household.status]} dot>
                    {household.status}
                  </Badge>
                </td>
                <td className="num px-3 py-3 text-right text-slate-700">
                  <span className="inline-flex items-center justify-end gap-1">
                    <SunMedium className="size-3 text-energy-500" aria-hidden="true" />
                    {formatNumber(household.generation_kw, 2)} kW
                  </span>
                  <p className="text-[10px] font-normal text-slate-400">{formatNumber(household.solar_capacity_kw, 1)} kW installed</p>
                </td>
                <td className="num px-3 py-3 text-right text-slate-700">{formatNumber(household.demand_kw, 2)} kW</td>
                <td
                  className={
                    net !== null && net > 0.001
                      ? "num px-3 py-3 text-right font-medium text-energy-700"
                      : net !== null && net < -0.001
                        ? "num px-3 py-3 text-right font-medium text-info-600"
                        : "num px-3 py-3 text-right text-slate-500"
                  }
                >
                  {formatSigned(net, "kW")}
                </td>
                <td className="num px-3 py-3 text-right text-slate-700">
                  {household.available_selling_kw !== null && household.available_selling_kw > 0.001 ? (
                    <>
                      <span className="font-medium text-energy-700">{formatNumber(household.available_selling_kw, 2)} kW</span>
                      <p className="text-[10px] text-slate-400">offer @ ≥ {formatInr(household.reservation_price_inr_kwh)}</p>
                    </>
                  ) : household.requested_buying_kw !== null && household.requested_buying_kw > 0.001 ? (
                    <>
                      <span className="font-medium text-info-600">{formatNumber(household.requested_buying_kw, 2)} kW</span>
                      <p className="text-[10px] text-slate-400">simulated request</p>
                    </>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="num px-3 py-3 text-right text-slate-700">
                  {formatKwh(household.unmet_demand_kw, 2)}
                  {household.withheld_kw !== null && household.withheld_kw > 0.001 ? (
                    <p className="text-[10px] text-warn-600">{formatNumber(household.withheld_kw, 2)} kW withheld</p>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <BatteryCharging className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    <div className="w-16">
                      <ProgressBar
                        value={household.battery_soc_pct ?? 0}
                        tone={(household.battery_soc_pct ?? 0) <= 20 ? "warning" : "success"}
                        label={`${household.name} battery state of charge`}
                      />
                    </div>
                    <span className="num w-9 text-right text-[10px] text-slate-500">
                      {formatPct(household.battery_soc_pct, 0)}
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-4 text-right sm:pr-5">
                  <button
                    type="button"
                    onClick={() => onSelect(household.id)}
                    className="focus-ring rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Details
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
