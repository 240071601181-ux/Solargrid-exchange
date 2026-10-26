import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartLine } from "lucide-react";
import type { HistoryPoint } from "../../types/api";
import { CHART, chartNumber, shortTime } from "../../utils/chart";
import { EmptyState } from "../common/States";

export function PriceChart({ history, height = 188 }: { history: HistoryPoint[]; height?: number }) {
  if (history.length === 0) {
    return (
      <EmptyState
        icon={<ChartLine className="size-4.5" aria-hidden="true" />}
        title="No price ticks yet"
        description="The dynamic price appears after the first simulation step. Base, minimum and maximum tariffs are configured in Settings."
        className="border-0 bg-transparent"
      />
    );
  }

  const data = history.map((point) => ({
    label: shortTime(point.simulated_at),
    tick: point.tick,
    price: point.price_inr_kwh,
    base: point.base_price_inr_kwh,
    imbalance: point.imbalance,
  }));
  const basePrice = history[history.length - 1]?.base_price_inr_kwh ?? 6;

  return (
    <div style={{ height }} className="w-full" aria-label="Dynamic electricity price compared with the base tariff">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, left: -20, bottom: 0 }} accessibilityLayer>
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
            domain={["auto", "auto"]}
            tickFormatter={(value: number) => `₹${chartNumber(value)}`}
          />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: CHART.grid, boxShadow: "0 6px 18px rgb(11 18 32 / 0.08)" }}
            labelStyle={{ color: CHART.text, fontWeight: 600 }}
            formatter={(value, name) => [`₹${chartNumber(Number(value))}/kWh`, String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="line" />
          <ReferenceLine y={basePrice} stroke={CHART.basePrice} strokeDasharray="4 3" ifOverflow="extendDomain" />
          <Line
            type="monotone"
            dataKey="price"
            name="Dynamic price"
            stroke={CHART.price}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="base"
            name="Base tariff"
            stroke={CHART.basePrice}
            strokeWidth={1.2}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
