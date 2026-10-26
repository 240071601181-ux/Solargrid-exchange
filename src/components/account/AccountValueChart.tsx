import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { CHART, chartNumber } from "../../utils/chart";
import { EmptyState } from "../common/States";

export function AccountValueChart({
  data,
  label,
  height = 190,
}: {
  data: Array<{ date: string; energy_kwh: number; value_inr: number }>;
  label: string;
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="size-4.5" aria-hidden="true" />}
        title="No completed activity yet"
        description="This chart fills in after completed marketplace purchases or sales."
        className="border-0 bg-transparent"
      />
    );
  }
  const series = data.map((point) => ({ ...point, day: point.date.slice(5) }));
  return (
    <div style={{ height }} className="w-full" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 6, right: 8, left: -20, bottom: 0 }} accessibilityLayer>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: CHART.axis }} tickLine={false} axisLine={{ stroke: CHART.grid }} />
          <YAxis
            tick={{ fontSize: 10, fill: CHART.axis }}
            tickLine={false}
            axisLine={false}
            width={48}
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
            formatter={(value, name) => [
              name === "value_inr" ? `₹${chartNumber(Number(value))}` : `${chartNumber(Number(value))} kWh`,
              name === "value_inr" ? "Simulated value" : "Energy",
            ]}
          />
          <Bar dataKey="value_inr" name="Simulated value" fill={CHART.generation} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
