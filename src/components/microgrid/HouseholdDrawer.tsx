import { BatteryCharging, Home, SunMedium, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useHousehold } from "../../hooks/queries";
import type { HouseholdStatus } from "../../types/api";
import { formatInr, formatKwh, formatNumber, formatPct, formatPrice, formatTime } from "../../utils/format";
import { Badge, type Tone } from "../common/Badge";
import { Drawer } from "../common/Drawer";
import { ProgressBar } from "../common/ProgressBar";
import { ErrorState, InlineAlert } from "../common/States";
import { TableSkeleton } from "../common/Skeletons";

const STATUS_TONE: Record<HouseholdStatus, Tone> = {
  seller: "success",
  buyer: "info",
  balanced: "neutral",
  unavailable: "warning",
};

function DetailStat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-slate-50/60 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-500">{label}</p>
      <p className="num mt-1 text-sm font-semibold text-ink-900">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function HouseholdDrawer({ householdId, onClose }: { householdId: string | null; onClose: () => void }) {
  const query = useHousehold(householdId ?? undefined);
  const household = query.data;

  return (
    <Drawer
      open={Boolean(householdId)}
      onClose={onClose}
      title={household?.name ?? "Household detail"}
      subtitle={
        household ? (
          <span className="inline-flex items-center gap-2">
            {household.id} · {household.role_hint}
            <Badge tone={STATUS_TONE[household.status]} dot>
              {household.status}
            </Badge>
          </span>
        ) : (
          "Loading simulated household state"
        )
      }
      width="max-w-xl"
    >
      {query.isPending ? (
        <div className="space-y-4">
          <TableSkeleton rows={4} />
          <TableSkeleton rows={3} />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} title="Could not load this household" onRetry={() => void query.refetch()} compact />
      ) : household ? (
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
              <SunMedium className="size-3.5" aria-hidden="true" />
              Latest simulated interval
            </div>
            <div className="grid grid-cols-2 gap-2">
              <DetailStat
                label="Generation"
                value={`${formatNumber(household.generation_kw, 2)} kW`}
                hint={`${formatNumber(household.solar_capacity_kw, 1)} kW installed · estimate`}
              />
              <DetailStat
                label="Demand"
                value={`${formatNumber(household.demand_kw, 2)} kW`}
                hint="Simulated profile · not metered"
              />
              <DetailStat
                label="Net power"
                value={
                  <span
                    className={
                      (household.net_power_kw ?? 0) >= 0 ? "text-energy-700" : "text-info-600"
                    }
                  >
                    {formatNumber(household.net_power_kw, 2)} kW
                  </span>
                }
                hint={(household.net_power_kw ?? 0) >= 0 ? "Surplus after demand" : "Deficit after generation"}
              />
              <DetailStat
                label="Served by P2P"
                value={`${formatNumber(household.served_kw, 2)} kW`}
                hint={`${formatNumber(household.unmet_demand_kw, 2)} kW unmet`}
              />
            </div>
          </div>

          <div className="rounded-lg border border-line px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <BatteryCharging className="size-4 text-slate-400" aria-hidden="true" />
                Battery state
              </span>
              <span className="num text-xs font-semibold text-ink-900">{formatPct(household.battery_soc_pct, 1)}</span>
            </div>
            <ProgressBar
              className="mt-2"
              value={household.battery_soc_pct ?? 0}
              tone={(household.battery_soc_pct ?? 0) <= 20 ? "warning" : "success"}
              label={`${household.name} battery state of charge`}
            />
            <p className="mt-1.5 text-[10px] text-slate-500">
              {formatKwh(household.battery_soc_kwh, 2)} kWh stored of {formatKwh(household.battery_capacity_kwh, 2)} kWh
              capacity. Dispatch is simulated.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <DetailStat
              label="Sell offer"
              value={`${formatNumber(household.available_selling_kw, 2)} kW`}
              hint={`Reservation ${formatInr(household.reservation_price_inr_kwh)}/kWh`}
            />
            <DetailStat
              label="Buy request"
              value={`${formatNumber(household.requested_buying_kw, 2)} kW`}
              hint="Inelastic simulated demand"
            />
            <DetailStat
              label="Withheld surplus"
              value={`${formatNumber(household.withheld_kw, 2)} kW`}
              hint="Physical surplus not offered at this price"
            />
            <DetailStat
              label="Trade status"
              value={<span className="capitalize">{household.status}</span>}
              hint="Derived from offer and request"
            />
          </div>

          {household.status === "unavailable" || query.data === undefined ? (
            <InlineAlert tone="info">
              This household has no snapshot for the current tick. Advance the simulation to populate generation,
              demand and market participation.
            </InlineAlert>
          ) : null}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-ink-900">Recent simulated trades</h3>
              <span className="text-[10px] text-slate-400">up to 10 records</span>
            </div>
            {household.recent_transactions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-3 py-5 text-center text-[11px] text-slate-500">
                No transactions involve this household yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-line text-[10px] uppercase tracking-[0.06em] text-slate-400">
                      <th className="py-1.5 pr-2 font-medium">Counterparty</th>
                      <th className="px-2 py-1.5 font-medium">Energy</th>
                      <th className="px-2 py-1.5 font-medium">Price</th>
                      <th className="py-1.5 text-right font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {household.recent_transactions.map((transaction) => {
                      const sold = transaction.seller_id === household.id;
                      return (
                        <tr key={transaction.id}>
                          <td className="py-2 pr-2 text-slate-700">
                            <span className={sold ? "text-energy-700" : "text-info-600"}>{sold ? "Sold to" : "Bought from"}</span>{" "}
                            {sold ? transaction.buyer_name : transaction.seller_name}
                          </td>
                          <td className="num px-2 py-2 text-slate-700">{formatKwh(transaction.energy_kwh, 3)} kWh</td>
                          <td className="num px-2 py-2 text-slate-700">{formatPrice(transaction.price_inr_kwh)}</td>
                          <td className="py-2 text-right text-slate-500">{formatTime(transaction.executed_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-900">
              <Zap className="size-3.5 text-slate-400" aria-hidden="true" />
              Model assumptions
            </h3>
            <ul className="space-y-1.5">
              {household.assumptions.map((assumption) => (
                <li key={assumption} className="flex gap-2 text-[11px] leading-5 text-slate-500">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-slate-300" />
                  {assumption}
                </li>
              ))}
            </ul>
          </div>

          <p className="border-t border-line pt-3 text-[10px] leading-4 text-slate-400">
            <Home className="mr-1 inline size-3" aria-hidden="true" />
            Household positions and connections in the map are schematic. No feeder impedance, voltage constraint or
            physical metering is modeled.
          </p>
        </div>
      ) : null}
    </Drawer>
  );
}
