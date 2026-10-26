import type { EvaluationResult, SimulationSnapshot } from "../types/api";

export const CHART = {
  generation: "#16a34a",
  demand: "#2563eb",
  price: "#0f766e",
  basePrice: "#94a3b8",
  unmet: "#dc2626",
  surplus: "#d97706",
  grid: "#e3e8ef",
  axis: "#94a3b8",
  text: "#475569",
} as const;

export function shortTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function chartNumber(value: number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value)}${suffix}`;
}

export interface EvaluationChartPoint {
  tick: number;
  label: string;
  staticPrice: number | null;
  dynamicPrice: number | null;
  staticAllocated: number | null;
  dynamicAllocated: number | null;
  staticUnmet: number | null;
  dynamicUnmet: number | null;
}

export function buildEvaluationChart(result: EvaluationResult): EvaluationChartPoint[] {
  const staticSeries = result.series.find((item) => item.strategy === "static")?.series ?? [];
  const dynamicSeries = result.series.find((item) => item.strategy === "dynamic")?.series ?? [];
  const length = Math.max(staticSeries.length, dynamicSeries.length);
  const points: EvaluationChartPoint[] = [];
  for (let index = 0; index < length; index += 1) {
    const staticPoint = staticSeries[index];
    const dynamicPoint = dynamicSeries[index];
    points.push({
      tick: index + 1,
      label: shortTime(staticPoint?.timestamp ?? dynamicPoint?.timestamp ?? null),
      staticPrice: staticPoint?.price_inr_kwh ?? null,
      dynamicPrice: dynamicPoint?.price_inr_kwh ?? null,
      staticAllocated: staticPoint?.allocated_kw ?? null,
      dynamicAllocated: dynamicPoint?.allocated_kw ?? null,
      staticUnmet: staticPoint?.unmet_kw ?? null,
      dynamicUnmet: dynamicPoint?.unmet_kw ?? null,
    });
  }
  return points;
}

export function latestTickLabel(snapshot: SimulationSnapshot | undefined): string {
  if (!snapshot || snapshot.state.tick === 0) return "No tick";
  return `Tick ${snapshot.state.tick}`;
}
