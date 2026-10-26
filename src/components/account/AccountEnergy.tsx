import { BatteryCharging, CloudSun, Gauge, SunMedium, Zap } from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AccountEnergy } from "../../types/api";
import { CHART, chartNumber, shortTime } from "../../utils/chart";
import { formatDateTime, formatKwh, formatKw, formatNumber, formatPct } from "../../utils/format";
import { Card, CardBody, CardHeader } from "../common/Card";
import { StatCard } from "../common/StatCard";
import { Badge } from "../common/Badge";
import { EmptyState } from "../common/States";

export function AccountEnergyStats({ energy }: { energy: AccountEnergy }) {
  const { current, daily, household } = energy;
  const isSeller = household.has_battery || household.solar_capacity_kw > 0;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Generation now"
        value={formatKw(current.generation_kw)}
        unit="kW"
        icon={<SunMedium className="size-4" />}
        tone="success"
        hint={household.solar_capacity_kw > 0 ? `${formatNumber(household.solar_capacity_kw, 1)} kW installed` : "No rooftop solar registered"}
      />
      <StatCard
        label="Demand now"
        value={formatKw(current.demand_kw)}
        unit="kW"
        icon={<Zap className="size-4" />}
        tone="info"
        hint={`${formatNumber(household.demand_base_kw, 1)} kW baseline · simulated`}
      />
      <StatCard
        label={current.net_kw >= 0 ? "Net surplus" : "Net deficit"}
        value={formatKw(Math.abs(current.net_kw))}
        unit="kW"
        icon={<Gauge className="size-4" />}
        tone={current.net_kw >= 0 ? "success" : "warning"}
        hint={`As of ${formatDateTime(current.estimated_at)}`}
      />
      <StatCard
        label={isSeller ? "Available to offer" : "Forecast deficit"}
        value={isSeller ? formatKwh(daily.available_to_offer_kwh) : formatKwh(daily.deficit_kwh)}
        unit="kWh"
        icon={<BatteryCharging className="size-4" />}
        tone={isSeller ? "success" : "neutral"}
        hint={
          isSeller
            ? `${formatKwh(daily.reserved_offer_kwh)} kWh reserved in live offers`
            : "Estimated shortfall for the forecast day"
        }
      />
    </div>
  );
}

export function AccountEnergyPanel({ energy, compact = false }: { energy: AccountEnergy; compact?: boolean }) {
  const { current, daily, household, weather, forecast } = energy;
  return (
    <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
      <Card>
        <CardHeader
          title="Solar and demand forecast"
          subtitle={`${forecast.provider || "Open-Meteo"} · ${forecast.freshness.replaceAll("_", " ")} · ${forecast.horizon_hours}h horizon`}
          icon={<SunMedium className="size-4" aria-hidden="true" />}
          action={
            weather ? (
              <Badge tone={weather.status === "live" ? "success" : weather.status === "stale" ? "warning" : "danger"} dot>
                {formatNumber(weather.temperature_c, 1)}°C · {formatNumber(weather.cloud_cover_pct, 0)}% cloud
              </Badge>
            ) : (
              <Badge tone="warning" dot>
                Weather unavailable
              </Badge>
            )
          }
        />
        <CardBody className="pt-3">
          <AccountForecastChart energy={energy} height={compact ? 210 : 248} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Today at a glance"
          subtitle="Simulated household energy balance"
          icon={<CloudSun className="size-4" aria-hidden="true" />}
        />
        <CardBody className="space-y-3.5">
          <SummaryRow label="Forecast generation" value={`${formatKwh(daily.generation_kwh)} kWh`} />
          <SummaryRow label="Forecast demand" value={`${formatKwh(daily.demand_kwh)} kWh`} />
          <SummaryRow label="Daylight surplus" value={`${formatKwh(daily.surplus_kwh)} kWh`} />
          <SummaryRow label="Daylight deficit" value={`${formatKwh(daily.deficit_kwh)} kWh`} />
          <SummaryRow label="Reserved in offers" value={`${formatKwh(daily.reserved_offer_kwh)} kWh`} />
          <div className="border-t border-line pt-3">
            <SummaryRow
              label="Current net"
              value={`${current.net_kw >= 0 ? "+" : ""}${formatNumber(current.net_kw)} kW`}
              emphasis
            />
          </div>
          <div className="rounded-lg border border-line bg-slate-50/80 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-[11.5px]">
              <span className="text-slate-500">{household.has_battery ? "Battery state" : "Battery"}</span>
              <span className="font-medium text-ink-900">
                {household.has_battery
                  ? `${formatKwh(household.battery_soc_kwh)} / ${formatKwh(household.battery_capacity_kwh)} kWh`
                  : "Not installed"}
              </span>
            </div>
            {household.has_battery ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-energy-500"
                  style={{ width: `${Math.max(2, Math.min(100, household.battery_soc_pct ?? 0))}%` }}
                />
              </div>
            ) : null}
            {household.has_battery ? (
              <p className="mt-1.5 text-right text-[10px] text-slate-500">{formatPct(household.battery_soc_pct)} charged</p>
            ) : null}
          </div>
          {forecast.error ? (
            <p className="text-[11px] leading-5 text-warn-700">Forecast note: {forecast.error}</p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

function SummaryRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className={emphasis ? "font-medium text-ink-900" : "text-slate-500"}>{label}</span>
      <span className={`num text-right ${emphasis ? "font-semibold text-ink-900" : "font-medium text-slate-700"}`}>
        {value}
      </span>
    </div>
  );
}

export function AccountForecastChart({ energy, height = 248 }: { energy: AccountEnergy; height?: number }) {
  const series = energy.forecast.series;
  if (series.length === 0) {
    return (
      <EmptyState
        icon={<SunMedium className="size-4.5" aria-hidden="true" />}
        title="No forecast available"
        description="The weather provider did not return a usable forecast. Retry from the header refresh control."
        className="border-0 bg-transparent"
      />
    );
  }
  const data = series.map((point) => ({
    label: shortTime(point.timestamp),
    generation: point.generation_kw,
    demand: point.demand_kw,
    cloud: point.cloud_cover_pct,
  }));
  return (
    <div style={{ height }} className="w-full" aria-label="Estimated solar generation and simulated household demand">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }} accessibilityLayer>
          <defs>
            <linearGradient id="accountGeneration" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.generation} stopOpacity={0.2} />
              <stop offset="100%" stopColor={CHART.generation} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: CHART.axis }}
            tickLine={false}
            axisLine={{ stroke: CHART.grid }}
            minTickGap={28}
          />
          <YAxis
            tick={{ fontSize: 10, fill: CHART.axis }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(value: number) => chartNumber(value)}
          />
          <Tooltip
            contentStyle={{
              fontSize: 11,
              borderRadius: 8,
              borderColor: CHART.grid,
              boxShadow: "0 6px 18px rgb(11 18 32 / 0.08)",
            }}
            labelStyle={{ color: CHART.text, fontWeight: 600 }}
            formatter={(value, name) => [`${chartNumber(Number(value), " kW")}`, String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} iconType="line" />
          <Area
            type="monotone"
            dataKey="generation"
            name="Estimated generation"
            stroke={CHART.generation}
            strokeWidth={1.8}
            fill="url(#accountGeneration)"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="demand"
            name="Simulated demand"
            stroke={CHART.demand}
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
