import { request } from "./client";
import type { Health } from "../types/api";

export const metricsApi = {
  health: () => request<Health>("/health", { timeoutMs: 15_000 }),
};
