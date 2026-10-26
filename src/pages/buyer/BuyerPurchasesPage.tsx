import { IndianRupee, ReceiptText, ShoppingBag, TrendingDown } from "lucide-react";
import { PageBody, PageHeader } from "../../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/common/Card";
import { StatCard } from "../../components/common/StatCard";
import { Badge } from "../../components/common/Badge";
import { ErrorState } from "../../components/common/States";
import { TableSkeleton } from "../../components/common/Skeletons";
import { PurchaseTable } from "../../components/account/PurchaseTable";
import { useBuyerPurchases, useBuyerSpending } from "../../hooks/queries";
import { formatInr, formatKwh, formatNumber, formatPrice } from "../../utils/format";

export function BuyerPurchasesPage() {
  const purchases = useBuyerPurchases();
  const spending = useBuyerSpending();
  const items = purchases.data?.items ?? [];

  return (
    <PageBody>
      <PageHeader
        eyebrow="Buyer workspace"
        title="My purchases"
        description="Only purchases owned by this buyer account are returned by the protected API."
        meta={<Badge tone="success" dot>{formatNumber(items.length, 0)} orders</Badge>}
      />
      {purchases.isError ? (
        <ErrorState error={purchases.error} title="Purchases could not be loaded" onRetry={() => void purchases.refetch()} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Completed purchases" value={formatNumber(items.length, 0)} icon={<ReceiptText className="size-4" />} tone="neutral" />
            <StatCard label="Energy purchased" value={formatKwh(spending.data?.energy_purchased_kwh ?? 0)} unit="kWh" icon={<ShoppingBag className="size-4" />} tone="info" />
            <StatCard
              label="Simulated spend"
              value={formatInr(spending.data?.simulated_spend_inr ?? 0, 2)}
              icon={<IndianRupee className="size-4" />}
              tone="success"
              hint={
                spending.data?.average_purchase_price_inr_kwh != null
                  ? `Average ${formatPrice(spending.data.average_purchase_price_inr_kwh)}/kWh`
                  : "No completed purchases"
              }
            />
          </div>

          <Card>
            <CardHeader
              title="Purchase ledger"
              subtitle="Newest completed marketplace purchases"
              icon={<TrendingDown className="size-4" aria-hidden="true" />}
              action={<Badge tone="info">Marketplace source</Badge>}
            />
            <CardBody>
              {purchases.isPending ? <TableSkeleton rows={6} /> : <PurchaseTable orders={items} perspective="buyer" />}
            </CardBody>
          </Card>

          <p className="text-[11px] leading-5 text-slate-500">
            Purchases create a purchase order and a marketplace transaction. They survive operator simulation resets;
            only seeded simulation transactions are cleared.
          </p>
        </>
      )}
    </PageBody>
  );
}
