import { ArrowDownRight, ArrowUpRight, IndianRupee, Scale } from "lucide-react";
import type { Pricing, Totals } from "../../types/api";
import { formatInr, formatNumber, formatPrice } from "../../utils/format";
import { Card, CardBody, CardHeader } from "../common/Card";
import { Badge } from "../common/Badge";
import { InlineAlert } from "../common/States";

export function PricePanel({ pricing, totals }: { pricing: Pricing; totals: Totals }) {
  const span = pricing.max_price_inr_kwh - pricing.min_price_inr_kwh;
  const position = span > 0 ? ((pricing.price_inr_kwh - pricing.min_price_inr_kwh) / span) * 100 : 50;
  const basePosition = span > 0 ? ((pricing.base_price_inr_kwh - pricing.min_price_inr_kwh) / span) * 100 : 50;
  const delta = pricing.price_inr_kwh - pricing.base_price_inr_kwh;
  const hasTick = totals.generation_kw !== null;

  return (
    <Card className="h-full">
      <CardHeader
        title="Clearing price"
        subtitle="Bounded supply/demand signal"
        icon={<IndianRupee className="size-4" aria-hidden="true" />}
        action={<Badge tone="neutral">₹/kWh</Badge>}
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="num text-[36px] font-semibold leading-10 tracking-[-0.03em] text-ink-900">
              {formatPrice(pricing.price_inr_kwh)}
              <span className="ml-1 text-xs font-medium tracking-normal text-slate-500">/kWh</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Base {formatInr(pricing.base_price_inr_kwh)} ·{" "}
              <span className={delta >= 0 ? "text-warn-700" : "text-energy-700"}>
                {delta >= 0 ? "+" : ""}
                {formatPrice(delta)} vs base
              </span>
            </p>
          </div>
          <span
            className={
              delta > 0.01
                ? "inline-flex items-center gap-1 rounded-md border border-warn-100 bg-warn-50 px-2 py-1 text-[11px] font-medium text-warn-700"
                : delta < -0.01
                  ? "inline-flex items-center gap-1 rounded-md border border-energy-100 bg-energy-50 px-2 py-1 text-[11px] font-medium text-energy-700"
                  : "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600"
            }
          >
            {delta > 0.01 ? <ArrowUpRight className="size-3.5" /> : delta < -0.01 ? <ArrowDownRight className="size-3.5" /> : <Scale className="size-3.5" />}
            {delta > 0.01 ? "Scarcity" : delta < -0.01 ? "Surplus" : "Balanced"}
          </span>
        </div>

        <div>
          <div className="relative h-2 rounded-full bg-gradient-to-r from-energy-100 via-slate-100 to-warn-100">
            <span
              className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400"
              style={{ left: `${Math.max(0, Math.min(100, basePosition))}%` }}
              title={`Base ${formatInr(pricing.base_price_inr_kwh)}/kWh`}
            />
            <span
              className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-ink-900 shadow-sm"
              style={{ left: `${Math.max(0, Math.min(100, position))}%` }}
              title={`Current ${formatPrice(pricing.price_inr_kwh)}/kWh`}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
            <span className="num">Floor {formatInr(pricing.min_price_inr_kwh)}</span>
            <span className="num">Base {formatInr(pricing.base_price_inr_kwh)}</span>
            <span className="num">Cap {formatInr(pricing.max_price_inr_kwh)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-line bg-slate-50/60 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-500">Physical surplus</p>
            <p className="num mt-0.5 text-sm font-semibold text-energy-700">{formatNumber(pricing.supply_kw, 2)} kW</p>
          </div>
          <div className="rounded-lg border border-line bg-slate-50/60 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-500">Physical deficit</p>
            <p className="num mt-0.5 text-sm font-semibold text-info-600">{formatNumber(pricing.demand_kw, 2)} kW</p>
          </div>
          <div className="rounded-lg border border-line bg-slate-50/60 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-500">Imbalance ratio</p>
            <p className="num mt-0.5 text-sm font-semibold text-slate-700">{formatNumber(pricing.imbalance, 2)}</p>
          </div>
          <div className="rounded-lg border border-line bg-slate-50/60 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-500">Sensitivity / smoothing</p>
            <p className="num mt-0.5 text-sm font-semibold text-slate-700">
              {formatNumber(pricing.sensitivity, 1)} / {formatNumber(pricing.smoothing, 2)}
            </p>
          </div>
        </div>

        <p className="rounded-lg border border-line bg-white px-3 py-2.5 text-[11px] leading-5 text-slate-600">
          {pricing.reason}
        </p>

        {!hasTick ? (
          <InlineAlert tone="info">
            No interval has cleared yet. The displayed tariff is the configured base price. Start or step the
            simulation to produce a dynamic price.
          </InlineAlert>
        ) : null}

        <p className="text-[10px] leading-4 text-slate-400">
          price = clamp(previous × smoothing + (base + sensitivity × imbalance) × (1 − smoothing), floor, cap).
          Sellers release surplus only when the price clears their reservation price; buyer demand is inelastic.
        </p>
      </CardBody>
    </Card>
  );
}
