import { ArrowRight, IndianRupee, ReceiptText, ShoppingBag, Store, Zap } from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";
import { PageBody, PageHeader } from "../../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/common/Card";
import { StatCard } from "../../components/common/StatCard";
import { Button } from "../../components/common/Button";
import { Badge } from "../../components/common/Badge";
import { EmptyState, ErrorState, InlineAlert } from "../../components/common/States";
import { ChartSkeleton, MetricSkeleton } from "../../components/common/Skeletons";
import { AccountEnergyPanel, AccountEnergyStats } from "../../components/account/AccountEnergy";
import { AccountValueChart } from "../../components/account/AccountValueChart";
import { OfferCard } from "../../components/market/OfferCard";
import { PurchaseDialog } from "../../components/market/PurchaseDialog";
import { useBuyerDashboard } from "../../hooks/queries";
import { useBuyerMutations } from "../../hooks/useAccountActions";
import type { EnergyOffer } from "../../types/api";
import { formatInr, formatKwh, formatNumber, formatPrice } from "../../utils/format";

export function BuyerDashboardPage() {
  const query = useBuyerDashboard();
  const mutations = useBuyerMutations();
  const [selectedOffer, setSelectedOffer] = useState<EnergyOffer | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const data = query.data;

  if (query.isPending) {
    return (
      <PageBody>
        <PageHeader eyebrow="Buyer workspace" title="Buyer dashboard" description="Loading your private demand and purchase summary." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <MetricSkeleton key={index} />)}
        </div>
        <Card><CardBody><ChartSkeleton /></CardBody></Card>
      </PageBody>
    );
  }
  if (query.isError || !data) {
    return (
      <PageBody>
        <PageHeader eyebrow="Buyer workspace" title="Buyer dashboard" />
        <ErrorState error={query.error} title="Buyer dashboard unavailable" onRetry={() => void query.refetch()} />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        eyebrow="Buyer workspace"
        title={`Good to see you, ${data.profile.display_name.split(" ")[0]}`}
        description="Your simulated demand, local marketplace offers and purchase ledger."
        meta={
          <>
            <Badge tone="info" dot>{formatPrice(data.pricing.price_inr_kwh)}/kWh market signal</Badge>
            <Badge tone="neutral">{data.profile.location_name}</Badge>
            <Badge tone="neutral" className="capitalize">{data.profile.household_category.replaceAll("_", " ")}</Badge>
          </>
        }
        actions={
          <Link to="/buyer/marketplace">
            <Button variant="primary" icon={<Store className="size-4" />}>Browse offers</Button>
          </Link>
        }
      />

      {notice ? <InlineAlert tone="info">{notice}</InlineAlert> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Simulated spend"
          value={formatInr(data.spending.simulated_spend_inr, 2)}
          icon={<IndianRupee className="size-4" />}
          tone="success"
          hint="No financial settlement"
        />
        <StatCard
          label="Energy purchased"
          value={formatKwh(data.spending.energy_purchased_kwh)}
          unit="kWh"
          icon={<ShoppingBag className="size-4" />}
          tone="info"
          hint={`${data.spending.completed_purchases} completed purchase${data.spending.completed_purchases === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Current demand"
          value={formatNumber(data.energy.current.demand_kw, 2)}
          unit="kW"
          icon={<Zap className="size-4" />}
          tone="warning"
          hint={`${formatKwh(data.energy.daily.deficit_kwh)} kWh daily deficit`}
        />
        <StatCard
          label="Available offers"
          value={formatNumber(data.available_offers.length, 0)}
          icon={<Store className="size-4" />}
          tone="neutral"
          hint="Live public offers"
        />
      </div>

      <AccountEnergyStats energy={data.energy} />
      <AccountEnergyPanel energy={data.energy} />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Best local offers"
            subtitle="Lowest-priced active offers"
            icon={<Store className="size-4" aria-hidden="true" />}
            action={
              <Link to="/buyer/marketplace" className="text-[11px] font-medium text-energy-700 hover:underline">
                View all <ArrowRight className="ml-0.5 inline size-3" aria-hidden="true" />
              </Link>
            }
          />
          <CardBody className="space-y-3">
            {data.available_offers.length === 0 ? (
              <EmptyState
                title="No active offers"
                description="The marketplace is empty right now. Sellers will appear here when they publish surplus."
                className="border-0 bg-transparent"
                action={<Link to="/buyer/marketplace"><Button size="sm" variant="secondary">Refresh marketplace</Button></Link>}
              />
            ) : (
              data.available_offers.slice(0, 3).map((offer) => (
                <OfferCard key={offer.id} offer={offer} mode="buyer" onBuy={() => setSelectedOffer(offer)} />
              ))
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Purchase spending"
              subtitle="Completed marketplace purchases"
              icon={<ReceiptText className="size-4" aria-hidden="true" />}
              action={<Link to="/buyer/purchases" className="text-[11px] font-medium text-energy-700 hover:underline">Ledger</Link>}
            />
            <CardBody>
              <p className="num text-[28px] font-semibold leading-8 tracking-[-0.03em] text-ink-900">
                {formatInr(data.spending.simulated_spend_inr, 2)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {formatKwh(data.spending.energy_purchased_kwh)} kWh · avg{" "}
                {data.spending.average_purchase_price_inr_kwh != null
                  ? formatPrice(data.spending.average_purchase_price_inr_kwh)
                  : "—"}
              </p>
              <div className="mt-4">
                <AccountValueChart data={data.spending.daily_series} label="Simulated daily purchase spend" height={150} />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Why offers matter" subtitle="Peer-to-peer, not grid tariff" />
            <CardBody className="text-[11.5px] leading-5 text-slate-500">
              <p>
                Marketplace offers are seller-priced. The dynamic simulation price is shown as context but does not
                automatically set offer prices. Purchases are simulated and do not settle money.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <PurchaseDialog
        offer={selectedOffer}
        open={Boolean(selectedOffer)}
        onClose={() => setSelectedOffer(null)}
        onPurchase={async (offer, quantity) => {
          const order = await mutations.purchase.mutateAsync({ offer_id: offer.id, quantity_kwh: quantity });
          setNotice(
            `Purchased ${formatKwh(order.quantity_kwh)} kWh from ${order.seller_display_name} for ${formatPrice(order.total_value_inr)} (simulated).`,
          );
        }}
      />
    </PageBody>
  );
}
