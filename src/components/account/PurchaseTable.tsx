import { ReceiptText } from "lucide-react";
import type { PurchaseOrder } from "../../types/api";
import { formatDateTime, formatKwh, formatPrice } from "../../utils/format";
import { Badge } from "../common/Badge";
import { EmptyState } from "../common/States";

export function PurchaseTable({
  orders,
  perspective,
}: {
  orders: PurchaseOrder[];
  perspective: "seller" | "buyer";
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ReceiptText className="size-4.5" aria-hidden="true" />}
        title={perspective === "seller" ? "No sales yet" : "No purchases yet"}
        description={
          perspective === "seller"
            ? "When a buyer purchases one of your offers, the completed sale appears here."
            : "Browse active offers and complete a simulated purchase to build your ledger."
        }
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead>
          <tr className="border-b border-line text-[10px] uppercase tracking-[0.08em] text-slate-500">
            <th className="py-2.5 pl-1 pr-3 font-medium">Order</th>
            <th className="px-3 py-2.5 font-medium">{perspective === "seller" ? "Buyer" : "Seller"}</th>
            <th className="px-3 py-2.5 font-medium">Quantity</th>
            <th className="px-3 py-2.5 font-medium">Price</th>
            <th className="px-3 py-2.5 font-medium">Value</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="py-2.5 pl-3 pr-1 text-right font-medium">Completed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/80">
          {orders.map((order) => (
            <tr key={order.id} className="text-slate-600 transition-colors hover:bg-slate-50/60">
              <td className="py-2.5 pl-1 pr-3">
                <span className="num font-medium text-ink-900">#{order.id}</span>
                <span className="ml-1 text-[10px] text-slate-400">offer {order.offer_id}</span>
              </td>
              <td className="px-3 py-2.5">
                <span className="font-medium text-ink-900">
                  {perspective === "seller" ? order.buyer_display_name : order.seller_display_name}
                </span>
              </td>
              <td className="num px-3 py-2.5">{formatKwh(order.quantity_kwh)} kWh</td>
              <td className="num px-3 py-2.5">{formatPrice(order.price_inr_kwh)}</td>
              <td className="num px-3 py-2.5 font-medium text-ink-900">{formatPrice(order.total_value_inr)}</td>
              <td className="px-3 py-2.5">
                <Badge tone="success" dot className="capitalize">
                  {order.status}
                </Badge>
              </td>
              <td className="px-3 py-2.5 pl-3 pr-1 text-right text-slate-500">{formatDateTime(order.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
