import { useEffect, useState } from "react";
import type { EnergyOffer, OfferAvailability, OfferCreate } from "../../types/api";
import { describeApiError } from "../../api/client";
import { formatKwh, formatPrice } from "../../utils/format";
import { Button } from "../common/Button";
import { Input } from "../common/Field";
import { InlineAlert } from "../common/States";
import { Modal } from "../common/Modal";

export function OfferFormDialog({
  open,
  offer,
  availability,
  onClose,
  onSubmit,
}: {
  open: boolean;
  offer?: EnergyOffer | null;
  availability: OfferAvailability | null;
  onClose: () => void;
  onSubmit: (payload: OfferCreate) => Promise<void>;
}) {
  const editing = Boolean(offer);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("5.50");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sold = offer?.sold_kwh ?? 0;
  const maxQuantity = (availability?.available_to_offer_kwh ?? 0) + sold;

  useEffect(() => {
    if (!open) return;
    setQuantity(offer ? String(offer.quantity_kwh) : "");
    setPrice(offer ? String(offer.price_inr_kwh) : "5.50");
    setNote(offer?.note ?? "");
    setError(null);
    setBusy(false);
  }, [open, offer]);

  const parsedQuantity = Number(quantity);
  const parsedPrice = Number(price);
  const submit = async () => {
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError("Enter a quantity above zero.");
      return;
    }
    if (parsedQuantity > maxQuantity + 1e-6) {
      setError(`The available estimated surplus is ${formatKwh(maxQuantity)} kWh.`);
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0.5 || parsedPrice > 20) {
      setError("Enter a price between ₹0.50 and ₹20.00 per kWh.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ quantity_kwh: parsedQuantity, price_inr_kwh: parsedPrice, note: note.trim() || undefined });
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
      title={editing ? `Edit offer #${offer?.id}` : "Create a solar offer"}
      description={
        availability?.has_forecast
          ? `${formatKwh(availability.available_to_offer_kwh)} kWh available from your estimated daily surplus.`
          : "No live forecast is available. The server will still validate against the latest estimate."
      }
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            {editing ? "Save changes" : "Publish offer"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Quantity (kWh)"
            type="number"
            min={0.01}
            max={Math.max(0.01, maxQuantity)}
            step={0.01}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            hint={editing ? `Maximum ${formatKwh(maxQuantity)} kWh including sold energy.` : "Cannot exceed available estimated surplus."}
            autoFocus
          />
          <Input
            label="Price (₹/kWh)"
            type="number"
            min={0.5}
            max={20}
            step={0.01}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            hint="Buyers pay this server-side price."
          />
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-slate-50/70 p-3">
          <div>
            <p className="label-xs">Estimated value</p>
            <p className="num mt-1 text-sm font-semibold text-ink-900">
              {formatPrice(Number.isFinite(parsedQuantity) && Number.isFinite(parsedPrice) ? parsedQuantity * parsedPrice : 0)}
            </p>
          </div>
          <div className="border-l border-line pl-3">
            <p className="label-xs">Reserved now</p>
            <p className="num mt-1 text-sm font-semibold text-ink-900">{formatKwh(availability?.reserved_offer_kwh ?? 0)} kWh</p>
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-700">Note for buyers (optional)</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={280}
            placeholder="e.g. Midday rooftop surplus, available until 4 pm."
            className="focus-ring w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-slate-400"
          />
          <span className="mt-1 block text-right text-[10px] text-slate-400">{note.length}/280</span>
        </label>
        <p className="text-[11px] leading-5 text-slate-500">
          Publishing an offer does not move energy immediately. A purchase reserves and deducts energy atomically; the
          remaining quantity updates as buyers purchase.
        </p>
      </div>
    </Modal>
  );
}
