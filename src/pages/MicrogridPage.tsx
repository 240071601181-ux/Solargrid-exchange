import { ArrowRight, BatteryCharging, CloudRain, Network, ScanLine, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useSimulation } from "../hooks/queries";
import { PageBody, PageHeader } from "../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { ProgressBar } from "../components/common/ProgressBar";
import { ChartSkeleton, MetricSkeleton } from "../components/common/Skeletons";
import { ErrorState, InlineAlert } from "../components/common/States";
import { MicrogridMap, MicrogridMapLegend } from "../components/microgrid/MicrogridMap";
import { HouseholdTable } from "../components/microgrid/HouseholdTable";
import { HouseholdDrawer } from "../components/microgrid/HouseholdDrawer";
import { SimulationControls } from "../components/simulation/SimulationControls";
import { ScenarioControls } from "../components/simulation/ScenarioControls";
import { FreshnessBadge } from "../components/common/Freshness";
import { formatKwh, formatNumber, formatPct, formatPrice } from "../utils/format";

export function MicrogridPage() {
  const simulation = useSimulation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (simulation.isPending) {
    return (
      <>
        <PageHeader eyebrow="Operations" title="Microgrid network" />
        <PageBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <MetricSkeleton key={index} />
            ))}
          </div>
          <div className="card p-5">
            <ChartSkeleton height={360} />
          </div>
        </PageBody>
      </>
    );
  }

  if (simulation.isError) {
    return (
      <>
        <PageHeader eyebrow="Operations" title="Microgrid network" />
        <PageBody>
          <ErrorState error={simulation.error} onRetry={() => void simulation.refetch()} />
        </PageBody>
      </>
    );
  }

  const snapshot = simulation.data;
  const sellers = snapshot.households.filter((household) => household.status === "seller");
  const buyers = snapshot.households.filter((household) => household.status === "buyer");
  const totalCapacity = snapshot.households.reduce((sum, household) => sum + household.battery_capacity_kwh, 0);
  const totalSoc = snapshot.households.reduce((sum, household) => sum + household.battery_soc_kwh, 0);
  const fleetSoc = totalCapacity > 0 ? (totalSoc / totalCapacity) * 100 : null;
  const servedPct =
    snapshot.totals.demand_kw && snapshot.totals.demand_kw > 0 && snapshot.totals.allocated_kw !== null
      ? (snapshot.totals.allocated_kw / snapshot.totals.demand_kw) * 100
      : null;

  return (
    <>
      <PageHeader
        eyebrow="Operations · logical topology"
        title="Microgrid network"
        description="Eight simulated households exchange energy through a central peer-to-peer clearing bus. Node positions are schematic; no feeder impedance or voltage constraint is modeled."
        meta={
          <>
            <Badge tone="neutral" dot>
              Tick {snapshot.state.tick}
            </Badge>
            <Badge tone="success">{sellers.length} sellers</Badge>
            <Badge tone="info">{buyers.length} buyers</Badge>
            {snapshot.weather ? (
              <FreshnessBadge status={snapshot.weather.status} ageSeconds={snapshot.weather.age_seconds} />
            ) : null}
          </>
        }
        actions={
          <Link
            to="/marketplace"
            className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Open order book
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        }
      />

      <PageBody>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-7">
            <CardHeader
              title="Run control"
              subtitle="Advance the deterministic simulation or reset all derived records"
              icon={<ScanLine className="size-4" aria-hidden="true" />}
            />
            <CardBody>
              <SimulationControls snapshot={snapshot} />
            </CardBody>
          </Card>

          <Card className="xl:col-span-5">
            <CardHeader
              title="Cloud scenario"
              subtitle="Synthetic attenuation overlay on real provider irradiance"
              icon={<CloudRain className="size-4" aria-hidden="true" />}
              action={<Badge tone={snapshot.state.cloud_scenario_pct > 0 ? "warning" : "success"}>{snapshot.state.scenario_label}</Badge>}
            />
            <CardBody>
              <ScenarioControls key={snapshot.state.cloud_scenario_pct} snapshot={snapshot} />
            </CardBody>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-8">
            <CardHeader
              title="Logical microgrid"
              subtitle="Click a household for interval details and recent trades"
              icon={<Network className="size-4" aria-hidden="true" />}
              action={<Badge tone="neutral">{formatPrice(snapshot.pricing.price_inr_kwh)}/kWh</Badge>}
            />
            <CardBody className="pb-3">
              <MicrogridMap
                households={snapshot.households}
                price={snapshot.state.tick > 0 ? snapshot.pricing.price_inr_kwh : null}
                tick={snapshot.state.tick}
                onSelect={setSelectedId}
                selectedId={selectedId}
              />
              <div className="mt-2 border-t border-line pt-3">
                <MicrogridMapLegend />
              </div>
              <p className="mt-2 text-[10px] leading-4 text-slate-400">
                Schematic only: connections represent market eligibility, not electrical routing. Household solar,
                demand and battery values are simulated/estimated.
              </p>
            </CardBody>
          </Card>

          <div className="space-y-4 xl:col-span-4">
            <Card>
              <CardHeader
                title="Interval balance"
                subtitle={snapshot.state.tick > 0 ? "After battery dispatch" : "No interval has run"}
                icon={<BatteryCharging className="size-4" aria-hidden="true" />}
              />
              <CardBody className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-line bg-slate-50/60 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.06em] text-slate-500">Physical surplus</p>
                    <p className="num mt-0.5 text-sm font-semibold text-energy-700">{formatNumber(snapshot.totals.surplus_kw, 2)} kW</p>
                  </div>
                  <div className="rounded-lg border border-line bg-slate-50/60 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.06em] text-slate-500">Physical deficit</p>
                    <p className="num mt-0.5 text-sm font-semibold text-info-600">{formatNumber(snapshot.totals.deficit_kw, 2)} kW</p>
                  </div>
                  <div className="rounded-lg border border-line bg-slate-50/60 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.06em] text-slate-500">Offered supply</p>
                    <p className="num mt-0.5 text-sm font-semibold text-slate-700">{formatNumber(snapshot.totals.offered_supply_kw, 2)} kW</p>
                  </div>
                  <div className="rounded-lg border border-line bg-slate-50/60 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.06em] text-slate-500">Allocated</p>
                    <p className="num mt-0.5 text-sm font-semibold text-slate-700">{formatNumber(snapshot.totals.allocated_kw, 2)} kW</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Demand served by P2P</span>
                    <span className="num font-medium text-slate-700">{formatPct(servedPct, 1)}</span>
                  </div>
                  <ProgressBar className="mt-1.5" value={servedPct ?? 0} tone="info" label="Share of physical deficit served by P2P allocation" />
                  <p className="mt-1 text-[10px] text-slate-400">
                    {formatNumber(snapshot.totals.unmet_kw, 2)} kW remains unmet after matching.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Battery fleet state of charge</span>
                    <span className="num font-medium text-slate-700">{formatPct(fleetSoc, 1)}</span>
                  </div>
                  <ProgressBar className="mt-1.5" value={fleetSoc ?? 0} tone="success" label="Battery fleet average state of charge" />
                  <p className="mt-1 text-[10px] text-slate-400">
                    {formatKwh(totalSoc, 1)} kWh stored across {snapshot.households.length} simulated households.
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-[11px] text-slate-600">
                  <Users className="size-3.5 text-slate-400" aria-hidden="true" />
                  {sellers.length} selling, {buyers.length} buying,{" "}
                  {snapshot.households.length - sellers.length - buyers.length} balanced.
                </div>

                {snapshot.state.cloud_scenario_pct > 0 ? (
                  <InlineAlert tone="warning">
                    Cloud overlay active at {formatNumber(snapshot.state.cloud_scenario_pct, 0)}%. Provider irradiance is{" "}
                    {formatNumber(snapshot.weather?.irradiance_w_m2, 0)} W/m²; effective scenario irradiance is{" "}
                    {formatNumber(snapshot.totals.effective_irradiance_w_m2, 0)} W/m².
                  </InlineAlert>
                ) : null}
              </CardBody>
            </Card>
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardHeader
            title="Household fleet"
            subtitle="Per-interval generation, demand, market participation and battery state"
            action={<Badge tone="neutral">{snapshot.households.length} households</Badge>}
          />
          <HouseholdTable households={snapshot.households} onSelect={setSelectedId} selectedId={selectedId} />
        </Card>

        {snapshot.state.last_error ? (
          <InlineAlert tone="danger">
            <span className="font-medium">Simulation error:</span> {snapshot.state.last_error}
          </InlineAlert>
        ) : null}
      </PageBody>

      <HouseholdDrawer householdId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
