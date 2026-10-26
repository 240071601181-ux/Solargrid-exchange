import { CheckCircle2, GitMerge, Info, Play, Scale, TimerReset, Workflow } from "lucide-react";
import { useLatestOptimization, useOptimizationStats, useSimulation } from "../hooks/queries";
import { useOptimizationActions } from "../hooks/useActions";
import { PageBody, PageHeader } from "../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { ChartSkeleton, MetricSkeleton, TableSkeleton } from "../components/common/Skeletons";
import { EmptyState, ErrorState, InlineAlert } from "../components/common/States";
import { AllocationFlow } from "../components/optimization/AllocationFlow";
import { AllocationTable } from "../components/marketplace/AllocationTable";
import { formatKwh, formatNumber, formatPrice } from "../utils/format";

export function OptimizationPage() {
  const simulation = useSimulation();
  const allocationQuery = useLatestOptimization();
  const stats = useOptimizationStats();
  const { run, execute } = useOptimizationActions();

  if (simulation.isPending || allocationQuery.isPending) {
    return (
      <>
        <PageHeader eyebrow="Intelligence" title="Allocation optimization" />
        <PageBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <MetricSkeleton key={index} />
            ))}
          </div>
          <div className="card p-5">
            <ChartSkeleton height={280} />
          </div>
        </PageBody>
      </>
    );
  }

  if (simulation.isError || allocationQuery.isError) {
    return (
      <>
        <PageHeader eyebrow="Intelligence" title="Allocation optimization" />
        <PageBody>
          <ErrorState
            error={simulation.error ?? allocationQuery.error}
            title="Could not load optimization state"
            onRetry={() => {
              void simulation.refetch();
              void allocationQuery.refetch();
            }}
          />
        </PageBody>
      </>
    );
  }

  const snapshot = simulation.data;
  const allocation = allocationQuery.data;
  const maxTradeKw = stats.data?.network_trade_limit_kw ?? 4;
  const actionError = run.error ?? execute.error;
  const executed = execute.data;

  return (
    <>
      <PageHeader
        eyebrow="Intelligence · maximum flow"
        title="Allocation optimization"
        description="A deterministic Edmonds–Karp solver maximises served peer demand subject to seller offers, buyer requests and a per-household trade cap. The backend executes and persists the result."
        meta={
          <>
            <Badge tone="neutral">{maxTradeKw.toFixed(1)} kW household cap</Badge>
            <Badge tone="success">Edmonds–Karp</Badge>
            <Badge tone="neutral">{stats.data?.runs ?? 0} runs recorded</Badge>
            {allocation ? (
              <Badge tone={allocation.status === "executed" ? "success" : "warning"} dot>
                Latest run #{allocation.id} · {allocation.status}
              </Badge>
            ) : null}
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
                Execute proposal
              </Button>
            ) : null}
            <Button
              size="sm"
              loading={run.isPending}
              disabled={snapshot.state.tick === 0}
              onClick={() => run.mutate()}
              icon={<Play className="size-3.5" />}
              title={snapshot.state.tick === 0 ? "Advance the simulation first" : "Re-run the solver on the latest tick"}
            >
              Run solver
            </Button>
          </>
        }
      />

      <PageBody>
        {actionError ? (
          <InlineAlert tone="danger">
            <span className="font-medium">Optimization action failed:</span>{" "}
            {actionError instanceof Error ? actionError.message : String(actionError)}
          </InlineAlert>
        ) : null}
        {executed ? (
          <InlineAlert tone="info">
            <span className="font-medium">Proposal executed:</span> {executed.message}
          </InlineAlert>
        ) : null}

        {allocation ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="card px-4 py-3.5">
                <p className="label-xs">Objective · allocated</p>
                <p className="num mt-2 text-[26px] font-semibold leading-8 text-ink-900">
                  {formatNumber(allocation.allocated_kw, 2)}
                  <span className="ml-1.5 text-xs font-medium text-slate-500">kW</span>
                </p>
                <p className="mt-1 text-[10px] text-slate-400">Maximised served demand</p>
              </div>
              <div className="card px-4 py-3.5">
                <p className="label-xs">Links & energy</p>
                <p className="num mt-2 text-[26px] font-semibold leading-8 text-ink-900">
                  {allocation.items.length}
                  <span className="ml-1.5 text-xs font-medium text-slate-500">links</span>
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {formatKwh(allocation.allocated_kw * allocation.interval_seconds / 3600, 3)} kWh this interval
                </p>
              </div>
              <div className="card px-4 py-3.5">
                <p className="label-xs">Solver execution</p>
                <p className="num mt-2 text-[26px] font-semibold leading-8 text-ink-900">
                  {formatNumber(allocation.execution_ms, 2)}
                  <span className="ml-1.5 text-xs font-medium text-slate-500">ms</span>
                </p>
                <p className="mt-1 text-[10px] text-slate-400">Measured on the backend</p>
              </div>
              <div className="card px-4 py-3.5">
                <p className="label-xs">Clearing price</p>
                <p className="num mt-2 text-[26px] font-semibold leading-8 text-ink-900">{formatPrice(allocation.price_inr_kwh)}</p>
                <p className="mt-1 text-[10px] text-slate-400">Recorded with this allocation</p>
              </div>
            </div>

            <Card>
              <CardHeader
                title="Maximum-flow result"
                subtitle={`Tick ${allocation.tick} · ${allocation.algorithm}`}
                icon={<GitMerge className="size-4" aria-hidden="true" />}
                action={
                  <Badge tone={allocation.status === "executed" ? "success" : "warning"} dot>
                    {allocation.status}
                  </Badge>
                }
              />
              <CardBody className="pb-2">
                <AllocationFlow allocation={allocation} />
                <p className="mt-1 text-[10px] leading-4 text-slate-400">
                  Link thickness is proportional to allocated power. Diagram shows logical flows between matched
                  households, not physical feeder routing.
                </p>
              </CardBody>
              <AllocationTable allocation={allocation} />
              <div className="border-t border-line px-4 py-3 text-[10px] leading-4 text-slate-500 sm:px-5">
                {allocation.notes}
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <Card className="lg:col-span-7">
                <CardHeader
                  title="Solver formulation"
                  subtitle="Exact network used by the backend"
                  icon={<Workflow className="size-4" aria-hidden="true" />}
                />
                <CardBody>
                  <ol className="space-y-2.5">
                    {[
                      `Source → seller capacity = min(seller offer, ${maxTradeKw.toFixed(1)} kW).`,
                      `Buyer → sink capacity = min(buyer request, ${maxTradeKw.toFixed(1)} kW).`,
                      `Seller → buyer link capacity = ${maxTradeKw.toFixed(1)} kW for every eligible pair.`,
                      "Edmonds–Karp repeatedly finds a shortest augmenting path in the residual graph until no path remains.",
                      "The resulting flow maximises total allocated power without violating any cap. It does not optimise price, welfare or emissions.",
                    ].map((line, index) => (
                      <li key={line} className="flex gap-3 text-[11px] leading-5 text-slate-600">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500">
                          {index + 1}
                        </span>
                        {line}
                      </li>
                    ))}
                  </ol>
                </CardBody>
              </Card>

              <Card className="lg:col-span-5">
                <CardHeader
                  title="Constraints and limits"
                  subtitle="What the model deliberately excludes"
                  icon={<Info className="size-4" aria-hidden="true" />}
                />
                <CardBody className="space-y-2.5 text-[11px] leading-5 text-slate-600">
                  <p className="flex gap-2">
                    <Scale className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    Every seller and buyer is capped at {maxTradeKw.toFixed(1)} kW per interval; link capacities are also
                    capped.
                  </p>
                  <p className="flex gap-2">
                    <TimerReset className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    Allocations are interval-local. Battery energy is managed before market clearing, not by the
                    allocator.
                  </p>
                  <p className="flex gap-2">
                    <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    Feeder impedance, voltage limits, line losses, ramp constraints and reserve requirements are not
                    modeled.
                  </p>
                  <p className="rounded-lg border border-line bg-slate-50/60 px-3 py-2 text-[10px] leading-4 text-slate-500">
                    The solver is a genuine max-flow implementation, not an LP or a greedy heuristic. Execution time
                    includes only the in-memory allocation loop.
                  </p>
                </CardBody>
              </Card>
            </div>
          </>
        ) : (
          <Card>
            <CardBody>
              <EmptyState
                icon={<GitMerge className="size-4.5" aria-hidden="true" />}
                title="No allocation run exists"
                description={
                  snapshot.state.tick === 0
                    ? "Advance the simulation to generate household offers and requests. Then run the max-flow solver."
                    : "Run the solver against the latest household snapshot to create a proposed allocation."
                }
                action={
                  snapshot.state.tick > 0 ? (
                    <Button size="sm" loading={run.isPending} onClick={() => run.mutate()} icon={<Play className="size-3.5" />}>
                      Run solver
                    </Button>
                  ) : undefined
                }
              />
            </CardBody>
          </Card>
        )}

        {run.isPending ? (
          <div className="card p-5">
            <TableSkeleton rows={2} />
            <p className="mt-2 text-center text-[10px] text-slate-400">Solving maximum flow and persisting a proposal…</p>
          </div>
        ) : null}
      </PageBody>
    </>
  );
}
