import { ArrowDownLeft, ArrowUpRight, Inbox } from "lucide-react";
import type { Household } from "../../types/api";
import { formatInr, formatKwh, formatNumber } from "../../utils/format";
import { Badge } from "../common/Badge";
import { Card, CardBody, CardHeader } from "../common/Card";

function BookSide({
  title,
  subtitle,
  households,
  side,
  intervalSeconds,
}: {
  title: string;
  subtitle: string;
  households: Household[];
  side: "sell" | "buy";
  intervalSeconds: number;
}) {
  const sorted = [...households].sort((a, b) => {
    const left = side === "sell" ? (a.available_selling_kw ?? 0) : (a.requested_buying_kw ?? 0);
    const right = side === "sell" ? (b.available_selling_kw ?? 0) : (b.requested_buying_kw ?? 0);
    return right - left;
  });
  const totalKw = sorted.reduce(
    (sum, household) =>
      sum + (side === "sell" ? (household.available_selling_kw ?? 0) : (household.requested_buying_kw ?? 0)),
    0,
  );
  const maxKw = Math.max(
    0.001,
    ...sorted.map((household) =>
      side === "sell" ? (household.available_selling_kw ?? 0) : (household.requested_buying_kw ?? 0),
    ),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-ink-900">
            {side === "sell" ? (
              <ArrowUpRight className="size-3.5 text-energy-600" aria-hidden="true" />
            ) : (
              <ArrowDownLeft className="size-3.5 text-info-600" aria-hidden="true" />
            )}
            {title}
          </h3>
          <p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="num text-sm font-semibold text-ink-900">{formatNumber(totalKw, 2)} kW</p>
          <p className="text-[10px] text-slate-400">{sorted.length} orders</p>
        </div>
      </div>
      <div className="flex-1 px-4 py-2 sm:px-5">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
            <Inbox className="size-4 text-slate-300" aria-hidden="true" />
            <p className="text-[11px] text-slate-500">No {side === "sell" ? "offers" : "requests"} at this interval.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line/70">
            {sorted.map((household) => {
              const kw = side === "sell" ? (household.available_selling_kw ?? 0) : (household.requested_buying_kw ?? 0);
              const share = Math.min(100, (kw / maxKw) * 100);
              const energy = kw * (intervalSeconds / 3600);
              return (
                <li key={household.id} className="relative py-2.5">
                  <div
                    className={
                      side === "sell"
                        ? "absolute inset-y-1 left-0 rounded-sm bg-energy-50"
                        : "absolute inset-y-1 left-0 rounded-sm bg-info-50"
                    }
                    style={{ width: `${share}%` }}
                    aria-hidden="true"
                  />
                  <div className="relative flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium text-slate-700">{household.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {household.id}
                        {side === "sell"
                          ? ` · reservation ${formatInr(household.reservation_price_inr_kwh)}`
                          : " · inelastic request"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={side === "sell" ? "num text-[11px] font-semibold text-energy-700" : "num text-[11px] font-semibold text-info-600"}>
                        {formatNumber(kw, 2)} kW
                      </p>
                      <p className="num text-[10px] text-slate-400">{formatKwh(energy, 3)} kWh</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="border-t border-line px-4 py-2.5 text-[10px] leading-4 text-slate-400 sm:px-5">
        {side === "sell"
          ? "Offer = available physical surplus × price-sensitive participation."
          : "Request = simulated household deficit after battery dispatch. No demand response is modeled."}
      </p>
    </div>
  );
}

export function OrderBook({
  households,
  intervalSeconds,
  maxTradeKw,
}: {
  households: Household[];
  intervalSeconds: number;
  maxTradeKw: number;
}) {
  const sellers = households.filter((household) => (household.available_selling_kw ?? 0) > 0.001);
  const buyers = households.filter((household) => (household.requested_buying_kw ?? 0) > 0.001);
  return (
    <Card className="h-full overflow-hidden">
      <CardHeader
        title="Order book"
        subtitle="Current interval offers and requests"
        icon={<ArrowUpRight className="size-4" aria-hidden="true" />}
        action={<Badge tone="neutral">Simulated</Badge>}
      />
      <div className="grid md:grid-cols-2 md:divide-x md:divide-line">
        <BookSide
          title="Sell offers"
          subtitle="Surplus released at the current price"
          households={sellers}
          side="sell"
          intervalSeconds={intervalSeconds}
        />
        <BookSide
          title="Buy requests"
          subtitle="Deficit awaiting P2P allocation"
          households={buyers}
          side="buy"
          intervalSeconds={intervalSeconds}
        />
      </div>
      <CardBody className="border-t border-line py-2.5">
        <p className="text-[10px] leading-4 text-slate-400">
          Orders are derived from the latest household snapshot. Sellers may withhold surplus; buyers cannot reduce
          demand in this model. Matching uses a {formatNumber(maxTradeKw, 1)} kW per-household cap and maximum flow.
        </p>
      </CardBody>
    </Card>
  );
}
