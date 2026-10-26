import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ReceiptText } from "lucide-react";
import type { ReactNode } from "react";
import { transactionApi } from "../../api/transactionApi";
import { queryKeys } from "../../api/queryKeys";
import { formatDateTime, formatInr, formatKwh, formatNumber, formatPrice } from "../../utils/format";
import { Badge } from "../common/Badge";
import { Drawer } from "../common/Drawer";
import { ErrorState, InlineAlert } from "../common/States";
import { TableSkeleton } from "../common/Skeletons";

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="num max-w-[65%] text-right text-[11px] font-medium text-slate-700">{value}</span>
    </div>
  );
}

export function TransactionDrawer({
  transactionId,
  onClose,
}: {
  transactionId: number | null;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: queryKeys.transaction(transactionId ?? 0),
    queryFn: () => transactionApi.detail(transactionId ?? 0),
    enabled: transactionId !== null,
    staleTime: 60_000,
  });
  const transaction = query.data;

  return (
    <Drawer
      open={transactionId !== null}
      onClose={onClose}
      title={transaction ? `Transaction #${transaction.id}` : "Transaction detail"}
      subtitle="Persisted simulated trade record"
      width="max-w-lg"
    >
      {query.isPending ? (
        <TableSkeleton rows={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} title="Could not load this transaction" onRetry={() => void query.refetch()} compact />
      ) : transaction ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-line bg-slate-50/60 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold text-ink-900">{transaction.seller_name}</span>
                <ArrowRight className="size-4 shrink-0 text-energy-500" aria-hidden="true" />
                <span className="truncate text-sm font-semibold text-ink-900">{transaction.buyer_name}</span>
              </div>
              <Badge tone="success" dot>
                {transaction.status}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.06em] text-slate-500">Energy</p>
                <p className="num mt-0.5 text-sm font-semibold text-ink-900">{formatKwh(transaction.energy_kwh, 4)} kWh</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.06em] text-slate-500">Price</p>
                <p className="num mt-0.5 text-sm font-semibold text-ink-900">{formatPrice(transaction.price_inr_kwh)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.06em] text-slate-500">Value</p>
                <p className="num mt-0.5 text-sm font-semibold text-ink-900">{formatInr(transaction.total_value_inr)}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-xs font-semibold text-ink-900">Calculation</h3>
            <p className="rounded-lg border border-line bg-white px-3 py-2.5 text-[11px] leading-5 text-slate-600">
              {transaction.energy_formula}
            </p>
            <p className="mt-1.5 text-[10px] text-slate-400">
              Value = energy × clearing price. Rounded from the backend record; no financial settlement occurred.
            </p>
          </div>

          <div>
            <h3 className="mb-1 text-xs font-semibold text-ink-900">Record</h3>
            <div className="rounded-lg border border-line px-3">
              <Row label="Transaction ID" value={`#${transaction.id}`} />
              <Row label="Allocation run" value={`#${transaction.run_id}`} />
              <Row label="Seller" value={`${transaction.seller_name} · ${transaction.seller_id}`} />
              <Row label="Buyer" value={`${transaction.buyer_name} · ${transaction.buyer_id}`} />
              <Row label="Allocated power" value={`${formatNumber(transaction.allocated_power_kw, 4)} kW`} />
              <Row
                label="Interval"
                value={transaction.interval_seconds ? `${transaction.interval_seconds} s` : "—"}
              />
              <Row label="Created" value={formatDateTime(transaction.created_at)} />
              <Row label="Executed" value={formatDateTime(transaction.executed_at)} />
            </div>
          </div>

          <InlineAlert tone="info">
            <span className="font-medium">Simulation boundary:</span> {transaction.settlement}
          </InlineAlert>

          <p className="flex items-start gap-1.5 text-[10px] leading-4 text-slate-400">
            <ReceiptText className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            This record is stored in SQLite and can be queried after restart. It represents a simulated energy
            transfer, not a metered or settled financial transaction.
          </p>
        </div>
      ) : null}
    </Drawer>
  );
}
