import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { EnergyOffer } from "../../types/api";
import { describeApiError } from "../../api/client";
import { formatKwh, formatPrice } from "../../utils/format";
import { Button } from "../common/Button";
import { Input } from "../common/Field";
import { InlineAlert } from "../common/States";
import { Modal } from "../common/Modal";

export function PurchaseDialog({
  offer,
  open,
  onClose,
  onPurchase,
}: {
  offer: EnergyOffer | null;
  open: boolean;
  onClose: () => void;
  onPurchase: (offer: EnergyOffer, quantity: number) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !offer) return;
    setQuantity(Math.min(1, offer.remaining_kwh).toFixed(2).replace(/\.?0+$/, ""));
    setError(null);
    setBusy(false);
  }, [open, offer]);

  if (!offer) return null;
  const parsed = Number(quantity);
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= offer.remaining_kwh + 1e-9;
  const total = valid ? parsed * offer.price_inr_kwh : 0;

  const submit = async () => {
    if (!valid) {
      setError(`Enter a quantity above 0 and no more than ${formatKwh(offer.remaining_kwh)} kWh.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onPurchase(offer, parsed);
      onClose();
    } catch (caught) {
      setError(describeApiError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Confirm energy purchase"
      description={
        <>
          {offer.seller_display_name} · {offer.location_name}
        </>
      }
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            Confirm purchase
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-line bg-slate-50/70 p-3 text-center">
          <div>
            <p className="label-xs">Price</p>
            <p className="num mt-1 text-sm font-semibold text-ink-900">{formatPrice(offer.price_inr_kwh)}</p>
            <p className="text-[10px] text-slate-500">per kWh</p>
          </div>
          <div className="border-x border-line">
            <p className="label-xs">Available</p>
            <p className="num mt-1 text-sm font-semibold text-ink-900">{formatKwh(offer.remaining_kwh)}</p>
            <p className="text-[10px] text-slate-500">kWh</p>
          </div>
          <div>
            <p className="label-xs">Offer</p>
            <p className="num mt-1 text-sm font-semibold text-ink-900">#{offer.id}</p>
            <p className="text-[10px] capitalize text-slate-500">{offer.status}</p>
          </div>
        </div>

        <Input
          label="Quantity to purchase (kWh)"
          type="number"
          min={0.01}
          max={offer.remaining_kwh}
          step={0.01}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          hint="The backend rechecks the active offer and remaining quantity atomically."
          autoFocus
        />

        <div className="flex items-center justify-between rounded-lg border border-energy-100 bg-energy-50/60 px-3 py-2.5">
          <span className="text-xs font-medium text-energy-700">Simulated purchase value</span>
          <span className="num text-base font-semibold text-energy-700">{formatPrice(total)}</span>
        </div>

        <div className="flex gap-2 text-[11px] leading-5 text-slate-500">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <span>
            The server ignores any client-supplied price, validates ownership and availability, and records a purchase
            order with a marketplace transaction. No money changes hands.
          </span>
        </div>
      </div>
    </Modal>
  );
}
