import { request } from "./client";
import type { SimulationSnapshot } from "../types/api";

export const simulationApi = {
  state: () => request<SimulationSnapshot>("/simulation/state", { timeoutMs: 60_000 }),
  start: () => request<SimulationSnapshot>("/simulation/start", { method: "POST", timeoutMs: 90_000 }),
  pause: () => request<SimulationSnapshot>("/simulation/pause", { method: "POST" }),
  step: () => request<SimulationSnapshot>("/simulation/step", { method: "POST", timeoutMs: 90_000 }),
  reset: () => request<SimulationSnapshot>("/simulation/reset", { method: "POST", timeoutMs: 60_000 }),
  setCloudScenario: (cloudCoverPct: number, advance = true) =>
    request<SimulationSnapshot>("/simulation/scenario/cloud", {
      method: "POST",
      body: { cloud_cover_pct: cloudCoverPct, advance },
      timeoutMs: 90_000,
    }),
};
