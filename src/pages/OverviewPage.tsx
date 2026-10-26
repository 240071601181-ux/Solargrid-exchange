import { Activity, ArrowRight, CloudSun, Cpu, Leaf, LineChart, ReceiptText, SunMedium, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useSimulation } from "../hooks/queries";
import { PageBody, PageHeader } from "../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { SegmentedControl } from "../components/common/SegmentedControl";
import { ChartSkeleton, MetricSkeleton } from "../components/common/Skeletons";
import { ErrorState, InlineAlert } from "../components/common/States";
import { FreshnessBadge } from "../components/common/Freshness";
import { MetricGrid } from "../components/dashboard/MetricGrid";
import { RecentTransactions } from "../components/dashboard/RecentTransactions";
import { SimulationControls } from "../components/simulation/SimulationControls";
import { WeatherPanel } from "../components/weather/WeatherPanel";
import { EnergyBalanceChart } from "../components/charts/EnergyBalanceChart";
import { PriceChart } from "../components/charts/PriceChart";
import { formatPrice } from "../utils/format";

function ProvenanceStrip() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <div className="card flex items-start gap-3 px-4 py-3.5">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-energy-50 text-energy-600">
          <CloudSun className="size-4" aria-hidden="true" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-xs font-semibold text-ink-900">Weather · real</p>
            <Badge tone="success">MCP</Badge>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            Open-Meteo current conditions and hourly forecast retrieved through a local MCP stdio session. No synthetic
            fallback is substituted.
          </p>
        </div>
      </div>
      <div className="card flex items-start gap-3 px-4 py-3.5">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-warn-50 text-warn-600">
          <SunMedium className="size-4" aria-hidden="true" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-xs font-semibold text-ink-900">Generation · estimated</p>
            <Badge tone="warning">model</Badge>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            Rooftop output is derived from real provider irradiance, installed capacity, orientation and temperature.
            There are no on-site solar meters.
          </p>
        </div>
      </div>
      <div className="card flex items-start gap-3 px-4 py-3.5">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-info-50 text-info-600">
          <Cpu className="size-4" aria-hidden="true" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-xs font-semibold text-ink-900">Demand, trades · simulated</p>
            <Badge tone="info">synthetic</Badge>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            Household load, batteries, prices and P2P allocations are deterministic simulation outputs. Transactions are
            recorded, never financially settled.
          </p>
        </div>
      </div>
    </div>
  );
}

