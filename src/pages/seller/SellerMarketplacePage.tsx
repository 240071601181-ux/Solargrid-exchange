import { ArrowRight, ClipboardList, Eye, IndianRupee, Store, Users } from "lucide-react";
import { Link } from "react-router";
import { PageBody, PageHeader } from "../../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/common/Card";
import { StatCard } from "../../components/common/StatCard";
import { Button } from "../../components/common/Button";
import { Badge } from "../../components/common/Badge";
import { ErrorState, EmptyState } from "../../components/common/States";
import { OfferStatusBadge } from "../../components/market/OfferCard";
import { useMarketOffers, useSellerMarketDemand, useSellerOffers, useSharedStatus } from "../../hooks/queries";
import { formatKwh, formatNumber, formatPrice } from "../../utils/format";

export function SellerMarketplacePage() {
  const demand = useSellerMarketDemand();
  const shared = useSharedStatus();
  const market = useMarketOffers({ sort: "price_asc", limit: 12 });
  const own = useSellerOffers();

  return (
    <PageBody>
      <PageHeader
        eyebrow="Seller workspace"
        title="Marketplace demand"
        description="Aggregate buyer demand and the active offer book. Individual buyer identities and private purchases stay hidden."
        meta={
          shared.data ? (
            <Badge tone="success" dot>{formatPrice(shared.data.pricing.price_inr_kwh)}/kWh current dynamic price</Badge>
          ) : null
        }
        actions={
          <Link to="/seller/offers">
            <Button variant="primary" icon={<ClipboardList className="size-4" />}>Manage my offers</Button>
          </Link>
        }
      />

      {demand.isError ? (
        <ErrorState error={demand.error} title="Market demand could not be loaded" onRetry={() => void demand.refetch()} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Registered buyers"
            value={formatNumber(demand.data?.registered_buyers ?? 0, 0)}
            icon={<Users className="size-4" />}
            tone="info"
            hint="Aggregate count only"
          />
          <StatCard
            label="Baseline buyer demand"
            value={formatNumber(demand.data?.total_baseline_demand_kw ?? 0, 2)}
            unit="kW"
            icon={<IndianRupee className="size-4" />}
            tone="warning"
            hint="Sum of buyer profiles"
          />
          <StatCard
            label="Active market offers"
            value={formatNumber(demand.data?.active_offers ?? 0, 0)}
            icon={<Store className="size-4" />}
            tone="success"
            hint="All sellers"
          />
          <StatCard
            label="Your active offers"
            value={formatNumber(own.data?.items.filter((offer) => offer.status === "active").length ?? 0, 0)}
            icon={<ClipboardList className="size-4" />}
            tone="neutral"
            hint="Visible to buyers"
          />
        </div>
      )}

      <Card>
        <CardHeader
          title="Active offer book"
          subtitle="Anonymised view of current public offers; buyer identities are never exposed"
          icon={<Eye className="size-4" aria-hidden="true" />}
          action={
            <Link to="/seller/offers" className="text-[11px] font-medium text-energy-700 hover:underline">
              My offers <ArrowRight className="ml-0.5 inline size-3" aria-hidden="true" />
            </Link>
          }
        />
        <CardBody className="space-y-2.5">
          {market.isPending ? (
            <p className="py-6 text-center text-xs text-slate-500">Loading active offers…</p>
          ) : market.isError ? (
            <ErrorState error={market.error} compact title="Market offers could not be loaded" onRetry={() => void market.refetch()} />
          ) : (market.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="No active offers" description="The public offer book is empty. Your published offers will appear here." className="border-0 bg-transparent" />
          ) : (
            market.data?.items.map((offer) => (
              <div key={offer.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <OfferStatusBadge status={offer.status} />
                    <span className="truncate text-[11.5px] font-medium text-ink-900">{offer.seller_display_name}</span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-slate-500">
                    {offer.location_name} · {offer.note || "No note"}
                  </p>
                </div>
                <div className="flex items-center gap-5 text-right">
                  <div>
                    <p className="num text-[12px] font-semibold text-ink-900">{formatKwh(offer.remaining_kwh)} kWh</p>
                    <p className="text-[10px] text-slate-400">remaining</p>
                  </div>
                  <div>
                    <p className="num text-[12px] font-semibold text-ink-900">{formatPrice(offer.price_inr_kwh)}</p>
                    <p className="text-[10px] text-slate-400">per kWh</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Demand privacy" subtitle="What sellers can and cannot see" icon={<Users className="size-4" aria-hidden="true" />} />
          <CardBody className="space-y-2 text-[11.5px] leading-5 text-slate-500">
            <p>{demand.data?.privacy_note ?? "Only aggregate demand is exposed to sellers."}</p>
            <ul className="space-y-1.5">
              <li>• Buyer names and emails are never included in aggregate demand.</li>
              <li>• Buyer account purchases are visible only to that buyer and the seller of the specific offer.</li>
              <li>• Seller routes reject buyer sessions before business logic runs.</li>
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Pricing context" subtitle="Current shared market signal" icon={<IndianRupee className="size-4" aria-hidden="true" />} />
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Current dynamic price</span>
              <span className="num font-semibold text-ink-900">{shared.data ? formatPrice(shared.data.pricing.price_inr_kwh) : "—"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Simulation tick</span>
              <span className="num font-semibold text-ink-900">{shared.data ? `t${shared.data.state.tick}` : "—"}</span>
            </div>
            <p className="rounded-md bg-slate-50 px-2.5 py-2 text-[10.5px] leading-5 text-slate-500">
              Offer prices are set explicitly by each seller. Dynamic pricing is a separate simulation signal and does
              not automatically reprice your offers.
            </p>
          </CardBody>
        </Card>
      </div>
    </PageBody>
  );
}
