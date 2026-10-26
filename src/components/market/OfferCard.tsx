import { CalendarDays, MapPin, Pause, Pencil, Play, ShoppingBag, Trash2, UserRound } from "lucide-react";
import type { EnergyOffer, OfferStatus } from "../../types/api";
import { formatDateTime, formatKwh, formatNumber, formatPrice } from "../../utils/format";
import { Badge, type Tone } from "../common/Badge";
import { Button } from "../common/Button";
import { cn } from "../../utils/cn";

const STATUS_TONE: Record<OfferStatus, Tone> = {
  active: "success",
  paused: "warning",
  cancelled: "neutral",
  exhausted: "info",
};

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot className="capitalize">
      {status}
    </Badge>
  );
}

export function OfferCard({
  offer,
  mode,
  onBuy,
  onEdit,
  onPause,
  onResume,
  onCancel,
  busy,
}: {
  offer: EnergyOffer;
  mode: "buyer" | "seller";
  onBuy?: () => void;
  onEdit?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const soldPct = offer.quantity_kwh > 0 ? Math.min(100, (offer.sold_kwh / offer.quantity_kwh) * 100) : 0;
  const canBuy = offer.status === "active" && offer.remaining_kwh > 0;
  return (
    <article
      className={cn(
        "group rounded-xl border border-line bg-white p-4 shadow-card transition-shadow hover:shadow-raised",
        offer.status !== "active" && "bg-slate-50/50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <OfferStatusBadge status={offer.status} />
            <span className="text-[10px] text-slate-400">Offer #{offer.id}</span>
          </div>
          <p className="mt-2 display-num text-[22px] leading-7 tracking-[-0.02em] text-ink-900">
            {formatPrice(offer.price_inr_kwh)}
            <span className="ml-1 text-[11px] font-medium tracking-normal text-slate-500">/kWh</span>
          </p>
        </div>
        <div className="text-right">
          <p className="label-xs">Remaining</p>
          <p className="num mt-1 text-[15px] font-semibold text-ink-900">{formatKwh(offer.remaining_kwh)} kWh</p>
          <p className="mt-0.5 text-[10px] text-slate-400">of {formatKwh(offer.quantity_kwh)} kWh</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-energy-500 transition-all" style={{ width: `${Math.max(1, soldPct)}%` }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <UserRound className="size-3 text-slate-400" aria-hidden="true" />
          {mode === "buyer" ? offer.seller_display_name : `${formatKwh(offer.sold_kwh)} kWh sold`}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3 text-slate-400" aria-hidden="true" />
          {offer.location_name}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3 text-slate-400" aria-hidden="true" />
          {formatDateTime(offer.created_at)}
        </span>
      </div>

      {offer.note ? <p className="mt-2.5 rounded-md bg-slate-50 px-2.5 py-2 text-[11px] leading-5 text-slate-600">{offer.note}</p> : null}

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p className="text-[11px] text-slate-500">
          {mode === "buyer" ? (
            <>
              Estimated total{" "}
              <span className="num font-semibold text-ink-900">{formatPrice(offer.estimated_total_inr)}</span> for{" "}
              <span className="num">{formatKwh(offer.remaining_kwh)}</span> kWh
            </>
          ) : (
            <>
              Sold value <span className="num font-semibold text-ink-900">{formatPrice(offer.sold_kwh * offer.price_inr_kwh)}</span>
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {mode === "buyer" ? (
            <Button
              size="sm"
              variant="primary"
              icon={<ShoppingBag className="size-3.5" />}
              onClick={onBuy}
              disabled={!canBuy}
            >
              {canBuy ? "Buy energy" : offer.status === "exhausted" ? "Sold out" : "Unavailable"}
            </Button>
          ) : (
            <>
              {offer.status === "active" ? (
                <Button size="sm" variant="secondary" icon={<Pause className="size-3.5" />} onClick={onPause} disabled={busy}>
                  Pause
                </Button>
              ) : null}
              {offer.status === "paused" ? (
                <Button size="sm" variant="success" icon={<Play className="size-3.5" />} onClick={onResume} disabled={busy}>
                  Resume
                </Button>
              ) : null}
              {offer.status !== "cancelled" && offer.status !== "exhausted" ? (
                <>
                  <Button size="sm" variant="secondary" icon={<Pencil className="size-3.5" />} onClick={onEdit} disabled={busy}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={onCancel} disabled={busy}>
                    Cancel
                  </Button>
                </>
              ) : null}
              <span className="rounded-md bg-slate-100 px-2 py-1 text-[10.5px] text-slate-500">
                {formatNumber(offer.remaining_kwh / offer.quantity_kwh * 100, 0)}% remaining
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
