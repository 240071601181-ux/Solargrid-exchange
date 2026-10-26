import { ArrowRight, ReceiptText } from "lucide-react";
import { Link } from "react-router";
import type { Transaction } from "../../types/api";
import { formatInr, formatKwh, formatPrice, formatTime } from "../../utils/format";
import { EmptyState } from "../common/States";

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<ReceiptText className="size-4.5" aria-hidden="true" />}
        title="No executed transactions yet"
        description="Advance the simulation. When surplus and demand match, the backend persists simulated trades here. No payment is settled."
        className="border-0 bg-transparent"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-line text-[10px] uppercase tracking-[0.06em] text-slate-400">
            <th className="pb-2 pr-3 font-medium">Trade</th>
            <th className="pb-2 pr-3 font-medium">Energy</th>
            <th className="pb-2 pr-3 font-medium">Price</th>
            <th className="pb-2 pr-3 font-medium">Value</th>
            <th className="pb-2 pr-3 font-medium">Time</th>
            <th className="pb-2 text-right font-medium">Record</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {transactions.map((transaction) => (
            <tr key={transaction.id} className="group">
              <td className="py-2.5 pr-3">
                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="truncate">{transaction.seller_name}</span>
                  <ArrowRight className="size-3 shrink-0 text-slate-300" aria-hidden="true" />
                  <span className="truncate">{transaction.buyer_name}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  #{transaction.id} · run {transaction.run_id}
                </p>
              </td>
              <td className="num whitespace-nowrap py-2.5 pr-3 text-slate-700">
                {formatKwh(transaction.energy_kwh, 3)} kWh
                <p className="text-[10px] text-slate-400">{formatKwh(transaction.power_kw, 2)} kW</p>
              </td>
              <td className="num whitespace-nowrap py-2.5 pr-3 text-slate-700">{formatPrice(transaction.price_inr_kwh)}</td>
              <td className="num whitespace-nowrap py-2.5 pr-3 font-medium text-slate-700">
                {formatInr(transaction.total_value_inr)}
              </td>
              <td className="whitespace-nowrap py-2.5 pr-3 text-slate-500">{formatTime(transaction.executed_at)}</td>
              <td className="py-2.5 text-right">
                <Link
                  to={`/transactions?tx=${transaction.id}`}
                  className="focus-ring rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-ink-900"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
