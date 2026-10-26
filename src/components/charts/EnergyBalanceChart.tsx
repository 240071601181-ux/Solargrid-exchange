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
import type { HistoryPoint } from "../../types/api";
import { CHART, chartNumber, shortTime } from "../../utils/chart";
import { EmptyState } from "../common/States";
import { ChartNoAxesCombined } from "lucide-react";

export function EnergyBalanceChart({ history, height = 252 }: { history: HistoryPoint[]; height?: number }) {
  if (history.length === 0) {
    return (
      <EmptyState
        icon={<ChartNoAxesCombined className="size-4.5" aria-hidden="true" />}
        title="No simulation ticks yet"
        description="Start the simulation or advance a single step. Charts only plot values returned by the backend."
        className="border-0 bg-transparent"
      />
    );
  }

  const data = history.map((point) => ({
    label: shortTime(point.simulated_at),
    tick: point.tick,
    generation: point.generation_kw,
    demand: point.demand_kw,
    allocated: point.allocated_kw,
    unmet: point.unmet_kw,
  }));

  return (
    <div style={{ height }} className="w-full" aria-label="Simulated solar generation, demand, allocated energy and unmet demand">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }} accessibilityLayer>
          <defs>
            <linearGradient id="generationFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.generation} stopOpacity={0.18} />
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
            width={54}
            tickFormatter={(value: number) => chartNumber(value)}
            label={{ value: "kW", angle: -90, position: "insideLeft", offset: 20, fontSize: 10, fill: CHART.axis }}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: CHART.grid, boxShadow: "0 6px 18px rgb(11 18 32 / 0.08)" }}
            labelStyle={{ color: CHART.text, fontWeight: 600 }}
            formatter={(value, name) => [`${chartNumber(Number(value), " kW")}`, String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} iconType="line" />
          <Area
            type="monotone"
            dataKey="generation"
            name="Generation (estimated)"
            stroke={CHART.generation}
            strokeWidth={1.8}
            fill="url(#generationFill)"
            dot={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="demand"
            name="Demand (simulated)"
            stroke={CHART.demand}
            strokeWidth={1.8}
            fill="transparent"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="allocated"
            name="Allocated"
            stroke="#0f172a"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 3"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="unmet"
            name="Unmet"
            stroke={CHART.unmet}
            strokeWidth={1.4}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
