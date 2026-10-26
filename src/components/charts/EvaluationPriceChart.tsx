import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EvaluationResult } from "../../types/api";
import { buildEvaluationChart, CHART, chartNumber } from "../../utils/chart";
import { EmptyState } from "../common/States";
import { Scale } from "lucide-react";

export function EvaluationPriceChart({ result, height = 240 }: { result: EvaluationResult; height?: number }) {
  const data = buildEvaluationChart(result);
  if (data.length === 0) {
    return (
      <EmptyState
        icon={<Scale className="size-4.5" aria-hidden="true" />}
        title="Evaluation series unavailable"
        description="The replay returned no per-interval rows."
      />
    );
  }

  return (
    <div style={{ height }} className="w-full" aria-label="Static versus dynamic price per replay interval">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }} accessibilityLayer>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART.axis }} tickLine={false} axisLine={{ stroke: CHART.grid }} minTickGap={24} />
          <YAxis
            tick={{ fontSize: 10, fill: CHART.axis }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(value: number) => `₹${chartNumber(value)}`}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: CHART.grid, boxShadow: "0 6px 18px rgb(11 18 32 / 0.08)" }}
            formatter={(value, name) => [`₹${chartNumber(Number(value))}/kWh`, String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="line" />
          <Line
            type="monotone"
            dataKey="staticPrice"
            name="Static price"
            stroke={CHART.basePrice}
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="dynamicPrice"
            name="Dynamic price"
            stroke={CHART.price}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
