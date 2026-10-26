import { BatteryCharging, MapPin, Settings, SunMedium } from "lucide-react";
import { Link } from "react-router";
import { PageBody, PageHeader } from "../../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/common/Card";
import { Badge } from "../../components/common/Badge";
import { Button } from "../../components/common/Button";
import { ErrorState } from "../../components/common/States";
import { ChartSkeleton, MetricSkeleton } from "../../components/common/Skeletons";
import { AccountEnergyPanel, AccountEnergyStats } from "../../components/account/AccountEnergy";
import { useSellerProfile, useSellerSolar } from "../../hooks/queries";
import { formatDateTime, formatKwh, formatNumber, formatPct, formatTime } from "../../utils/format";

export function SellerSolarPage() {
  const solar = useSellerSolar();
  const profile = useSellerProfile();
  const energy = solar.data;

  if (solar.isPending) {
    return (
      <PageBody>
        <PageHeader eyebrow="Seller workspace" title="My solar system" description="Loading your rooftop estimate." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <MetricSkeleton key={index} />)}
        </div>
        <Card><CardBody><ChartSkeleton /></CardBody></Card>
      </PageBody>
    );
  }
  if (solar.isError || !energy) {
    return (
      <PageBody>
        <PageHeader eyebrow="Seller workspace" title="My solar system" />
        <ErrorState error={solar.error} title="Solar estimate unavailable" onRetry={() => void solar.refetch()} />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        eyebrow="Seller workspace"
        title="My solar system"
        description="Your registered system, current estimate, daily energy balance and MCP-backed forecast."
        meta={
          <>
            <Badge tone="success" dot>{formatNumber(energy.household.solar_capacity_kw, 1)} kW installed</Badge>
            {energy.household.has_battery ? (
              <Badge tone="info">
                {formatNumber(energy.household.battery_capacity_kwh, 1)} kWh battery · {formatPct(energy.household.battery_soc_pct)} charged
              </Badge>
            ) : (
              <Badge tone="neutral">No battery</Badge>
            )}
          </>
        }
        actions={
          <Link to="/seller/settings">
            <Button variant="secondary" icon={<Settings className="size-4" />}>Edit system</Button>
          </Link>
        }
      />

      <AccountEnergyStats energy={energy} />
      <AccountEnergyPanel energy={energy} />

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title="Registered system" subtitle="Used for simulation estimates" icon={<SunMedium className="size-4" aria-hidden="true" />} />
          <CardBody className="space-y-3.5">
            <InfoRow label="Installed capacity" value={`${formatNumber(profile.data?.solar_capacity_kw ?? energy.household.solar_capacity_kw, 2)} kW`} />
            <InfoRow label="Battery storage" value={energy.household.has_battery ? `${formatNumber(energy.household.battery_capacity_kwh, 2)} kWh` : "Not installed"} />
            <InfoRow label="Current battery charge" value={energy.household.has_battery ? `${formatKwh(energy.household.battery_soc_kwh)} kWh` : "—"} />
            <InfoRow label="Household type" value={energy.household.category.replaceAll("_", " ")} />
            <InfoRow label="Baseline demand" value={`${formatNumber(energy.household.demand_base_kw, 2)} kW`} />
            <div className="flex items-start justify-between gap-4 border-t border-line pt-3 text-xs">
              <span className="text-slate-500">Location</span>
              <span className="flex max-w-[65%] items-start gap-1 text-right font-medium text-ink-900">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                {energy.household.location_name}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Forecast points"
            subtitle={`${energy.forecast.horizon_hours} hours · generated ${formatDateTime(energy.forecast.generated_at)}`}
            icon={<SunMedium className="size-4" aria-hidden="true" />}
            action={<Badge tone={energy.forecast.freshness === "live" ? "success" : "warning"} dot>{energy.forecast.freshness.replaceAll("_", " ")}</Badge>}
          />
          <CardBody className="pt-2">
            {energy.forecast.series.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">No forecast points were returned. {energy.forecast.error}</p>
            ) : (
              <div className="max-h-[330px] overflow-auto">
                <table className="w-full text-left text-[11.5px]">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-line text-[10px] uppercase tracking-[0.08em] text-slate-400">
                      <th className="py-2 pr-3 font-medium">Time (IST)</th>
                      <th className="px-3 py-2 font-medium">Generation</th>
                      <th className="px-3 py-2 font-medium">Demand</th>
                      <th className="px-3 py-2 font-medium">Cloud</th>
                      <th className="py-2 pl-3 text-right font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/80">
                    {energy.forecast.series.slice(0, 36).map((point) => (
                      <tr key={point.timestamp} className="text-slate-600">
                        <td className="py-2 pr-3 text-slate-500">{formatTime(point.timestamp)}</td>
                        <td className="num px-3 py-2">{formatNumber(point.generation_kw, 2)} kW</td>
                        <td className="num px-3 py-2">{formatNumber(point.demand_kw, 2)} kW</td>
                        <td className="num px-3 py-2">{formatNumber(point.cloud_cover_pct, 0)}%</td>
                        <td className={`num py-2 pl-3 text-right font-medium ${point.imbalance_kw >= 0 ? "text-energy-700" : "text-warn-700"}`}>
                          {point.imbalance_kw >= 0 ? "+" : ""}{formatNumber(point.imbalance_kw, 2)} kW
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-line bg-white px-4 py-3 text-[11px] leading-5 text-slate-500">
        <BatteryCharging className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <p>
          Generation is estimated from installed capacity and real weather irradiance. Demand is a deterministic
          household profile. Battery state is simulated and does not represent metered hardware.
        </p>
      </div>
    </PageBody>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="num text-right font-medium capitalize text-ink-900">{value}</span>
    </div>
  );
}
