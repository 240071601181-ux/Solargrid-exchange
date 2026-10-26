import { CloudSun, Info, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageBody, PageHeader } from "../../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/common/Card";
import { StatCard } from "../../components/common/StatCard";
import { Badge } from "../../components/common/Badge";
import { ErrorState, EmptyState } from "../../components/common/States";
import { ChartSkeleton, MetricSkeleton } from "../../components/common/Skeletons";
import { useBuyerPrices } from "../../hooks/queries";
import { CHART, chartNumber, shortTime } from "../../utils/chart";
import { formatDateTime, formatNumber, formatPrice, formatTime } from "../../utils/format";

export function BuyerPricesPage() {
  const prices = useBuyerPrices();
  const data = prices.data;

  if (prices.isPending) {
    return (
      <PageBody>
        <PageHeader eyebrow="Buyer workspace" title="Price outlook" description="Loading price history and the MCP-backed forecast." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <MetricSkeleton key={index} />)}
        </div>
        <Card><CardBody><ChartSkeleton /></CardBody></Card>
      </PageBody>
    );
  }
  if (prices.isError || !data) {
    return (
      <PageBody>
        <PageHeader eyebrow="Buyer workspace" title="Price outlook" />
        <ErrorState error={prices.error} title="Price outlook could not be loaded" onRetry={() => void prices.refetch()} />
      </PageBody>
    );
  }

  const historyData = data.history.map((point) => ({
    label: shortTime(point.simulated_at),
    price: point.price_inr_kwh,
    base: point.base_price_inr_kwh,
  }));
  const forecastData = data.forecast.map((point) => ({
    label: shortTime(point.timestamp),
    price: point.price_inr_kwh,
    demand: point.demand_kw,
    generation: point.generation_kw,
  }));

  return (
    <PageBody>
      <PageHeader
        eyebrow="Buyer workspace"
        title="Price outlook"
        description="The shared dynamic simulation price applied to supply and demand, plus a forecast scenario for local energy."
        meta={
          <>
            <Badge tone="success" dot>{formatPrice(data.current.price_inr_kwh)}/kWh current</Badge>
            <Badge tone="neutral">Base {formatPrice(data.current.base_price_inr_kwh)}</Badge>
            <Badge tone={data.freshness === "live" ? "success" : "warning"}>{data.freshness.replaceAll("_", " ")} forecast</Badge>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current dynamic price" value={formatPrice(data.current.price_inr_kwh)} icon={<TrendingUp className="size-4" />} tone="success" hint="Shared simulation signal" />
        <StatCard label="Configured range" value={`${formatPrice(data.current.min_price_inr_kwh)}–${formatPrice(data.current.max_price_inr_kwh)}`} icon={<Info className="size-4" />} tone="neutral" />
        <StatCard label="Supply / demand" value={`${formatNumber(data.current.supply_kw, 1)} / ${formatNumber(data.current.demand_kw, 1)}`} unit="kW" icon={<TrendingUp className="size-4" />} tone="info" />
        <StatCard
          label="Forecast points"
          value={formatNumber(data.forecast.length, 0)}
          icon={<CloudSun className="size-4" />}
          tone="warning"
          hint={data.weather ? `${formatNumber(data.weather.cloud_cover_pct, 0)}% cloud now` : "Weather unavailable"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Historical dynamic price" subtitle="Completed simulation ticks" />
          <CardBody>
            {historyData.length === 0 ? (
              <EmptyState title="No price ticks yet" description="The operator has not run the simulation. Historical prices appear after the first tick." className="border-0 bg-transparent" />
            ) : (
              <div className="h-[245px] w-full" aria-label="Historical dynamic price">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }} accessibilityLayer>
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART.axis }} tickLine={false} axisLine={{ stroke: CHART.grid }} minTickGap={28} />
                    <YAxis tick={{ fontSize: 10, fill: CHART.axis }} tickLine={false} axisLine={false} width={50} tickFormatter={(v: number) => chartNumber(v)} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: CHART.grid, boxShadow: "0 6px 18px rgb(11 18 32 / 0.08)" }}
                      formatter={(value, name) => [`₹${chartNumber(Number(value))}/kWh`, String(name)]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 5 }} iconType="line" />
                    <Line type="monotone" dataKey="price" name="Dynamic price" stroke={CHART.price} strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="base" name="Base tariff" stroke={CHART.basePrice} strokeWidth={1.2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Forecast price scenario"
            subtitle={`Applied to the next ${data.forecast.length} hourly points`}
            action={<Badge tone="warning">Scenario, not a guarantee</Badge>}
          />
          <CardBody>
            {forecastData.length === 0 ? (
              <EmptyState title="No forecast prices" description="The weather forecast was unavailable; price forecast points could not be generated." className="border-0 bg-transparent" />
            ) : (
              <div className="h-[245px] w-full" aria-label="Forecast price scenario">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }} accessibilityLayer>
                    <defs>
                      <linearGradient id="priceForecastFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART.price} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={CHART.price} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART.axis }} tickLine={false} axisLine={{ stroke: CHART.grid }} minTickGap={28} />
                    <YAxis tick={{ fontSize: 10, fill: CHART.axis }} tickLine={false} axisLine={false} width={50} tickFormatter={(v: number) => chartNumber(v)} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: CHART.grid, boxShadow: "0 6px 18px rgb(11 18 32 / 0.08)" }}
                      formatter={(value) => [`₹${chartNumber(Number(value))}/kWh`, "Forecast price"]}
                    />
                    <Area type="monotone" dataKey="price" name="Forecast price" stroke={CHART.price} strokeWidth={1.8} fill="url(#priceForecastFill)" dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Next forecast points" subtitle={`Generated ${formatDateTime(data.weather?.retrieved_at ?? null)}`} />
          <CardBody className="overflow-x-auto pt-2">
            <table className="w-full min-w-[560px] text-left text-[11.5px]">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-[0.08em] text-slate-400">
                  <th className="py-2 pr-3 font-medium">Time (IST)</th>
                  <th className="px-3 py-2 font-medium">Forecast price</th>
                  <th className="px-3 py-2 font-medium">Demand</th>
                  <th className="px-3 py-2 font-medium">Generation</th>
                  <th className="py-2 pl-3 text-right font-medium">Cloud</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/80">
                {data.forecast.slice(0, 12).map((point) => (
                  <tr key={point.timestamp} className="text-slate-600">
                    <td className="py-2 pr-3 text-slate-500">{formatTime(point.timestamp)}</td>
                    <td className="num px-3 py-2 font-medium text-ink-900">{formatPrice(point.price_inr_kwh)}</td>
                    <td className="num px-3 py-2">{formatNumber(point.demand_kw, 2)} kW</td>
                    <td className="num px-3 py-2">{formatNumber(point.generation_kw, 2)} kW</td>
                    <td className="num py-2 pl-3 text-right">{formatNumber(point.cloud_cover_pct, 0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="How this price is calculated" subtitle="Shared pricing model" icon={<Info className="size-4" aria-hidden="true" />} />
          <CardBody className="space-y-2.5 text-[11.5px] leading-5 text-slate-500">
            <p>
              The price starts from the base tariff, moves with aggregate supply/demand imbalance, and is smoothed
              between ticks inside a configured minimum and maximum.
            </p>
            <p className="rounded-md bg-slate-50 px-2.5 py-2 text-[10.5px]">
              Sensitivity {formatNumber(data.current.sensitivity, 2)} · smoothing {formatNumber(data.current.smoothing, 2)}. Seller offers
              set their own price and are not automatically repriced.
            </p>
            {data.weather ? (
              <p className="flex items-start gap-1.5 text-[10.5px]">
                <CloudSun className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                {data.weather.provider} · {data.weather.transport} · observed{" "}
                {formatDateTime(data.weather.observed_at)}
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-line bg-white px-4 py-3 text-[11px] leading-5 text-slate-500">
        <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <p>{data.assumptions.join(" ")}</p>
      </div>
    </PageBody>
  );
}
