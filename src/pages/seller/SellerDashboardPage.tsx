import { ArrowUpRight, ClipboardList, IndianRupee, ShoppingBag, Store, TrendingUp, Users } from "lucide-react";
import { Link } from "react-router";
import { PageBody, PageHeader } from "../../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/common/Card";
import { StatCard } from "../../components/common/StatCard";
import { Button } from "../../components/common/Button";
import { Badge } from "../../components/common/Badge";
import { ErrorState, EmptyState } from "../../components/common/States";
import { MetricSkeleton, ChartSkeleton } from "../../components/common/Skeletons";
import { AccountEnergyPanel, AccountEnergyStats } from "../../components/account/AccountEnergy";
import { AccountValueChart } from "../../components/account/AccountValueChart";
import { OfferStatusBadge } from "../../components/market/OfferCard";
import { useSellerDashboard } from "../../hooks/queries";
import { formatInr, formatKwh, formatNumber, formatPrice } from "../../utils/format";

export function SellerDashboardPage() {
  const query = useSellerDashboard();
  const data = query.data;

  if (query.isPending) {
    return (
      <PageBody>
        <PageHeader eyebrow="Seller workspace" title="Seller dashboard" description="Loading your private solar and offer summary." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <MetricSkeleton key={index} />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Card><CardBody><ChartSkeleton /></CardBody></Card>
          <Card><CardBody><ChartSkeleton /></CardBody></Card>
        </div>
      </PageBody>
    );
  }

  if (query.isError || !data) {
    return (
      <PageBody>
        <PageHeader eyebrow="Seller workspace" title="Seller dashboard" />
        <ErrorState error={query.error} title="Seller dashboard unavailable" onRetry={() => void query.refetch()} />
      </PageBody>
    );
  }

  const activeOffers = data.offers.filter((offer) => offer.status === "active");
  return (
    <PageBody>
      <PageHeader
        eyebrow="Seller workspace"
        title={`Good to see you, ${data.profile.display_name.split(" ")[0]}`}
        description="Your rooftop estimate, live offers, simulated sales and marketplace demand in one place."
        meta={
          <>
            <Badge tone="success" dot>{formatPrice(data.pricing.price_inr_kwh)}/kWh dynamic</Badge>
            <Badge tone="neutral">{data.profile.location_name}</Badge>
            <Badge tone="info">
              {formatNumber(data.profile.solar_capacity_kw, 1)} kW solar
            </Badge>
          </>
        }
        actions={
          <>
            <Link to="/seller/marketplace">
              <Button variant="secondary" icon={<Store className="size-4" />}>Marketplace</Button>
            </Link>
            <Link to="/seller/offers">
              <Button variant="primary" icon={<ClipboardList className="size-4" />}>Manage offers</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Simulated value today"
          value={formatInr(data.today.simulated_value_today_inr, 2)}
          icon={<IndianRupee className="size-4" />}
          tone="success"
          hint="Not settled money"
        />
        <StatCard
          label="Energy sold today"
          value={formatKwh(data.today.energy_sold_today_kwh)}
          unit="kWh"
          icon={<ShoppingBag className="size-4" />}
          tone="info"
          hint={`${data.today.sales_today} completed sale${data.today.sales_today === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Active offers"
          value={formatNumber(activeOffers.length, 0)}
          icon={<ClipboardList className="size-4" />}
          tone="neutral"
          hint={`${data.offers.length} total offer${data.offers.length === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Registered buyer demand"
          value={formatNumber(data.market_demand.total_baseline_demand_kw, 1)}
          unit="kW"
          icon={<Users className="size-4" />}
          tone="warning"
          hint={`${data.market_demand.registered_buyers} buyer account${data.market_demand.registered_buyers === 1 ? "" : "s"}`}
        />
      </div>

      <AccountEnergyStats energy={data.energy} />
      <AccountEnergyPanel energy={data.energy} />

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader
            title="Live offers"
            subtitle="Only your offers are shown here"
            icon={<ClipboardList className="size-4" aria-hidden="true" />}
            action={
              <Link to="/seller/offers" className="text-[11px] font-medium text-energy-700 hover:underline">
                Open offers <ArrowUpRight className="ml-0.5 inline size-3" aria-hidden="true" />
              </Link>
            }
          />
          <CardBody className="space-y-2.5">
            {data.offers.length === 0 ? (
              <EmptyState
                title="No offers yet"
                description="Turn part of your estimated surplus into a live marketplace offer."
                action={
                  <Link to="/seller/offers">
                    <Button size="sm" variant="primary">Create an offer</Button>
                  </Link>
                }
                className="border-0 bg-transparent"
              />
            ) : (
              data.offers.slice(0, 4).map((offer) => (
                <div key={offer.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <OfferStatusBadge status={offer.status} />
                      <span className="num text-[11px] text-slate-400">#{offer.id}</span>
                    </div>
                    <p className="mt-1 truncate text-[11.5px] text-slate-500">
                      <span className="num font-medium text-ink-900">{formatKwh(offer.remaining_kwh)} kWh</span> remaining ·{" "}
                      {offer.note || "No buyer note"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="num text-sm font-semibold text-ink-900">{formatPrice(offer.price_inr_kwh)}</p>
                    <p className="text-[10px] text-slate-400">per kWh</p>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Simulated earnings"
              subtitle="Completed marketplace sales"
              icon={<TrendingUp className="size-4" aria-hidden="true" />}
              action={
                <Link to="/seller/earnings" className="text-[11px] font-medium text-energy-700 hover:underline">
                  Details
                </Link>
              }
            />
            <CardBody>
              <p className="num text-[30px] font-semibold leading-9 tracking-[-0.03em] text-ink-900">
                {formatInr(data.earnings.simulated_sales_value_inr, 2)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {formatKwh(data.earnings.energy_sold_kwh)} kWh sold · avg{" "}
                {data.earnings.average_realized_price_inr_kwh != null
                  ? formatPrice(data.earnings.average_realized_price_inr_kwh)
                  : "—"}
              </p>
              <div className="mt-4">
                <AccountValueChart data={data.earnings.daily_series} label="Simulated daily earnings" height={150} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Marketplace demand" subtitle="Aggregate buyer signal" icon={<Users className="size-4" aria-hidden="true" />} />
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Registered buyers</span>
                <span className="num font-semibold text-ink-900">{data.market_demand.registered_buyers}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Active offers in market</span>
                <span className="num font-semibold text-ink-900">{data.market_demand.active_offers}</span>
              </div>
              <p className="rounded-md bg-slate-50 px-2.5 py-2 text-[10.5px] leading-5 text-slate-500">
                {data.market_demand.privacy_note}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Model assumptions" subtitle="What is real and what is simulated" />
        <CardBody>
          <ul className="grid gap-2 text-[11.5px] leading-5 text-slate-500 sm:grid-cols-2">
            {data.assumptions.map((assumption) => (
              <li key={assumption} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-energy-500" aria-hidden="true" />
                {assumption}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </PageBody>
  );
}
