import { Activity, IndianRupee, ShoppingBag, Zap } from "lucide-react";
import { PageBody, PageHeader } from "../../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/common/Card";
import { StatCard } from "../../components/common/StatCard";
import { Badge } from "../../components/common/Badge";
import { ErrorState } from "../../components/common/States";
import { ChartSkeleton, MetricSkeleton } from "../../components/common/Skeletons";
import { AccountEnergyPanel, AccountEnergyStats } from "../../components/account/AccountEnergy";
import { useBuyerUsage } from "../../hooks/queries";
import { formatInr, formatKwh, formatNumber, formatTime } from "../../utils/format";

export function BuyerUsagePage() {
  const usage = useBuyerUsage();
  const data = usage.data;

  if (usage.isPending) {
    return (
      <PageBody>
        <PageHeader eyebrow="Buyer workspace" title="Usage & demand" description="Loading your simulated household demand." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <MetricSkeleton key={index} />)}
        </div>
        <Card><CardBody><ChartSkeleton /></CardBody></Card>
      </PageBody>
    );
  }
  if (usage.isError || !data) {
    return (
      <PageBody>
        <PageHeader eyebrow="Buyer workspace" title="Usage & demand" />
        <ErrorState error={usage.error} title="Usage could not be loaded" onRetry={() => void usage.refetch()} />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        eyebrow="Buyer workspace"
        title="Usage & demand"
        description="Simulated household demand, forecast deficit and the energy you have purchased from peers."
        meta={
          <>
            <Badge tone="info" dot>{formatNumber(data.profile.demand_base_kw, 2)} kW baseline</Badge>
            <Badge tone="neutral" className="capitalize">{data.profile.household_category.replaceAll("_", " ")}</Badge>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Demand now" value={formatNumber(data.energy.current.demand_kw, 2)} unit="kW" icon={<Zap className="size-4" />} tone="warning" />
        <StatCard label="Daily deficit" value={formatKwh(data.energy.daily.deficit_kwh)} unit="kWh" icon={<Activity className="size-4" />} tone="info" hint="Forecast estimate" />
        <StatCard label="Purchased energy" value={formatKwh(data.spending.energy_purchased_kwh)} unit="kWh" icon={<ShoppingBag className="size-4" />} tone="success" />
        <StatCard label="Simulated spend" value={formatInr(data.spending.simulated_spend_inr, 2)} icon={<IndianRupee className="size-4" />} tone="neutral" hint="Not settled money" />
      </div>

      <AccountEnergyStats energy={data.energy} />
      <AccountEnergyPanel energy={data.energy} />

      <Card>
        <CardHeader title="Demand forecast" subtitle="Simulated hourly demand against available rooftop generation (none for this buyer)" icon={<Activity className="size-4" aria-hidden="true" />} />
        <CardBody className="overflow-x-auto pt-2">
          <table className="w-full min-w-[600px] text-left text-[11.5px]">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-[0.08em] text-slate-400">
                <th className="py-2 pr-3 font-medium">Time (IST)</th>
                <th className="px-3 py-2 font-medium">Demand</th>
                <th className="px-3 py-2 font-medium">Generation</th>
                <th className="px-3 py-2 font-medium">Basis</th>
                <th className="py-2 pl-3 text-right font-medium">Deficit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/80">
              {data.energy.forecast.series.map((point) => (
                <tr key={point.timestamp} className="text-slate-600">
                  <td className="py-2 pr-3 text-slate-500">{formatTime(point.timestamp)}</td>
                  <td className="num px-3 py-2">{formatNumber(point.demand_kw, 2)} kW</td>
                  <td className="num px-3 py-2">{formatNumber(point.generation_kw, 2)} kW</td>
                  <td className="px-3 py-2 text-[10.5px] capitalize text-slate-500">{point.demand_basis.replaceAll("_", " ")}</td>
                  <td className="num py-2 pl-3 text-right font-medium text-warn-700">
                    {formatNumber(Math.max(0, -point.imbalance_kw), 2)} kW
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </PageBody>
  );
}
