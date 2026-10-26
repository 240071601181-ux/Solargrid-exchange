import { ArrowRight, CircleSlash2 } from "lucide-react";
import type { Allocation } from "../../types/api";
import { formatInr, formatKwh, formatNumber, formatPrice } from "../../utils/format";
import { EmptyState } from "../common/States";

export function AllocationTable({ allocation }: { allocation: Allocation }) {
  if (allocation.items.length === 0) {
    return (
      <EmptyState
        icon={<CircleSlash2 className="size-4.5" aria-hidden="true" />}
        title="No feasible matches this interval"
        description={
          allocation.total_supply_kw <= 0.001
            ? "No seller released surplus at the current price. Offers are price-sensitive and bounded by each household's reservation price."
            : allocation.total_demand_kw <= 0.001
              ? "No household has unmet demand after battery dispatch, so no trades were proposed."
              : "Supply or demand was insufficient after per-household trade caps. The max-flow result is empty."
        }
        className="border-0 bg-transparent"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead>
          <tr className="border-b border-line text-[10px] uppercase tracking-[0.06em] text-slate-400">
            <th className="py-2 pr-3 pl-4 font-medium sm:pl-5">Seller</th>
            <th className="px-3 py-2 font-medium" aria-label="to" />
            <th className="px-3 py-2 font-medium">Buyer</th>
            <th className="px-3 py-2 text-right font-medium">Power</th>
            <th className="px-3 py-2 text-right font-medium">Energy</th>
            <th className="px-3 py-2 text-right font-medium">Clearing price</th>
            <th className="py-2 pr-4 text-right font-medium sm:pr-5">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {allocation.items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50/60">
              <td className="py-2.5 pr-3 pl-4 sm:pl-5">
                <p className="font-medium text-slate-700">{item.seller_name}</p>
                <p className="text-[10px] text-slate-400">{item.seller_id}</p>
              </td>
              <td className="px-3 py-2.5">
                <ArrowRight className="size-3.5 text-energy-500" aria-hidden="true" />
              </td>
              <td className="px-3 py-2.5">
                <p className="font-medium text-slate-700">{item.buyer_name}</p>
                <p className="text-[10px] text-slate-400">{item.buyer_id}</p>
              </td>
              <td className="num px-3 py-2.5 text-right text-slate-700">{formatNumber(item.power_kw, 2)} kW</td>
              <td className="num px-3 py-2.5 text-right text-slate-700">{formatKwh(item.energy_kwh, 3)} kWh</td>
              <td className="num px-3 py-2.5 text-right text-slate-700">{formatPrice(allocation.price_inr_kwh)}</td>
              <td className="num py-2.5 pr-4 text-right font-medium text-slate-700 sm:pr-5">{formatInr(item.value_inr)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line bg-slate-50/60 text-[11px]">
            <td className="py-2.5 pr-3 pl-4 font-medium text-slate-600 sm:pl-5" colSpan={3}>
              {allocation.items.length} allocation link{allocation.items.length === 1 ? "" : "s"}
            </td>
            <td className="num px-3 py-2.5 text-right font-semibold text-ink-900">{formatNumber(allocation.allocated_kw, 2)} kW</td>
            <td className="num px-3 py-2.5 text-right font-semibold text-ink-900">
              {formatKwh(allocation.allocated_kw * (allocation.interval_seconds / 3600), 3)} kWh
            </td>
            <td className="px-3 py-2.5 text-right text-slate-500">—</td>
            <td className="num py-2.5 pr-4 text-right font-semibold text-ink-900 sm:pr-5">
              {formatInr(allocation.items.reduce((sum, item) => sum + item.value_inr, 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
