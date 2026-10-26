import { ArrowDownRight, ArrowUpRight, CloudSun, Gauge, RefreshCw, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useForecast } from "../hooks/queries";
import { PageBody, PageHeader } from "../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { SegmentedControl } from "../components/common/SegmentedControl";
import { ChartSkeleton, MetricSkeleton, TableSkeleton } from "../components/common/Skeletons";
import { ErrorState, InlineAlert } from "../components/common/States";
import { ForecastChart } from "../components/charts/ForecastChart";
import { FreshnessBadge, FRESHNESS_TONE } from "../components/common/Freshness";
import { formatDateTime, formatIrradiance, formatNumber, formatPrice, formatTime } from "../utils/format";

const HORIZONS = [6, 12, 24, 48];

export function ForecastingPage() {
  const [horizon, setHorizon] = useState(24);
  const forecast = useForecast(horizon);

  return (
    <>
      <PageHeader
        eyebrow="Intelligence · forward view"
        title="Solar and demand forecast"
        description="Hourly provider weather is converted into estimated rooftop generation and simulated household demand. Forecast values are predictions, not observations."
        meta={
          forecast.data ? (
            <>
              <Badge tone={FRESHNESS_TONE[forecast.data.freshness]}>
                {forecast.data.freshness} forecast
              </Badge>
              <Badge tone="neutral">{forecast.data.model}</Badge>
              <Badge tone="neutral">Horizon {forecast.data.horizon_hours} h</Badge>
              {forecast.data.generated_at ? <span className="text-[10px] text-slate-400">Generated {formatDateTime(forecast.data.generated_at)}</span> : null}
            </>
          ) : (
            <Badge tone="neutral">Awaiting forecast</Badge>
          )
        }
        actions={
          <>
            <SegmentedControl
              label="Forecast horizon"
              value={horizon}
              onChange={setHorizon}
              options={HORIZONS.map((value) => ({ value, label: `${value}h` }))}
            />
            <Button
              size="sm"
              variant="secondary"
              loading={forecast.isFetching}
              onClick={() => void forecast.refetch()}
              icon={<RefreshCw className="size-3.5" />}
            >
              Refresh
            </Button>
          </>
        }
      />

      <PageBody>
        {forecast.isPending ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <MetricSkeleton key={index} />
              ))}
            </div>
            <div className="card p-5">
              <ChartSkeleton height={310} />
            </div>
            <div className="card p-5">
              <TableSkeleton rows={6} />
            </div>
          </>
        ) : forecast.isError ? (
          <ErrorState error={forecast.error} title="Forecast request failed" onRetry={() => void forecast.refetch()} />
        ) : forecast.data ? (
          <>
            {forecast.data.error ? (
              <InlineAlert tone="warning">
                <span className="font-medium">Weather forecast degraded:</span> {forecast.data.error} The forecast below
                may use cached real provider data; no synthetic rows were inserted.
              </InlineAlert>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="card px-4 py-3.5">
                <p className="label-xs">Current simulated generation</p>
                <p className="num mt-2 text-[26px] font-semibold leading-8 text-ink-900">
                  {formatNumber(forecast.data.observed?.generation_kw, 2)}
                  <span className="ml-1.5 text-xs font-medium text-slate-500">kW</span>
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {forecast.data.observed ? `Observed at tick ${forecast.data.observed.tick}` : "No current tick"}
                </p>
              </div>
              <div className="card px-4 py-3.5">
                <p className="label-xs">Current simulated demand</p>
                <p className="num mt-2 text-[26px] font-semibold leading-8 text-ink-900">
                  {formatNumber(forecast.data.observed?.demand_kw, 2)}
                  <span className="ml-1.5 text-xs font-medium text-slate-500">kW</span>
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {forecast.data.observed ? `Simulated clock ${formatTime(forecast.data.observed.simulated_at)} IST` : "No current tick"}
                </p>
              </div>
              <div className="card px-4 py-3.5">
                <p className="label-xs">Peak predicted generation</p>
                <p className="num mt-2 text-[26px] font-semibold leading-8 text-ink-900">
                  {formatNumber(
                    forecast.data.series.reduce<number | null>(
                      (max, point) =>
                        point.generation_kw === null ? max : Math.max(max ?? 0, point.generation_kw),
                      null,
                    ),
                    2,
                  )}
                  <span className="ml-1.5 text-xs font-medium text-slate-500">kW</span>
                </p>
                <p className="mt-1 text-[10px] text-slate-400">{forecast.data.series.length} predicted hours</p>
              </div>
              <div className="card px-4 py-3.5">
                <p className="label-xs">Forecast basis</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-ink-900">{forecast.data.model_status}</p>
                <p className="mt-1 text-[10px] leading-4 text-slate-400">
                  Model {forecast.data.model_version} · {forecast.data.provider} via {forecast.data.transport}
                </p>
              </div>
            </div>

            <Card>
              <CardHeader
                title="Predicted generation and demand"
                subtitle="Provider forecast weather → solar estimate + deterministic demand profile"
                icon={<TrendingUp className="size-4" aria-hidden="true" />}
                action={<Badge tone="warning">Predicted</Badge>}
              />
              <CardBody>
                <ForecastChart series={forecast.data.series} />
                <div className="mt-2 grid gap-2 border-t border-line pt-2.5 text-[10px] leading-4 text-slate-400 sm:grid-cols-2">
                  <p>
                    Generation is an engineering estimate from forecast irradiance, not a metered reading. Demand is a
                    deterministic simulated profile.
                  </p>
                  <p>
                    Positive bars indicate predicted local surplus; negative bars indicate predicted local deficit. No
                    probabilistic uncertainty band is modeled.
                  </p>
                </div>
              </CardBody>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader
                title="Hourly detail"
                subtitle="Provider forecast values and backend predictions"
                icon={<CloudSun className="size-4" aria-hidden="true" />}
                action={
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <Gauge className="size-3" aria-hidden="true" />
                    {forecast.data.series.length} hourly points
                  </span>
                }
              />
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b border-line text-[10px] uppercase tracking-[0.06em] text-slate-400">
                      <th className="py-2.5 pr-3 pl-4 font-medium sm:pl-5">Time (IST)</th>
                      <th className="px-3 py-2.5 text-right font-medium">Cloud</th>
                      <th className="px-3 py-2.5 text-right font-medium">Irradiance</th>
                      <th className="px-3 py-2.5 text-right font-medium">Temperature</th>
                      <th className="px-3 py-2.5 text-right font-medium">Generation</th>
                      <th className="px-3 py-2.5 text-right font-medium">Demand</th>
                      <th className="py-2.5 pr-4 text-right font-medium sm:pr-5">Imbalance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {forecast.data.series.map((point) => (
                      <tr key={point.timestamp} className="hover:bg-slate-50/60">
                        <td className="num py-2 pr-3 pl-4 text-slate-700 sm:pl-5">{formatTime(point.timestamp)}</td>
                        <td className="num px-3 py-2 text-right text-slate-600">{formatNumber(point.cloud_cover_pct, 0)}%</td>
                        <td className="num px-3 py-2 text-right text-slate-600">{formatIrradiance(point.irradiance_w_m2)}</td>
                        <td className="num px-3 py-2 text-right text-slate-600">{formatNumber(point.temperature_c, 1)}°C</td>
                        <td className="num px-3 py-2 text-right text-slate-700">{formatNumber(point.generation_kw, 2)} kW</td>
                        <td className="num px-3 py-2 text-right text-slate-700">{formatNumber(point.demand_kw, 2)} kW</td>
                        <td className="px-3 py-2 pr-4 text-right sm:pr-5">
                          <span
                            className={
                              (point.imbalance_kw ?? 0) >= 0
                                ? "num inline-flex items-center gap-0.5 font-medium text-energy-700"
                                : "num inline-flex items-center gap-0.5 font-medium text-info-600"
                            }
                          >
                            {(point.imbalance_kw ?? 0) >= 0 ? (
                              <ArrowUpRight className="size-3" aria-hidden="true" />
                            ) : (
                              <ArrowDownRight className="size-3" aria-hidden="true" />
                            )}
                            {formatNumber(point.imbalance_kw, 2)} kW
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-line px-4 py-3 text-[10px] leading-4 text-slate-500 sm:px-5">
                <span className="font-medium text-slate-600">Provider provenance:</span> {forecast.data.provider} via{" "}
                {forecast.data.transport.toUpperCase()} · server {forecast.data.mcp_server} · generated{" "}
                {forecast.data.generated_at ? formatDateTime(forecast.data.generated_at) : "—"}.{" "}
                {forecast.data.freshness !== "live" ? (
                  <FreshnessBadge status={forecast.data.freshness} ageSeconds={null} />
                ) : null}
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader title="Model assumptions" subtitle="What the forecast does and does not include" />
                <CardBody>
                  <ul className="space-y-2">
                    {forecast.data.assumptions.map((assumption) => (
                      <li key={assumption} className="flex gap-2 text-[11px] leading-5 text-slate-600">
                        <span className="mt-2 size-1 shrink-0 rounded-full bg-slate-300" />
                        {assumption}
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Honest boundaries" subtitle="Forecast interpretation" />
                <CardBody className="space-y-2 text-[11px] leading-5 text-slate-600">
                  <p>
                    Weather fields come from the real MCP forecast. Generation is a deterministic estimate with fixed
                    performance assumptions; household demand is synthetic.
                  </p>
                  <p>
                    The forecast does not model panel soiling, shading, outages, price elasticity or forecast error
                    distributions. It should not be used for actual dispatch.
                  </p>
                  <p className="num text-[10px] text-slate-400">
                    Current observed price {formatPrice(forecast.data.observed?.price_inr_kwh)}/kWh · predicted energy is
                    not a commitment.
                  </p>
                </CardBody>
              </Card>
            </div>
          </>
        ) : null}
      </PageBody>
    </>
  );
}
