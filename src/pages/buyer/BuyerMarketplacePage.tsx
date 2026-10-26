import { Filter, RefreshCw, Search, ShoppingBag, Store, X } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { PageBody, PageHeader } from "../../components/common/PageHeader";
import { Button } from "../../components/common/Button";
import { Input, Select } from "../../components/common/Field";
import { Badge } from "../../components/common/Badge";
import { EmptyState, ErrorState, InlineAlert } from "../../components/common/States";
import { TableSkeleton } from "../../components/common/Skeletons";
import { OfferCard } from "../../components/market/OfferCard";
import { PurchaseDialog } from "../../components/market/PurchaseDialog";
import { useMarketOffers } from "../../hooks/queries";
import { useBuyerMutations } from "../../hooks/useAccountActions";
import type { EnergyOffer } from "../../types/api";
import { formatKwh, formatNumber, formatPrice } from "../../utils/format";

type Sort = "price_asc" | "price_desc" | "quantity_desc" | "newest";

export function BuyerMarketplacePage() {
  const mutations = useBuyerMutations();
  const [search, setSearch] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const [sort, setSort] = useState<Sort>("price_asc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<EnergyOffer | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());

  const filters = {
    q: deferredSearch || undefined,
    max_price: maxPrice ? Number(maxPrice) : undefined,
    min_quantity: minQuantity ? Number(minQuantity) : undefined,
    sort,
    limit: 60,
  };
  const offers = useMarketOffers(filters);
  const items = offers.data?.items ?? [];
  const hasFilters = Boolean(search || maxPrice || minQuantity);

  return (
    <PageBody>
      <PageHeader
        eyebrow="Buyer workspace"
        title="Browse energy offers"
        description="Compare live seller offers by price, remaining quantity and location. The backend revalidates every purchase."
        meta={
          <>
            <Badge tone="success" dot>{formatNumber(items.length, 0)} offer{items.length === 1 ? "" : "s"} shown</Badge>
            <Badge tone="neutral">Server-validated prices</Badge>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Filter className="size-4" />}
              onClick={() => setFiltersOpen((value) => !value)}
              aria-expanded={filtersOpen}
            >
              Filters
            </Button>
            <Button
              variant="secondary"
              icon={<RefreshCw className="size-4" />}
              onClick={() => void offers.refetch()}
              loading={offers.isFetching}
            >
              Refresh
            </Button>
          </>
        }
      />

      {notice ? <InlineAlert tone="info">{notice}</InlineAlert> : null}

      <div className="card px-4 py-3.5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search seller, location or note…"
              aria-label="Search offers"
              className="focus-ring h-9 w-full rounded-lg border border-slate-300 bg-white pl-8.5 pr-8 text-sm text-ink-900 placeholder:text-slate-400"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="focus-ring absolute right-1.5 top-1.5 rounded p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Clear search"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Select
              label="Sort"
              options={[
                { value: "price_asc", label: "Lowest price" },
                { value: "price_desc", label: "Highest price" },
                { value: "quantity_desc", label: "Most energy" },
                { value: "newest", label: "Newest" },
              ]}
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
            />
          </div>
        </div>

        {filtersOpen ? (
          <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              label="Maximum price (₹/kWh)"
              type="number"
              min={0}
              step={0.5}
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder="Any"
            />
            <Input
              label="Minimum remaining (kWh)"
              type="number"
              min={0}
              step={0.1}
              value={minQuantity}
              onChange={(event) => setMinQuantity(event.target.value)}
              placeholder="Any"
            />
            <div className="flex items-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setMaxPrice("");
                  setMinQuantity("");
                  setSort("price_asc");
                }}
                disabled={!hasFilters && sort === "price_asc"}
              >
                Reset filters
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {offers.isPending ? (
        <div className="card px-4 py-4"><TableSkeleton rows={5} /></div>
      ) : offers.isError ? (
        <ErrorState error={offers.error} title="Marketplace could not be loaded" onRetry={() => void offers.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Store className="size-4.5" aria-hidden="true" />}
          title={hasFilters ? "No offers match these filters" : "The marketplace is empty"}
          description={
            hasFilters
              ? "Try widening your price or quantity filters, or clear the search."
              : "No seller has published active surplus yet. Refresh or check back after the next forecast."
          }
          action={
            hasFilters ? (
              <Button size="sm" variant="secondary" onClick={() => { setSearch(""); setMaxPrice(""); setMinQuantity(""); }}>
                Clear filters
              </Button>
            ) : (
              <Button size="sm" variant="secondary" icon={<RefreshCw className="size-3.5" />} onClick={() => void offers.refetch()} loading={offers.isFetching}>
                Refresh
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500">
              Showing <span className="num font-medium text-ink-900">{items.length}</span> offer{items.length === 1 ? "" : "s"} sorted by{" "}
              {sort === "price_asc" ? "lowest price" : sort === "price_desc" ? "highest price" : sort === "quantity_desc" ? "most energy" : "newest"}
            </p>
            <p className="text-[11px] text-slate-500">
              Cheapest:{" "}
              <span className="num font-medium text-ink-900">
                {items.length ? formatPrice(Math.min(...items.map((offer) => offer.price_inr_kwh))) : "—"}
              </span>
            </p>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {items.map((offer) => (
              <OfferCard key={offer.id} offer={offer} mode="buyer" onBuy={() => { setNotice(null); setSelected(offer); }} />
            ))}
          </div>
        </>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-line bg-white px-4 py-3 text-[11px] leading-5 text-slate-500">
        <ShoppingBag className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <p>
          Purchase quantities are authoritative on the server. If another buyer takes the remaining energy first, the
          backend rejects the purchase with a conflict instead of overselling. Client-supplied prices are ignored.
        </p>
      </div>

      <PurchaseDialog
        offer={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        onPurchase={async (offer, quantity) => {
          const order = await mutations.purchase.mutateAsync({ offer_id: offer.id, quantity_kwh: quantity });
          setSelected(null);
          setNotice(
            `Purchased ${formatKwh(order.quantity_kwh)} kWh from ${order.seller_display_name} for ${formatPrice(order.total_value_inr)} (simulated).`,
          );
        }}
      />
    </PageBody>
  );
}