export function OverviewPage() {
  const simulation = useSimulation();
  const [range, setRange] = useState<12 | 24 | 48>(24);

  if (simulation.isPending) {
    return (
      <>
        <PageHeader
          eyebrow="Control center"
          title="Microgrid overview"
          description="Live simulated energy balance, market price and recent peer trades for the Perur microgrid."
        />
        <PageBody>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => (
              <MetricSkeleton key={index} />
            ))}
          </div>
          <div className="card p-5">
            <ChartSkeleton height={260} />
          </div>
        </PageBody>
      </>
    );
  }

  if (simulation.isError) {
    return (
      <>
        <PageHeader eyebrow="Control center" title="Microgrid overview" />
        <PageBody>
          <ErrorState
            error={simulation.error}
            title="Backend snapshot unavailable"
            onRetry={() => void simulation.refetch()}
          />
        </PageBody>
      </>
    );
  }

  const snapshot = simulation.data;
  const weather = snapshot.weather;
  const history = snapshot.history.slice(-range);
  const allocation = snapshot.allocation;

  return (
    <>
      <PageHeader
        eyebrow="Control center · Perur, Coimbatore"
        title="Microgrid overview"
        description="A live view of estimated rooftop generation, simulated demand, the bounded peer-to-peer price and persisted trades. Weather is real provider data; everything downstream is simulation."
        meta={
          <>
            <Badge tone={snapshot.state.status === "running" ? "success" : snapshot.state.status === "error" ? "danger" : "neutral"} dot>
              {snapshot.state.status}
            </Badge>
            {weather ? (
              <FreshnessBadge status={weather.status} ageSeconds={weather.age_seconds} />
            ) : (
              <Badge tone="danger">Weather unavailable</Badge>
            )}
            <Badge tone="neutral">{snapshot.state.scenario_label}</Badge>
            {allocation ? (
              <Badge tone={allocation.status === "executed" ? "success" : "warning"} dot>
                Last allocation {allocation.status}
              </Badge>
            ) : null}
          </>
        }
        actions={
          <>
            <Link
              to="/forecasting"
              className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <LineChart className="size-3.5" aria-hidden="true" />
              Forecast
            </Link>
            <Link
              to="/marketplace"
              className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink-900 bg-ink-900 px-2.5 text-xs font-medium text-white shadow-sm hover:bg-ink-800"
            >
              Marketplace
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </>
        }
      />

      <PageBody>
        <MetricGrid snapshot={snapshot} />

        {snapshot.state.tick === 0 ? (
          <InlineAlert tone="info">
            <span className="font-medium">The simulation has not advanced yet.</span> Weather is already real provider
            data. Start the auto loop or advance one step to generate simulated households, prices and trades.
          </InlineAlert>
        ) : null}

        {snapshot.state.last_error ? (
          <InlineAlert tone="danger">
            <span className="font-medium">Last simulation error:</span> {snapshot.state.last_error}
          </InlineAlert>
        ) : null}

        <Card>
          <CardHeader
            title="Run control"
            subtitle="The backend advances on its configured interval while running"
            icon={<Activity className="size-4" aria-hidden="true" />}
            action={<Badge tone="neutral">Tick {snapshot.state.tick}</Badge>}
          />
          <CardBody>
            <SimulationControls snapshot={snapshot} />
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-8">
            <CardHeader
              title="Energy balance"
              subtitle="Estimated generation, simulated demand and cleared peer energy (kW)"
              icon={<Leaf className="size-4" aria-hidden="true" />}
              action={
                <SegmentedControl
                  label="History range"
                  value={range}
                  onChange={(value) => setRange(value)}
                  options={[
                    { value: 12, label: "12" },
                    { value: 24, label: "24" },
                    { value: 48, label: "48" },
                  ]}
                />
              }
            />
            <CardBody>
              <EnergyBalanceChart history={history} />
              <p className="mt-2 border-t border-line pt-2.5 text-[10px] leading-4 text-slate-400">
                Generation is estimated from MCP irradiance. Demand, battery dispatch and allocation are simulated.
                Chart shows the last {range} ticks only.
              </p>
            </CardBody>
          </Card>
          <div className="xl:col-span-4">
            <WeatherPanel snapshot={snapshot} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-5">
            <CardHeader
              title="Price signal"
              subtitle={`${formatPrice(snapshot.pricing.price_inr_kwh)}/kWh · bounded dynamic tariff`}
              icon={<LineChart className="size-4" aria-hidden="true" />}
              action={<Badge tone="warning">₹/kWh</Badge>}
            />
            <CardBody>
              <PriceChart history={history} />
              <p className="mt-2 border-t border-line pt-2.5 text-[10px] leading-4 text-slate-500">
                {snapshot.pricing.reason}
              </p>
            </CardBody>
          </Card>

          <Card className="xl:col-span-7">
            <CardHeader
              title="Recent transactions"
              subtitle="Persisted simulated trades · no financial settlement"
              icon={<ReceiptText className="size-4" aria-hidden="true" />}
              action={
                <Link
                  to="/transactions"
                  className="focus-ring rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-ink-900"
                >
                  View all
                </Link>
              }
            />
            <CardBody className="pt-2">
              <RecentTransactions transactions={snapshot.recent_transactions} />
            </CardBody>
          </Card>
        </div>

        <ProvenanceStrip />

        {weather?.status === "stale" || weather?.status === "expired" ? (
          <InlineAlert tone="warning">
            <TriangleAlert className="mr-1 inline size-3.5" aria-hidden="true" />
            Weather data is not current. The simulation refuses expired observations, but stale real data may still be
            used. {weather.last_error ?? ""}
          </InlineAlert>
        ) : null}
      </PageBody>
    </>
  );
}
