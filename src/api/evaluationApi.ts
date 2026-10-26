import { request } from "./client";
import type { EvaluationResult } from "../types/api";

export const evaluationApi = {
  latest: () => request<EvaluationResult | null>("/evaluation/latest"),
  run: (ticks: number, cloudCoverPct: number) =>
    request<EvaluationResult>("/evaluation/run", {
      method: "POST",
      body: { ticks, cloud_cover_pct: cloudCoverPct },
      timeoutMs: 120_000,
    }),
};
