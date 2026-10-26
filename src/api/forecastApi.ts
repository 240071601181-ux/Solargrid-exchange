import { request } from "./client";
import type { Forecast } from "../types/api";

export const forecastApi = {
  get: (horizonHours: number) =>
    request<Forecast>("/forecast", {
      query: { horizon_hours: horizonHours },
      timeoutMs: 90_000,
    }),
};
