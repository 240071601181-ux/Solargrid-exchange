import { IndianRupee, ReceiptText, ShoppingBag } from "lucide-react";
import { useMemo } from "react";
import { PageBody, PageHeader } from "../../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/common/Card";
import { StatCard } from "../../components/common/StatCard";
import { Badge } from "../../components/common/Badge";
import { ErrorState } from "../../components/common/States";
import { TableSkeleton } from "../../components/common/Skeletons";
import { PurchaseTable } from "../../components/account/PurchaseTable";
import { useSellerSales } from "../../hooks/queries";
import { formatInr, formatKwh, formatNumber } from "../../utils/format";

export function SellerSalesPage() {
  const sales = useSellerSales();
  const items = useMemo(() => sales.data?.items ?? [], [sales.data]);
  const totals = useMemo(
    () =>
      items.reduce(
        (acc, order) => ({
          energy: acc.energy + order.quantity_kwh,
          value: acc.value + order.total_value_inr,
        }),
        { energy: 0, value: 0 },
      ),
    [items],
  );

  return (
    <PageBody>
      <PageHeader
        eyebrow="Seller workspace"
        title="My sales"
        description="Every completed marketplace purchase against your offers, with the buyer display name and simulated value."
        meta={<Badge tone="success" dot>{formatNumber(items.length, 0)} completed</Badge>}
      />
      {sales.isError ? (
        <ErrorState error={sales.error} title="Sales could not be loaded" onRetry={() => void sales.refetch()} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Completed sales" value={formatNumber(items.length, 0)} icon={<ReceiptText className="size-4" />} tone="neutral" />
            <StatCard label="Energy sold" value={formatKwh(totals.energy)} unit="kWh" icon={<ShoppingBag className="size-4" />} tone="success" />
            <StatCard label="Simulated value" value={formatInr(totals.value, 2)} icon={<IndianRupee className="size-4" />} tone="success" hint="No financial settlement" />
          </div>
          <Card>
            <CardHeader title="Sales ledger" subtitle="Newest completed purchases first" icon={<ReceiptText className="size-4" aria-hidden="true" />} />
            <CardBody>{sales.isPending ? <TableSkeleton rows={6} /> : <PurchaseTable orders={items} perspective="seller" />}</CardBody>
          </Card>
        </>
      )}
    </PageBody>
  );
}
