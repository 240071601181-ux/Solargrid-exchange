import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EvaluationResult } from "../../types/api";
import { buildEvaluationChart, CHART, chartNumber } from "../../utils/chart";
import { EmptyState } from "../common/States";
import { BarChart3 } from "lucide-react";

export function EvaluationAllocationChart({
  result,
  height = 240,
}: {
  result: EvaluationResult;
  height?: number;
}) {
  const data = buildEvaluationChart(result);
  if (data.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="size-4.5" aria-hidden="true" />}
        title="Allocation series unavailable"
        description="The replay returned no per-interval rows."
      />
    );
  }

  return (
    <div style={{ height }} className="w-full" aria-label="Allocated and unmet power by strategy for each replay interval">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }} accessibilityLayer>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART.axis }} tickLine={false} axisLine={{ stroke: CHART.grid }} minTickGap={26} />
          <YAxis
            tick={{ fontSize: 10, fill: CHART.axis }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(value: number) => chartNumber(value)}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: CHART.grid, boxShadow: "0 6px 18px rgb(11 18 32 / 0.08)" }}
            formatter={(value, name) => [`${chartNumber(Number(value), " kW")}`, String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
          <Bar dataKey="staticAllocated" name="Static allocated" fill={CHART.basePrice} fillOpacity={0.65} isAnimationActive={false} />
          <Bar dataKey="dynamicAllocated" name="Dynamic allocated" fill={CHART.price} fillOpacity={0.85} isAnimationActive={false} />
          <Bar dataKey="staticUnmet" name="Static unmet" fill={CHART.unmet} fillOpacity={0.35} isAnimationActive={false} />
          <Bar dataKey="dynamicUnmet" name="Dynamic unmet" fill={CHART.unmet} fillOpacity={0.7} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
