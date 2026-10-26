import { ClipboardList, Plus, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { PageBody, PageHeader } from "../../components/common/PageHeader";
import { Button } from "../../components/common/Button";
import { SegmentedControl } from "../../components/common/SegmentedControl";
import { EmptyState, ErrorState, InlineAlert } from "../../components/common/States";
import { TableSkeleton } from "../../components/common/Skeletons";
import { ConfirmDialog } from "../../components/common/Modal";
import { OfferCard } from "../../components/market/OfferCard";
import { OfferFormDialog } from "../../components/market/OfferFormDialog";
import { useSellerAvailability, useSellerOffers } from "../../hooks/queries";
import { useSellerMutations } from "../../hooks/useAccountActions";
import { formatKwh, formatNumber } from "../../utils/format";
import { describeApiError } from "../../api/client";
import type { EnergyOffer, OfferStatus } from "../../types/api";

type Filter = "all" | OfferStatus;

export function SellerOffersPage() {
  const offers = useSellerOffers();
  const availability = useSellerAvailability();
  const mutations = useSellerMutations();
  const [filter, setFilter] = useState<Filter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EnergyOffer | null>(null);
  const [cancelTarget, setCancelTarget] = useState<EnergyOffer | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const items = useMemo(() => {
    const list = offers.data?.items ?? [];
    const sorted = [...list].sort((a, b) => {
      const order: Record<OfferStatus, number> = { active: 0, paused: 1, exhausted: 2, cancelled: 3 };
      return order[a.status] - order[b.status] || b.id - a.id;
    });
    return filter === "all" ? sorted : sorted.filter((offer) => offer.status === filter);
  }, [offers.data, filter]);

  const busy =
    mutations.pauseOffer.isPending ||
    mutations.resumeOffer.isPending ||
    mutations.cancelOffer.isPending ||
    mutations.updateOffer.isPending;

  const runStatus = async (action: "pause" | "resume", offer: EnergyOffer) => {
    setActionError(null);
    try {
      if (action === "pause") await mutations.pauseOffer.mutateAsync(offer.id);
      else await mutations.resumeOffer.mutateAsync(offer.id);
    } catch (caught) {
      setActionError(describeApiError(caught));
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setActionError(null);
    try {
      await mutations.cancelOffer.mutateAsync(cancelTarget.id);
      setCancelTarget(null);
    } catch (caught) {
      setActionError(describeApiError(caught));
    }
  };

  return (
    <PageBody>
      <PageHeader
        eyebrow="Seller workspace"
        title="My offers"
        description="Publish estimated rooftop surplus, adjust price and quantity, pause availability or cancel an offer."
        meta={
          <>
            <span className="text-[11px] text-slate-500">
              Available to offer:{" "}
              <span className="num font-semibold text-ink-900">
                {availability.data ? `${formatKwh(availability.data.available_to_offer_kwh)} kWh` : "—"}
              </span>
            </span>
            {availability.data ? (
              <span className="text-[11px] text-slate-500">
                Reserved: <span className="num font-semibold text-ink-900">{formatKwh(availability.data.reserved_offer_kwh)} kWh</span>
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              icon={<RefreshCw className="size-4" />}
              onClick={() => {
                void offers.refetch();
                void availability.refetch();
              }}
              loading={offers.isFetching || availability.isFetching}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              icon={<Plus className="size-4" />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              disabled={!availability.data || availability.data.available_to_offer_kwh <= 0}
            >
              New offer
            </Button>
          </>
        }
      />

      {actionError ? <InlineAlert tone="danger">{actionError}</InlineAlert> : null}
      {availability.isError ? (
        <InlineAlert tone="warning">
          Availability could not be loaded. Offer creation is disabled until the backend returns a valid estimate.
        </InlineAlert>
      ) : null}
      {availability.data && availability.data.available_to_offer_kwh <= 0 ? (
        <InlineAlert tone="info">
          No unreserved surplus is currently available. Pause or cancel an existing offer, or wait for the next forecast.
        </InlineAlert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Filter offers"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `All ${offers.data?.count ?? 0}` },
            { value: "active", label: "Active" },
            { value: "paused", label: "Paused" },
            { value: "cancelled", label: "Cancelled" },
            { value: "exhausted", label: "Exhausted" },
          ]}
        />
        <p className="text-[11px] text-slate-500">
          {filter === "all" ? `${formatNumber(items.length, 0)} total` : `${formatNumber(items.length, 0)} ${filter}`}
        </p>
      </div>

      {offers.isPending ? (
        <div className="card px-4 py-4">
          <TableSkeleton rows={4} />
        </div>
      ) : offers.isError ? (
        <ErrorState error={offers.error} title="Offers could not be loaded" onRetry={() => void offers.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-4.5" aria-hidden="true" />}
          title={filter === "all" ? "No offers yet" : `No ${filter} offers`}
          description={
            filter === "all"
              ? "Create your first offer from your estimated rooftop surplus. Buyers will see the price and remaining quantity."
              : "Choose another filter or create a new offer."
          }
          action={
            filter === "all" ? (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="size-3.5" />}
                onClick={() => setFormOpen(true)}
                disabled={!availability.data || availability.data.available_to_offer_kwh <= 0}
              >
                Create offer
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {items.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              mode="seller"
              busy={busy}
              onPause={() => void runStatus("pause", offer)}
              onResume={() => void runStatus("resume", offer)}
              onEdit={() => {
                setEditing(offer);
                setFormOpen(true);
              }}
              onCancel={() => setCancelTarget(offer)}
            />
          ))}
        </div>
      )}

      <OfferFormDialog
        open={formOpen}
        offer={editing}
        availability={availability.data ?? null}
        onClose={() => setFormOpen(false)}
        onSubmit={async (payload) => {
          if (editing) await mutations.updateOffer.mutateAsync({ id: editing.id, payload });
          else await mutations.createOffer.mutateAsync(payload);
        }}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title={`Cancel offer #${cancelTarget?.id ?? ""}?`}
        description="Buyers will no longer be able to purchase this offer. Completed sales remain in your ledger."
        confirmLabel="Cancel offer"
        loading={mutations.cancelOffer.isPending}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => void confirmCancel()}
      >
        {cancelTarget ? (
          <div className="rounded-lg border border-line bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            <span className="num font-semibold text-ink-900">{formatKwh(cancelTarget.remaining_kwh)} kWh</span> remaining at{" "}
            <span className="num font-semibold text-ink-900">₹{cancelTarget.price_inr_kwh.toFixed(2)}/kWh</span>.
          </div>
        ) : null}
      </ConfirmDialog>
    </PageBody>
  );
}
