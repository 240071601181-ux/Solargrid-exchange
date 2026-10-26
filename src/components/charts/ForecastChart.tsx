import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CloudSun } from "lucide-react";
import type { ForecastPoint } from "../../types/api";
import { CHART, chartNumber, shortTime } from "../../utils/chart";
import { EmptyState } from "../common/States";

export function ForecastChart({ series, height = 300 }: { series: ForecastPoint[]; height?: number }) {
  if (series.length === 0) {
    return (
      <EmptyState
        icon={<CloudSun className="size-4.5" aria-hidden="true" />}
        title="No forecast available"
        description="The MCP weather provider did not return an hourly forecast. Nothing has been substituted."
        className="border-0 bg-transparent"
      />
    );
  }

  const data = series.map((point) => ({
    label: shortTime(point.timestamp),
    generation: point.generation_kw,
    demand: point.demand_kw,
    imbalance: point.imbalance_kw,
    cloud: point.cloud_cover_pct,
  }));

  return (
    <div style={{ height }} className="w-full" aria-label="Predicted solar generation, demand and expected imbalance">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} accessibilityLayer>
          <defs>
            <linearGradient id="forecastGenFill" x1="0" y1="0" x2="0" y2="1">
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
            minTickGap={26}
          />
          <YAxis
            tick={{ fontSize: 10, fill: CHART.axis }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(value: number) => chartNumber(value)}
            label={{ value: "kW", angle: -90, position: "insideLeft", offset: 20, fontSize: 10, fill: CHART.axis }}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: CHART.grid, boxShadow: "0 6px 18px rgb(11 18 32 / 0.08)" }}
            labelStyle={{ color: CHART.text, fontWeight: 600 }}
            formatter={(value, name) => [
              name === "Imbalance" ? `${chartNumber(Number(value), " kW")}` : `${chartNumber(Number(value), " kW")}`,
              String(name),
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
          <Area
            type="monotone"
            dataKey="generation"
            name="Predicted generation"
            stroke={CHART.generation}
            strokeWidth={1.8}
            fill="url(#forecastGenFill)"
            dot={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="demand"
            name="Predicted demand"
            stroke={CHART.demand}
            strokeWidth={1.8}
            fill="transparent"
            dot={false}
            isAnimationActive={false}
          />
          <Bar dataKey="imbalance" name="Expected surplus / deficit" barSize={9} radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((point, index) => (
              <Cell
                key={index}
                fill={(point.imbalance ?? 0) >= 0 ? CHART.generation : CHART.demand}
                fillOpacity={0.45}
              />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
