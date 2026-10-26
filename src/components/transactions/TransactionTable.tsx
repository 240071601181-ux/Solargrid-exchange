import { ArrowRight, ReceiptText } from "lucide-react";
import type { Transaction } from "../../types/api";
import { formatInr, formatKwh, formatPrice, formatTime } from "../../utils/format";
import { Badge } from "../common/Badge";
import { EmptyState } from "../common/States";

export function TransactionTable({
  transactions,
  onSelect,
  selectedId,
}: {
  transactions: Transaction[];
  onSelect: (id: number) => void;
  selectedId?: number | null;
}) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<ReceiptText className="size-4.5" aria-hidden="true" />}
        title="No transactions match"
        description="Adjust the filters or advance the simulation. Executed allocations are persisted in SQLite; proposed trades are not records until confirmed."
        className="rounded-none border-0"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[780px] text-left text-xs">
        <thead>
          <tr className="border-b border-line text-[10px] uppercase tracking-[0.06em] text-slate-400">
            <th className="py-2.5 pr-3 pl-4 font-medium sm:pl-5">Record</th>
            <th className="px-3 py-2.5 font-medium">Seller → buyer</th>
            <th className="px-3 py-2.5 text-right font-medium">Power</th>
            <th className="px-3 py-2.5 text-right font-medium">Energy</th>
            <th className="px-3 py-2.5 text-right font-medium">Price</th>
            <th className="px-3 py-2.5 text-right font-medium">Value</th>
            <th className="px-3 py-2.5 font-medium">Executed</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="py-2.5 pr-4 text-right font-medium sm:pr-5" aria-label="Open" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {transactions.map((transaction) => (
            <tr
              key={transaction.id}
              className={selectedId === transaction.id ? "bg-slate-50" : "hover:bg-slate-50/60"}
            >
              <td className="py-3 pr-3 pl-4 sm:pl-5">
                <p className="num font-medium text-slate-700">#{transaction.id}</p>
                <p className="text-[10px] text-slate-400">run {transaction.run_id}</p>
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-700">{transaction.seller_name}</span>
                  <ArrowRight className="size-3 text-slate-300" aria-hidden="true" />
                  <span className="font-medium text-slate-700">{transaction.buyer_name}</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {transaction.seller_id} → {transaction.buyer_id}
                </p>
              </td>
              <td className="num px-3 py-3 text-right text-slate-700">{formatKwh(transaction.power_kw, 2)} kW</td>
              <td className="num px-3 py-3 text-right text-slate-700">{formatKwh(transaction.energy_kwh, 3)} kWh</td>
              <td className="num px-3 py-3 text-right text-slate-700">{formatPrice(transaction.price_inr_kwh)}</td>
              <td className="num px-3 py-3 text-right font-medium text-slate-700">{formatInr(transaction.total_value_inr)}</td>
              <td className="whitespace-nowrap px-3 py-3 text-slate-500">{formatTime(transaction.executed_at)}</td>
              <td className="px-3 py-3">
                <Badge tone="success" dot>
                  {transaction.status}
                </Badge>
              </td>
              <td className="py-3 pr-4 text-right sm:pr-5">
                <button
                  type="button"
                  onClick={() => onSelect(transaction.id)}
                  className="focus-ring rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
