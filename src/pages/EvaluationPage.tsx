import { ArrowDownRight, ArrowUpRight, FlaskConical, Minus, Play, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useEvaluation } from "../hooks/queries";
import { useEvaluationAction } from "../hooks/useActions";
import { PageBody, PageHeader } from "../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { SegmentedControl } from "../components/common/SegmentedControl";
import { ChartSkeleton, MetricSkeleton } from "../components/common/Skeletons";
import { EmptyState, ErrorState, InlineAlert } from "../components/common/States";
import { EvaluationPriceChart } from "../components/charts/EvaluationPriceChart";
import { EvaluationAllocationChart } from "../components/charts/EvaluationAllocationChart";
import { formatDateTime, formatKwh, formatNumber, formatPct, formatPrice } from "../utils/format";

type Direction = "lower" | "higher" | "neutral";

function ComparisonCell({ delta, unit, direction }: { delta: number | null; unit: string; direction: Direction }) {
  if (delta === null || Math.abs(delta) < 0.00001) {
    return <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Minus className="size-3" />no change</span>;
  }
  const good = direction === "neutral" ? null : direction === "lower" ? delta < 0 : delta > 0;
  const Icon = delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={
        good === null
          ? "num inline-flex items-center gap-0.5 text-[11px] font-medium text-slate-600"
          : good
            ? "num inline-flex items-center gap-0.5 text-[11px] font-medium text-energy-700"
            : "num inline-flex items-center gap-0.5 text-[11px] font-medium text-critical-600"
      }
    >
      <Icon className="size-3" aria-hidden="true" />
      {delta > 0 ? "+" : ""}
      {formatNumber(delta, 3)} {unit}
    </span>
  );
}

