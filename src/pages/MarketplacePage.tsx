import { AlertTriangle, CheckCircle2, IndianRupee, Play, Scale, Store, Workflow } from "lucide-react";
import { useOptimizationStats, useSimulation } from "../hooks/queries";
import { useOptimizationActions } from "../hooks/useActions";
import { PageBody, PageHeader } from "../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { ChartSkeleton, MetricSkeleton, TableSkeleton } from "../components/common/Skeletons";
import { EmptyState, ErrorState, InlineAlert } from "../components/common/States";
import { PricePanel } from "../components/marketplace/PricePanel";
import { OrderBook } from "../components/marketplace/OrderBook";
import { AllocationTable } from "../components/marketplace/AllocationTable";
import { formatKwh, formatNumber, formatPrice } from "../utils/format";

export function MarketplacePage() {
  const simulation = useSimulation();
  const stats = useOptimizationStats();
  const { run, execute } = useOptimizationActions();

  if (simulation.isPending) {
    return (
      <>
        <PageHeader eyebrow="Operations" title="Energy marketplace" />
        <PageBody>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <MetricSkeleton key={index} />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="card xl:col-span-5">
              <ChartSkeleton height={280} />
            </div>
            <div className="card xl:col-span-7">
              <TableSkeleton rows={6} />
            </div>
          </div>
        </PageBody>
      </>
    );
  }

  if (simulation.isError) {
    return (
      <>
        <PageHeader eyebrow="Operations" title="Energy marketplace" />
        <PageBody>
          <ErrorState error={simulation.error} onRetry={() => void simulation.refetch()} />
        </PageBody>
      </>
    );
  }

  const snapshot = simulation.data;
  const allocation = snapshot.allocation;
  const maxTradeKw = stats.data?.network_trade_limit_kw ?? 4;
  const actionError = run.error ?? execute.error;
  const executed = execute.data;
  const canRun = snapshot.state.tick > 0;

  return (
    <>
      <PageHeader
        eyebrow="Operations · price discovery"
        title="Energy marketplace"
        description="Sellers release stored surplus based on the bounded dynamic price. A per-household cap and bipartite maximum-flow solver determine which simulated trades clear."
        meta={
          <>
            <Badge tone="neutral">Tick {snapshot.state.tick}</Badge>
            <Badge tone="warning">{formatPrice(snapshot.pricing.price_inr_kwh)}/kWh</Badge>
            <Badge tone={snapshot.state.auto_execute_trades ? "success" : "neutral"}>
              Auto-execute {snapshot.state.auto_execute_trades ? "on" : "off"}
            </Badge>
            {allocation ? (
              <Badge tone={allocation.status === "executed" ? "success" : "warning"} dot>
                Run #{allocation.id} · {allocation.status}
              </Badge>
            ) : (
              <Badge tone="neutral">No allocation</Badge>
            )}
          </>
        }
        actions={
          <>
            {allocation?.status === "proposed" ? (
              <Button
                variant="success"
                size="sm"
                loading={execute.isPending}
                onClick={() => execute.mutate(allocation.id)}
                icon={<CheckCircle2 className="size-3.5" />}
              >
                Execute proposed trades
              </Button>
            ) : null}
            <Button
              size="sm"
              loading={run.isPending}
              disabled={!canRun}
              onClick={() => run.mutate()}
              icon={<Play className="size-3.5" />}
              title={canRun ? "Re-run max-flow on the latest tick" : "Advance the simulation first"}
            >
              Re-run max-flow
            </Button>
          </>
        }
      />

      <PageBody>
        {actionError ? (
          <InlineAlert tone="danger">
            <span className="font-medium">Market action failed:</span>{" "}
            {actionError instanceof Error ? actionError.message : String(actionError)}
          </InlineAlert>
        ) : null}
        {executed ? (
          <InlineAlert tone="info">
            <span className="font-medium">Execution result:</span> {executed.message} Allocation run #{executed.allocation.id} now has{" "}
            {executed.transactions.length} persisted transaction{executed.transactions.length === 1 ? "" : "s"}.
          </InlineAlert>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <PricePanel pricing={snapshot.pricing} totals={snapshot.totals} />
          </div>
          <div className="xl:col-span-7">
            <OrderBook
              households={snapshot.households}
              intervalSeconds={snapshot.state.interval_seconds}
              maxTradeKw={maxTradeKw}
            />
          </div>
        </div>

        <Card>
          <CardHeader
            title="Allocation result"
            subtitle={
              allocation
                ? `Tick ${allocation.tick} · ${allocation.algorithm} · ${formatNumber(allocation.execution_ms, 2)} ms`
                : "No maximum-flow run yet"
            }
            icon={<Scale className="size-4" aria-hidden="true" />}
            action={
              allocation ? (
                <Badge tone={allocation.status === "executed" ? "success" : "warning"} dot>
                  {allocation.status}
                </Badge>
              ) : null
            }
          />
          {allocation ? (
            <>
              <div className="grid grid-cols-2 gap-0 border-b border-line sm:grid-cols-4">
                <div className="border-r border-line px-4 py-3 sm:px-5">
                  <p className="label-xs">Allocated</p>
                  <p className="num mt-1 text-lg font-semibold text-ink-900">{formatNumber(allocation.allocated_kw, 2)} kW</p>
                  <p className="text-[10px] text-slate-400">{formatKwh(allocation.allocated_kw * allocation.interval_seconds / 3600, 3)} kWh this interval</p>
                </div>
                <div className="border-r border-line px-4 py-3 sm:px-5">
                  <p className="label-xs">Unmet</p>
                  <p className="num mt-1 text-lg font-semibold text-ink-900">{formatNumber(allocation.unmet_kw, 2)} kW</p>
                  <p className="text-[10px] text-slate-400">buyer deficit remaining</p>
                </div>
                <div className="border-r border-line px-4 py-3 sm:px-5">
                  <p className="label-xs">Unallocated</p>
                  <p className="num mt-1 text-lg font-semibold text-ink-900">{formatNumber(allocation.unallocated_kw, 2)} kW</p>
                  <p className="text-[10px] text-slate-400">seller offer remaining</p>
                </div>
                <div className="px-4 py-3 sm:px-5">
                  <p className="label-xs">Clearing price</p>
                  <p className="num mt-1 text-lg font-semibold text-ink-900">{formatPrice(allocation.price_inr_kwh)}</p>
                  <p className="text-[10px] text-slate-400">{allocation.interval_seconds} s interval</p>
                </div>
              </div>
              <AllocationTable allocation={allocation} />
              <div className="border-t border-line px-4 py-3 text-[10px] leading-4 text-slate-500 sm:px-5">
                {allocation.notes}
                {allocation.status === "proposed" ? (
                  <span className="mt-1 flex items-center gap-1 text-warn-700">
                    <AlertTriangle className="size-3" aria-hidden="true" />
                    Proposed trades are not persisted as transactions until executed.
                  </span>
                ) : (
                  <span className="mt-1 flex items-center gap-1 text-energy-700">
                    <CheckCircle2 className="size-3" aria-hidden="true" />
                    Executed records are stored in SQLite. No payment or financial settlement occurred.
                  </span>
                )}
              </div>
            </>
          ) : (
            <CardBody>
              <EmptyState
                icon={<Store className="size-4.5" aria-hidden="true" />}
                title="No allocation has been computed"
                description={
                  canRun
                    ? "Run the maximum-flow solver against the latest tick. It will create a proposed allocation using current offers and requests."
                    : "Advance the simulation at least once to generate household offers and requests."
                }
                action={
                  canRun ? (
                    <Button size="sm" loading={run.isPending} onClick={() => run.mutate()} icon={<Play className="size-3.5" />}>
                      Run max-flow
                    </Button>
                  ) : undefined
                }
              />
            </CardBody>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="card flex items-start gap-3 px-4 py-3.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warn-50 text-warn-600">
              <IndianRupee className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold text-ink-900">1 · Bounded price</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">
                Imbalance sets a target price; smoothing and configured floor/cap bound every interval.
              </p>
            </div>
          </div>
          <div className="card flex items-start gap-3 px-4 py-3.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-energy-50 text-energy-600">
              <Workflow className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold text-ink-900">2 · Seller participation</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">
                Each seller releases a smooth fraction of surplus based on price versus reservation price.
              </p>
            </div>
          </div>
          <div className="card flex items-start gap-3 px-4 py-3.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-info-50 text-info-600">
              <Scale className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold text-ink-900">3 · Maximum flow</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">
                Edmonds–Karp maximises served demand subject to seller caps, buyer requests and a {formatNumber(maxTradeKw, 1)} kW
                per-household limit.
              </p>
            </div>
          </div>
        </div>
      </PageBody>
    </>
  );
}
