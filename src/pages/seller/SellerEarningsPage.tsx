import { BadgeIndianRupee, IndianRupee, TrendingUp, Zap } from "lucide-react";
import { PageBody, PageHeader } from "../../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/common/Card";
import { StatCard } from "../../components/common/StatCard";
import { ErrorState } from "../../components/common/States";
import { ChartSkeleton, MetricSkeleton, TableSkeleton } from "../../components/common/Skeletons";
import { AccountValueChart } from "../../components/account/AccountValueChart";
import { PurchaseTable } from "../../components/account/PurchaseTable";
import { useSellerEarnings } from "../../hooks/queries";
import { formatInr, formatKwh, formatNumber, formatPrice } from "../../utils/format";

export function SellerEarningsPage() {
  const earnings = useSellerEarnings();
  const data = earnings.data;

  if (earnings.isPending) {
    return (
      <PageBody>
        <PageHeader eyebrow="Seller workspace" title="Earnings" description="Loading simulated earnings." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <MetricSkeleton key={index} />)}
        </div>
        <Card><CardBody><ChartSkeleton /></CardBody></Card>
      </PageBody>
    );
  }
  if (earnings.isError || !data) {
    return (
      <PageBody>
        <PageHeader eyebrow="Seller workspace" title="Earnings" />
        <ErrorState error={earnings.error} title="Earnings could not be loaded" onRetry={() => void earnings.refetch()} />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        eyebrow="Seller workspace"
        title="Earnings"
        description="Simulated value from completed marketplace sales. No money is transferred or settled."
        meta={<span className="text-[11px] text-slate-500">All values are model output, not financial statements.</span>}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Simulated sales value" value={formatInr(data.simulated_sales_value_inr, 2)} icon={<IndianRupee className="size-4" />} tone="success" />
        <StatCard label="Energy sold" value={formatKwh(data.energy_sold_kwh)} unit="kWh" icon={<Zap className="size-4" />} tone="info" />
        <StatCard
          label="Average realized price"
          value={data.average_realized_price_inr_kwh != null ? formatPrice(data.average_realized_price_inr_kwh) : "—"}
          icon={<TrendingUp className="size-4" />}
          tone="neutral"
          hint="Weighted by completed purchases"
        />
        <StatCard label="Completed sales" value={formatNumber(data.completed_sales, 0)} icon={<BadgeIndianRupee className="size-4" />} tone="neutral" />
      </div>

      <Card>
        <CardHeader title="Daily simulated value" subtitle="Completed sales grouped by IST calendar day" icon={<TrendingUp className="size-4" aria-hidden="true" />} />
        <CardBody>
          <AccountValueChart data={data.daily_series} label="Simulated daily sales value" height={230} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Recent sales" subtitle="Latest completed purchases" />
        <CardBody>
          {earnings.isFetching ? <TableSkeleton rows={4} /> : <PurchaseTable orders={data.recent_sales} perspective="seller" />}
        </CardBody>
      </Card>
    </PageBody>
  );
}
