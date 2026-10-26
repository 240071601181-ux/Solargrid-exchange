import { Cloud, Droplets, RefreshCw, Sun, Wind } from "lucide-react";
import type { ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { weatherApi } from "../../api/weatherApi";
import { queryKeys } from "../../api/queryKeys";
import type { SimulationSnapshot } from "../../types/api";
import { formatAge, formatDateTime, formatIrradiance, formatNumber, formatTime } from "../../utils/format";
import { Card, CardBody, CardHeader } from "../common/Card";
import { Button } from "../common/Button";
import { FreshnessBadge, FRESHNESS_LABEL } from "../common/Freshness";
import { InlineAlert } from "../common/States";

function WeatherStat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-slate-50/60 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-slate-500">
        {icon}
        {label}
      </div>
      <p className="num mt-1 text-[15px] font-semibold text-ink-900">{value}</p>
    </div>
  );
}

export function WeatherPanel({ snapshot }: { snapshot: SimulationSnapshot }) {
  const weather = snapshot.weather;
  const queryClient = useQueryClient();
  const refresh = useMutation({
    mutationFn: () => weatherApi.current(true),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.simulation });
      void queryClient.invalidateQueries({ queryKey: queryKeys.households });
    },
  });

  const effective = snapshot.totals.effective_irradiance_w_m2;
  const scenarioActive = snapshot.state.cloud_scenario_pct > 0;
  const unavailable = !weather || weather.status === "unavailable";

  return (
    <Card className="h-full">
      <CardHeader
        title="Weather input"
        subtitle="Real provider observations retrieved through MCP"
        icon={<Cloud className="size-4" aria-hidden="true" />}
        action={
          <Button
            size="sm"
            variant="secondary"
            loading={refresh.isPending}
            onClick={() => refresh.mutate()}
            icon={<RefreshCw className="size-3.5" />}
          >
            Refresh
          </Button>
        }
      />
      <CardBody className="space-y-3.5">
        {unavailable ? (
          <InlineAlert tone="danger">
            <span className="font-medium">No real weather observation is available.</span>{" "}
            {weather?.last_error ?? "The MCP provider has not returned data yet."} No synthetic weather has been
            substituted.
          </InlineAlert>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="num text-[32px] font-semibold leading-9 tracking-[-0.03em] text-ink-900">
                  {formatNumber(weather.temperature_c, 1)}
                  <span className="ml-1 text-sm font-medium text-slate-500">°C</span>
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {weather.location_name ?? "Configured location"} · {weather.is_day ? "Daytime" : "Night"}
                </p>
              </div>
              <div className="text-right">
                <FreshnessBadge status={weather.status} ageSeconds={weather.age_seconds} />
                <p className="mt-1 text-[10px] text-slate-400">Observed {formatTime(weather.observed_at)} IST</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <WeatherStat
                label="Cloud cover"
                value={`${formatNumber(weather.cloud_cover_pct, 0)}%`}
                icon={<Cloud className="size-3" aria-hidden="true" />}
              />
              <WeatherStat
                label="Irradiance"
                value={formatIrradiance(weather.irradiance_w_m2)}
                icon={<Sun className="size-3" aria-hidden="true" />}
              />
              <WeatherStat
                label="Wind"
                value={`${formatNumber(weather.wind_speed_ms, 1)} m/s`}
                icon={<Wind className="size-3" aria-hidden="true" />}
              />
              <WeatherStat
                label="Humidity"
                value={`${formatNumber(weather.humidity_pct, 0)}%`}
                icon={<Droplets className="size-3" aria-hidden="true" />}
              />
            </div>

            {scenarioActive ? (
              <div className="rounded-lg border border-warn-100 bg-warn-50/70 px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-warn-700">
                  Scenario effective irradiance
                </p>
                <p className="num mt-0.5 text-sm font-semibold text-warn-700">{formatIrradiance(effective)}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-warn-700/80">
                  Synthetic {formatNumber(snapshot.state.cloud_scenario_pct, 0)}% cloud overlay applied to the provider
                  observation. This is not a provider value.
                </p>
              </div>
            ) : null}

            {weather.status === "stale" || weather.status === "expired" ? (
              <InlineAlert tone="warning">
                Latest provider data is <span className="font-medium">{FRESHNESS_LABEL[weather.status].toLowerCase()}</span>{" "}
                ({formatAge(weather.age_seconds)}). It is still a real observation, but not current.{" "}
                {weather.last_error ?? ""}
              </InlineAlert>
            ) : null}
          </>
        )}

        <div className="border-t border-line pt-3 text-[10px] leading-4 text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span>
              {weather?.provider ?? "open-meteo"} · {weather?.transport ?? "mcp-stdio"} · {weather?.mcp_server ?? "open-meteo-weather"}
            </span>
            <span>Retrieved {weather?.retrieved_at ? formatDateTime(weather.retrieved_at) : "never"}</span>
          </div>
          <p className="mt-1 text-slate-400">
            Provider-reported shortwave radiation, not an on-site pyranometer or smart-meter measurement.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
