import { request } from "./client";
import type { Forecast, WeatherCurrent, WeatherStatus } from "../types/api";

export const weatherApi = {
  current: (refresh = false) =>
    request<WeatherCurrent>("/weather/current", {
      query: { refresh },
      timeoutMs: 90_000,
    }),
  status: () => request<WeatherStatus>("/weather/status"),
  forecast: (hours: number) =>
    request<Forecast>("/weather/forecast", {
      query: { hours },
      timeoutMs: 90_000,
    }),
};
