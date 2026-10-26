import { CloudSun, SunMedium } from "lucide-react";
import { PageBody, PageHeader } from "../../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/common/Card";
import { Badge } from "../../components/common/Badge";
import { ErrorState } from "../../components/common/States";
import { ChartSkeleton, MetricSkeleton } from "../../components/common/Skeletons";
import { AccountEnergyPanel, AccountEnergyStats } from "../../components/account/AccountEnergy";
import { useSellerForecast } from "../../hooks/queries";
import { formatDateTime, formatNumber, formatTime } from "../../utils/format";

export function SellerForecastingPage() {
  const forecast = useSellerForecast();
  const energy = forecast.data;

  if (forecast.isPending) {
    return (
      <PageBody>
        <PageHeader eyebrow="Seller workspace" title="Forecasting" description="Retrieving the latest MCP weather forecast." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <MetricSkeleton key={index} />)}
        </div>
        <Card><CardBody><ChartSkeleton /></CardBody></Card>
      </PageBody>
    );
  }
  if (forecast.isError || !energy) {
    return (
      <PageBody>
        <PageHeader eyebrow="Seller workspace" title="Forecasting" />
        <ErrorState error={forecast.error} title="Forecast could not be loaded" onRetry={() => void forecast.refetch()} />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        eyebrow="Seller workspace"
        title="Forecasting"
        description="Your rooftop generation and simulated demand, driven by the real Open-Meteo forecast retrieved through MCP."
        meta={
          <>
            <Badge tone={energy.forecast.freshness === "live" ? "success" : "warning"} dot>
              {energy.forecast.freshness.replaceAll("_", " ")}
            </Badge>
            <Badge tone="neutral">{energy.forecast.horizon_hours}h horizon</Badge>
            <Badge tone="neutral">{energy.forecast.mcp_server}</Badge>
          </>
        }
      />
      <AccountEnergyStats energy={energy} />
      <AccountEnergyPanel energy={energy} />

      <Card>
        <CardHeader
          title="Forecast detail"
          subtitle={`Generated ${formatDateTime(energy.forecast.generated_at)} · ${energy.forecast.provider}`}
          icon={<CloudSun className="size-4" aria-hidden="true" />}
        />
        <CardBody className="overflow-x-auto pt-2">
          <table className="w-full min-w-[720px] text-left text-[11.5px]">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-[0.08em] text-slate-400">
                <th className="py-2 pr-3 font-medium">Time (IST)</th>
                <th className="px-3 py-2 font-medium">Irradiance</th>
                <th className="px-3 py-2 font-medium">Cloud</th>
                <th className="px-3 py-2 font-medium">Temperature</th>
                <th className="px-3 py-2 font-medium">Generation</th>
                <th className="px-3 py-2 font-medium">Demand</th>
                <th className="py-2 pl-3 text-right font-medium">Imbalance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/80">
              {energy.forecast.series.map((point) => (
                <tr key={point.timestamp} className="text-slate-600">
                  <td className="py-2 pr-3 text-slate-500">{formatTime(point.timestamp)}</td>
                  <td className="num px-3 py-2">{formatNumber(point.irradiance_w_m2, 0)} W/m²</td>
                  <td className="num px-3 py-2">{formatNumber(point.cloud_cover_pct, 0)}%</td>
                  <td className="num px-3 py-2">{formatNumber(point.temperature_c, 1)}°C</td>
                  <td className="num px-3 py-2">{formatNumber(point.generation_kw, 2)} kW</td>
                  <td className="num px-3 py-2">{formatNumber(point.demand_kw, 2)} kW</td>
                  <td className={`num py-2 pl-3 text-right font-medium ${point.imbalance_kw >= 0 ? "text-energy-700" : "text-warn-700"}`}>
                    {point.imbalance_kw >= 0 ? "+" : ""}{formatNumber(point.imbalance_kw, 2)} kW
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-line bg-white px-4 py-3 text-[11px] leading-5 text-slate-500">
        <SunMedium className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <p>
          Irradiance and cloud values are real provider forecast data. Household demand uses a deterministic shape with
          the account's baseline. Forecast uncertainty is not modelled as a probability distribution.
        </p>
      </div>
    </PageBody>
  );
}