export function EvaluationPage() {
  const evaluation = useEvaluation();
  const runEvaluation = useEvaluationAction();
  const [draft, setDraft] = useState<{
    ticks: number;
    cloud: number;
    resultId: number | null;
  } | null>(null);

  const result = evaluation.data;
  const activeResultId = result?.id ?? null;
  const ticks =
    (draft?.resultId === activeResultId ? draft.ticks : undefined) ?? result?.ticks ?? 24;
  const cloud =
    (draft?.resultId === activeResultId ? draft.cloud : undefined) ??
    result?.scenario_cloud_pct ??
    25;
  const setTicks = (value: number) =>
    setDraft({ ticks: value, cloud, resultId: activeResultId });
  const setCloud = (value: number) =>
    setDraft({ ticks, cloud: value, resultId: activeResultId });
  const comparison = result?.comparison;
  const staticMetrics = result?.static;
  const dynamicMetrics = result?.dynamic;
  const servedDelta =
    staticMetrics?.demand_served_pct !== null &&
    staticMetrics?.demand_served_pct !== undefined &&
    dynamicMetrics?.demand_served_pct !== null &&
    dynamicMetrics?.demand_served_pct !== undefined
      ? dynamicMetrics.demand_served_pct - staticMetrics.demand_served_pct
      : null;

  const unmetReduction = comparison?.unmet_demand_reduction_kwh ?? null;
  const underperformed = unmetReduction !== null && unmetReduction < -0.0001;
  const outperformed = unmetReduction !== null && unmetReduction > 0.0001;

  return (
    <>
      <PageHeader
        eyebrow="Intelligence · measured replay"
        title="Static vs dynamic pricing"
        description="Both strategies are replayed over identical weather, demand seeds, batteries and allocation constraints. Only the price signal changes, which influences seller participation. All comparison metrics are computed from the replay."
        meta={
          result ? (
            <>
              <Badge tone="neutral">{result.ticks} intervals</Badge>
              <Badge tone="warning">{formatNumber(result.scenario_cloud_pct, 0)}% cloud overlay</Badge>
              <Badge tone="neutral">Evaluation #{result.id}</Badge>
              <span className="text-[10px] text-slate-400">Created {formatDateTime(result.created_at)}</span>
            </>
          ) : (
            <Badge tone="neutral">No replay yet</Badge>
          )
        }
      />

      <PageBody>
        <Card>
          <CardHeader
            title="Replay configuration"
            subtitle="Runs a new counterfactual; it does not alter the live simulation or its transactions"
            icon={<FlaskConical className="size-4" aria-hidden="true" />}
            action={
              <Button
                size="sm"
                variant="primary"
                loading={runEvaluation.isPending}
                onClick={() => runEvaluation.mutate({ ticks, cloudCoverPct: cloud })}
                icon={<Play className="size-3.5" />}
              >
                Run evaluation
              </Button>
            }
          />
          <CardBody>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-500">Replay length</p>
                <div className="mt-1.5">
                  <SegmentedControl
                    label="Evaluation replay length"
                    value={ticks}
                    onChange={setTicks}
                    options={[
                      { value: 12, label: "12 ticks" },
                      { value: 24, label: "24 ticks" },
                      { value: 48, label: "48 ticks" },
                      { value: 72, label: "72 ticks" },
                    ]}
                  />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-500">Synthetic cloud overlay</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[0, 25, 50, 75].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={cloud === value}
                      onClick={() => setCloud(value)}
                      className={
                        cloud === value
                          ? "focus-ring rounded-md border border-ink-900 bg-ink-900 px-2.5 py-1 text-[11px] font-medium text-white"
                          : "focus-ring rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                      }
                    >
                      {value === 0 ? "Live weather" : `${value}%`}
                    </button>
                  ))}
                </div>
              </div>
              <p className="max-w-md text-[10px] leading-4 text-slate-400 lg:text-right">
                The overlay is applied equally to both strategies. Weather is real MCP forecast/current data; demand and
                trades are simulated. The evaluation requires a working weather provider.
              </p>
            </div>
            {runEvaluation.error ? (
              <div className="mt-3">
                <InlineAlert tone="danger">
                  <span className="font-medium">Evaluation failed:</span>{" "}
                  {runEvaluation.error instanceof Error ? runEvaluation.error.message : String(runEvaluation.error)}
                </InlineAlert>
              </div>
            ) : null}
          </CardBody>
        </Card>

        {evaluation.isPending ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <MetricSkeleton key={index} />
              ))}
            </div>
            <div className="card p-5">
              <ChartSkeleton height={260} />
            </div>
          </>
        ) : evaluation.isError ? (
          <ErrorState error={evaluation.error} title="Could not load the latest evaluation" onRetry={() => void evaluation.refetch()} />
        ) : result && comparison && staticMetrics && dynamicMetrics ? (
          <>
            <div
              className={
                underperformed
                  ? "rounded-xl border border-warn-100 bg-warn-50/70 px-4 py-3.5"
                  : "rounded-xl border border-energy-100 bg-energy-50/70 px-4 py-3.5"
              }
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={
                    underperformed
                      ? "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-white text-warn-600"
                      : "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-white text-energy-600"
                  }
                >
                  {underperformed ? <TrendingDown className="size-4" aria-hidden="true" /> : <TrendingUp className="size-4" aria-hidden="true" />}
                </span>
                <div>
                  <p className={underperformed ? "text-sm font-semibold text-warn-700" : "text-sm font-semibold text-energy-700"}>
                    {outperformed
                      ? `Dynamic pricing reduced unmet demand by ${formatKwh(Math.abs(unmetReduction ?? 0), 4)} kWh in this replay.`
                      : underperformed
                        ? `Dynamic pricing increased unmet demand by ${formatKwh(Math.abs(unmetReduction ?? 0), 4)} kWh in this replay.`
                        : "Dynamic pricing left unmet demand effectively unchanged in this replay."}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-5 text-slate-600">
                    Measured under the same weather, demand seed, battery state and max-flow constraints as the static
                    strategy. This is a simulated counterfactual, not field evidence of superiority.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="card px-4 py-3.5">
                <p className="label-xs">Unmet demand reduction</p>
                <p className="num mt-2 text-[24px] font-semibold leading-8 text-ink-900">
                  {unmetReduction !== null ? `${unmetReduction > 0 ? "+" : ""}${formatKwh(unmetReduction, 4)}` : "—"}
                  <span className="ml-1.5 text-xs font-medium text-slate-500">kWh</span>
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {comparison.unmet_demand_reduction_pct === null
                    ? "No percentage baseline"
                    : `${formatPct(comparison.unmet_demand_reduction_pct, 2)} vs static`}
                </p>
              </div>
              <div className="card px-4 py-3.5">
                <p className="label-xs">Energy traded change</p>
                <p className="num mt-2 text-[24px] font-semibold leading-8 text-ink-900">
                  {comparison.energy_traded_change_kwh > 0 ? "+" : ""}
                  {formatKwh(comparison.energy_traded_change_kwh, 4)}
                  <span className="ml-1.5 text-xs font-medium text-slate-500">kWh</span>
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {comparison.energy_traded_change_pct === null
                    ? "No percentage baseline"
                    : `${formatPct(comparison.energy_traded_change_pct, 2)} vs static`}
                </p>
              </div>
              <div className="card px-4 py-3.5">
                <p className="label-xs">Demand served change</p>
                <p className="num mt-2 text-[24px] font-semibold leading-8 text-ink-900">
                  {servedDelta !== null ? `${servedDelta > 0 ? "+" : ""}${formatNumber(servedDelta, 2)}` : "—"}
                  <span className="ml-1.5 text-xs font-medium text-slate-500">pp</span>
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  Dynamic {formatPct(dynamicMetrics.demand_served_pct, 1)} vs static {formatPct(staticMetrics.demand_served_pct, 1)}
                </p>
              </div>
              <div className="card px-4 py-3.5">
                <p className="label-xs">Avg transaction price change</p>
                <p className="num mt-2 text-[24px] font-semibold leading-8 text-ink-900">
                  {comparison.average_price_change_inr_kwh !== null
                    ? `${comparison.average_price_change_inr_kwh > 0 ? "+" : ""}${formatPrice(comparison.average_price_change_inr_kwh)}`
                    : "—"}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  Dynamic {formatPrice(dynamicMetrics.average_transaction_price_inr_kwh)} vs static{" "}
                  {formatPrice(staticMetrics.average_transaction_price_inr_kwh)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader
                  title="Price signal"
                  subtitle="Static holds the base tariff; dynamic is bounded by floor and cap"
                  icon={<Scale className="size-4" aria-hidden="true" />}
                  action={<Badge tone="neutral">₹/kWh</Badge>}
                />
                <CardBody>
                  <EvaluationPriceChart result={result} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader
                  title="Allocated and unmet power"
                  subtitle="Per-interval replay outcome under each strategy"
                  icon={<Scale className="size-4" aria-hidden="true" />}
                  action={<Badge tone="neutral">kW</Badge>}
                />
                <CardBody>
                  <EvaluationAllocationChart result={result} />
                </CardBody>
              </Card>
            </div>

            <Card className="overflow-hidden">
              <CardHeader
                title="Measured comparison"
                subtitle="Every value comes from the replay; no metric is assumed in advance"
                icon={<Scale className="size-4" aria-hidden="true" />}
                action={<Badge tone="info">Replay #{result.id}</Badge>}
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-line text-[10px] uppercase tracking-[0.06em] text-slate-400">
                      <th className="py-2.5 pr-3 pl-4 font-medium sm:pl-5">Metric</th>
                      <th className="px-3 py-2.5 text-right font-medium">Static</th>
                      <th className="px-3 py-2.5 text-right font-medium">Dynamic</th>
                      <th className="py-2.5 pr-4 text-right font-medium sm:pr-5">Dynamic − static</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {[
                      {
                        label: "Energy traded",
                        staticValue: `${formatKwh(staticMetrics.energy_traded_kwh, 4)} kWh`,
                        dynamicValue: `${formatKwh(dynamicMetrics.energy_traded_kwh, 4)} kWh`,
                        delta: dynamicMetrics.energy_traded_kwh - staticMetrics.energy_traded_kwh,
                        unit: "kWh",
                        direction: "neutral" as Direction,
                      },
                      {
                        label: "Unmet demand",
                        staticValue: `${formatKwh(staticMetrics.unmet_demand_kwh, 4)} kWh`,
                        dynamicValue: `${formatKwh(dynamicMetrics.unmet_demand_kwh, 4)} kWh`,
                        delta: dynamicMetrics.unmet_demand_kwh - staticMetrics.unmet_demand_kwh,
                        unit: "kWh",
                        direction: "lower" as Direction,
                      },
                      {
                        label: "Demand served",
                        staticValue: formatPct(staticMetrics.demand_served_pct, 2),
                        dynamicValue: formatPct(dynamicMetrics.demand_served_pct, 2),
                        delta: servedDelta,
                        unit: "pp",
                        direction: "higher" as Direction,
                      },
                      {
                        label: "Renewable utilization",
                        staticValue: formatPct(staticMetrics.renewable_utilization_pct, 2),
                        dynamicValue: formatPct(dynamicMetrics.renewable_utilization_pct, 2),
                        delta: comparison.utilization_change_pp,
                        unit: "pp",
                        direction: "higher" as Direction,
                      },
                      {
                        label: "Surplus remaining",
                        staticValue: `${formatKwh(staticMetrics.surplus_remaining_kwh, 4)} kWh`,
                        dynamicValue: `${formatKwh(dynamicMetrics.surplus_remaining_kwh, 4)} kWh`,
                        delta: dynamicMetrics.surplus_remaining_kwh - staticMetrics.surplus_remaining_kwh,
                        unit: "kWh",
                        direction: "lower" as Direction,
                      },
                      {
                        label: "Average transaction price",
                        staticValue: formatPrice(staticMetrics.average_transaction_price_inr_kwh),
                        dynamicValue: formatPrice(dynamicMetrics.average_transaction_price_inr_kwh),
                        delta: comparison.average_price_change_inr_kwh,
                        unit: "₹/kWh",
                        direction: "neutral" as Direction,
                      },
                      {
                        label: "Price volatility",
                        staticValue: formatPrice(staticMetrics.price_volatility_inr_kwh),
                        dynamicValue: formatPrice(dynamicMetrics.price_volatility_inr_kwh),
                        delta: comparison.price_volatility_change,
                        unit: "₹/kWh",
                        direction: "neutral" as Direction,
                      },
                      {
                        label: "Transactions / links",
                        staticValue: formatNumber(staticMetrics.transaction_count, 0),
                        dynamicValue: formatNumber(dynamicMetrics.transaction_count, 0),
                        delta: dynamicMetrics.transaction_count - staticMetrics.transaction_count,
                        unit: "",
                        direction: "neutral" as Direction,
                      },
                    ].map((row) => (
                      <tr key={row.label} className="hover:bg-slate-50/60">
                        <td className="py-2.5 pr-3 pl-4 font-medium text-slate-700 sm:pl-5">{row.label}</td>
                        <td className="num px-3 py-2.5 text-right text-slate-600">{row.staticValue}</td>
                        <td className="num px-3 py-2.5 text-right text-slate-700">{row.dynamicValue}</td>
                        <td className="py-2.5 pr-4 text-right sm:pr-5">
                          <ComparisonCell delta={row.delta} unit={row.unit} direction={row.direction} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-line px-4 py-3 text-[10px] leading-4 text-slate-500 sm:px-5">{result.notes}</div>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader title="Methodology" subtitle="Replay controls and shared assumptions" icon={<Scale className="size-4" aria-hidden="true" />} />
                <CardBody>
                  <ol className="space-y-2">
                    {result.methodology.map((item, index) => (
                      <li key={item} className="flex gap-2 text-[11px] leading-5 text-slate-600">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500">
                          {index + 1}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ol>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Replay conditions" subtitle="Same inputs, one changed control" />
                <CardBody className="space-y-2 text-[11px] leading-5 text-slate-600">
                  <div className="flex justify-between border-b border-line py-1.5">
                    <span className="text-slate-500">Intervals</span>
                    <span className="num font-medium">{result.ticks} × {result.interval_seconds}s</span>
                  </div>
                  <div className="flex justify-between border-b border-line py-1.5">
                    <span className="text-slate-500">Cloud overlay</span>
                    <span className="num font-medium">{formatNumber(result.scenario_cloud_pct, 0)}%</span>
                  </div>
                  <div className="flex justify-between border-b border-line py-1.5">
                    <span className="text-slate-500">Static price</span>
                    <span className="num font-medium">{formatPrice(staticMetrics.average_price_inr_kwh)} /kWh</span>
                  </div>
                  <div className="flex justify-between border-b border-line py-1.5">
                    <span className="text-slate-500">Dynamic price range</span>
                    <span className="num font-medium">
                      {formatPrice(dynamicMetrics.min_price_inr_kwh)} – {formatPrice(dynamicMetrics.max_price_inr_kwh)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-line py-1.5">
                    <span className="text-slate-500">Replay start (IST)</span>
                    <span className="num font-medium">{formatDateTime(result.replay_start)}</span>
                  </div>
                  <div className="flex justify-between border-b border-line py-1.5">
                    <span className="text-slate-500">Weather snapshot</span>
                    <span className="num font-medium">#{result.weather_snapshot_id ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Allocator</span>
                    <span className="font-medium">Max-flow (both)</span>
                  </div>
                  <p className="rounded-lg border border-line bg-slate-50/60 px-3 py-2 text-[10px] leading-4 text-slate-500">
                    Buyer demand is inelastic and seller participation is price-sensitive. The dynamic strategy can
                    underperform when higher prices suppress offers; the UI reports either outcome without adjustment.
                  </p>
                </CardBody>
              </Card>
            </div>
          </>
        ) : (
          <Card>
            <CardBody>
              <EmptyState
                icon={<Scale className="size-4.5" aria-hidden="true" />}
                title="No static-vs-dynamic evaluation yet"
                description="Run a replay to compare both strategies over identical conditions. Weather must be available through MCP; the evaluation will fail honestly if it is not."
                action={
                  <Button
                    size="sm"
                    loading={runEvaluation.isPending}
                    onClick={() => runEvaluation.mutate({ ticks, cloudCoverPct: cloud })}
                    icon={<Play className="size-3.5" />}
                  >
                    Run evaluation
                  </Button>
                }
              />
            </CardBody>
          </Card>
        )}
      </PageBody>
    </>
  );
}
