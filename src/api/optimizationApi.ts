import { request } from "./client";
import type { Allocation, ExecutionResult } from "../types/api";

export const optimizationApi = {
  latest: () => request<Allocation | null>("/optimization/latest"),
  run: () => request<Allocation>("/optimization/run", { method: "POST" }),
  execute: (runId: number) =>
    request<ExecutionResult>(`/optimization/${runId}/execute`, { method: "POST" }),
  runs: (limit = 10) => request<Allocation[]>("/optimization/runs", { query: { limit } }),
  stats: () =>
    request<{
      runs: number;
      latest_algorithm: string | null;
      latest_execution_ms: number | null;
      latest_status: string | null;
      network_trade_limit_kw: number;
    }>("/optimization/stats"),
};
