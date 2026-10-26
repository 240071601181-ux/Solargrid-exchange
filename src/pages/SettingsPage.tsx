import { Check, CloudSun, Database, Info, LocateFixed, RotateCcw, Save, Server, Settings2, SlidersHorizontal, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { SettingsPage, SettingsPatch, SettingsValues } from "../types/api";
import { useSettings } from "../hooks/queries";
import { useSettingsAction } from "../hooks/useActions";
import { PageBody, PageHeader } from "../components/common/PageHeader";
import { Card, CardBody, CardHeader } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { Input, Toggle } from "../components/common/Field";
import { ErrorState, InlineAlert } from "../components/common/States";
import { ChartSkeleton } from "../components/common/Skeletons";
import { FreshnessBadge } from "../components/common/Freshness";
import { formatDateTime } from "../utils/format";
import { cn } from "../utils/cn";

function SettingsForm({ page }: { page: SettingsPage }) {
  const save = useSettingsAction();
  const [draft, setDraft] = useState<SettingsValues>(page.settings);
  const [validationError, setValidationError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(page.settings);

  const setField = <K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) => {
    setValidationError(null);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const validate = (): boolean => {
    if (!(draft.min_price_inr_kwh <= draft.base_price_inr_kwh && draft.base_price_inr_kwh <= draft.max_price_inr_kwh)) {
      setValidationError("Price order must satisfy minimum ≤ base ≤ maximum.");
      return false;
    }
    if (draft.max_price_inr_kwh <= draft.min_price_inr_kwh) {
      setValidationError("Maximum price must be greater than minimum price.");
      return false;
    }
    if (draft.tick_seconds < 1 || draft.tick_seconds > 60) {
      setValidationError("Auto-tick interval must be between 1 and 60 seconds.");
      return false;
    }
    if (draft.interval_seconds < 60 || draft.interval_seconds > 3600) {
      setValidationError("Simulated interval must be between 60 and 3600 seconds.");
      return false;
    }
    if (draft.forecast_horizon_hours < 4 || draft.forecast_horizon_hours > 72) {
      setValidationError("Forecast horizon must be between 4 and 72 hours.");
      return false;
    }
    if (draft.latitude < -90 || draft.latitude > 90 || draft.longitude < -180 || draft.longitude > 180) {
      setValidationError("Latitude must be within ±90 and longitude within ±180.");
      return false;
    }
    if (draft.location_name.trim().length < 2) {
      setValidationError("Location name must be at least 2 characters.");
      return false;
    }
    return true;
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;
    const patch: SettingsPatch = {
      base_price_inr_kwh: draft.base_price_inr_kwh,
      min_price_inr_kwh: draft.min_price_inr_kwh,
      max_price_inr_kwh: draft.max_price_inr_kwh,
      price_sensitivity: draft.price_sensitivity,
      price_smoothing: draft.price_smoothing,
      forecast_horizon_hours: draft.forecast_horizon_hours,
      tick_seconds: draft.tick_seconds,
      interval_seconds: draft.interval_seconds,
      auto_execute_trades: draft.auto_execute_trades,
      latitude: draft.latitude,
      longitude: draft.longitude,
      location_name: draft.location_name,
    };
    save.mutate(patch, {
      onSuccess: (saved) => setDraft(saved.settings),
    });
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-8">
        <Card>
          <CardHeader
            title="Pricing model"
            subtitle="All prices are INR per kWh. The backend bounds every computed interval price."
            icon={<SlidersHorizontal className="size-4" aria-hidden="true" />}
            action={<Badge tone="neutral">Bounded</Badge>}
          />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                label="Minimum price"
                type="number"
                min={0.1}
                max={50}
                step={0.1}
                value={draft.min_price_inr_kwh}
                onChange={(event) => setField("min_price_inr_kwh", Number(event.target.value))}
                hint="Hard floor"
              />
              <Input
                label="Base price"
                type="number"
                min={0.5}
                max={50}
                step={0.1}
                value={draft.base_price_inr_kwh}
                onChange={(event) => setField("base_price_inr_kwh", Number(event.target.value))}
                hint="Static tariff & seller reservation basis"
              />
              <Input
                label="Maximum price"
                type="number"
                min={0.1}
                max={100}
                step={0.1}
                value={draft.max_price_inr_kwh}
                onChange={(event) => setField("max_price_inr_kwh", Number(event.target.value))}
                hint="Hard cap"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Price sensitivity"
                type="number"
                min={0}
                max={20}
                step={0.1}
                value={draft.price_sensitivity}
                onChange={(event) => setField("price_sensitivity", Number(event.target.value))}
                hint="₹/kWh adjustment per unit of normalized imbalance"
              />
              <Input
                label="Price smoothing"
                type="number"
                min={0}
                max={0.95}
                step={0.05}
                value={draft.price_smoothing}
                onChange={(event) => setField("price_smoothing", Number(event.target.value))}
                hint="Weight on the previous price (0–0.95)"
              />
            </div>
            <div className="rounded-lg border border-line bg-slate-50/60 px-3 py-2.5 text-[10px] leading-4 text-slate-500">
              <Info className="mr-1 inline size-3" aria-hidden="true" />
              Dynamic price = clamp(previous × smoothing + (base + sensitivity × imbalance) × (1 − smoothing),
              minimum, maximum). Seller participation is price-sensitive; buyer demand is not.
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Simulation control"
            subtitle="Changes apply to future ticks; existing transactions are immutable records"
            icon={<Settings2 className="size-4" aria-hidden="true" />}
          />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                label="Auto-tick interval (s)"
                type="number"
                min={1}
                max={60}
                step={1}
                value={draft.tick_seconds}
                onChange={(event) => setField("tick_seconds", Number(event.target.value))}
                hint="Real seconds per tick"
              />
              <Input
                label="Simulated interval (s)"
                type="number"
                min={60}
                max={3600}
                step={60}
                value={draft.interval_seconds}
                onChange={(event) => setField("interval_seconds", Number(event.target.value))}
                hint="Energy interval represented by a tick"
              />
              <Input
                label="Forecast horizon (h)"
                type="number"
                min={4}
                max={72}
                step={1}
                value={draft.forecast_horizon_hours}
                onChange={(event) => setField("forecast_horizon_hours", Number(event.target.value))}
                hint="MCP forecast request horizon"
              />
            </div>
            <div className="rounded-lg border border-line px-3 py-3">
              <Toggle
                label="Auto-execute matched trades"
                description="When enabled, each tick immediately persists transactions for feasible allocation links. When disabled, allocations remain proposals until you execute them."
                checked={draft.auto_execute_trades}
                onChange={(checked) => setField("auto_execute_trades", checked)}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Weather location"
            subtitle="Coordinates are passed to the real MCP weather tools; no fallback coordinates are used"
            icon={<LocateFixed className="size-4" aria-hidden="true" />}
            action={<Badge tone="success">MCP</Badge>}
          />
          <CardBody className="space-y-4">
            <Input
              label="Location name"
              value={draft.location_name}
              onChange={(event) => setField("location_name", event.target.value)}
              maxLength={120}
              hint="Display label only; coordinates drive the provider request"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Latitude"
                type="number"
                min={-90}
                max={90}
                step={0.001}
                value={draft.latitude}
                onChange={(event) => setField("latitude", Number(event.target.value))}
                hint="Decimal degrees"
              />
              <Input
                label="Longitude"
                type="number"
                min={-180}
                max={180}
                step={0.001}
                value={draft.longitude}
                onChange={(event) => setField("longitude", Number(event.target.value))}
                hint="Decimal degrees"
              />
            </div>
            <p className="text-[10px] leading-4 text-slate-500">
              Changing the location triggers a forced MCP weather refresh. If the provider is unavailable, the save still
              succeeds and the failure is shown in weather status. No synthetic weather is substituted.
            </p>
          </CardBody>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-sm">
          <div className="text-[11px] text-slate-500">
            {dirty ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-warn-700">
                <span className="size-1.5 rounded-full bg-warn-500" />
                Unsaved changes
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <Check className="size-3.5 text-energy-500" />
                All changes saved
              </span>
            )}
            <span className="ml-2 text-slate-400">Last saved {formatDateTime(page.settings.updated_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!dirty || save.isPending}
              onClick={() => {
                setDraft(page.settings);
                setValidationError(null);
              }}
              icon={<RotateCcw className="size-3.5" />}
            >
              Discard
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="primary"
              loading={save.isPending}
              disabled={!dirty}
              icon={<Save className="size-3.5" />}
            >
              Save settings
            </Button>
          </div>
        </div>

        {validationError ? (
          <InlineAlert tone="danger">
            <span className="font-medium">Check the form:</span> {validationError}
          </InlineAlert>
        ) : null}
        {save.error ? (
          <InlineAlert tone="danger">
            <span className="font-medium">Could not save settings:</span>{" "}
            {save.error instanceof Error ? save.error.message : String(save.error)}
          </InlineAlert>
        ) : null}
        {save.isSuccess && !dirty ? (
          <InlineAlert tone="info">
            Settings saved. New prices and simulation controls apply from the next tick.
          </InlineAlert>
        ) : null}
      </div>

      <div className="space-y-4 xl:col-span-4">
        <Card>
          <CardHeader
            title="Weather provider"
            subtitle="Real external data via MCP stdio"
            icon={<CloudSun className="size-4" aria-hidden="true" />}
          />
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Status</span>
              <FreshnessBadge status={page.weather.status} ageSeconds={page.weather.age_seconds} />
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Server</span>
                <span className="num text-right font-medium text-slate-700">{page.weather.mcp_server}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Transport</span>
                <span className="font-medium text-slate-700">{page.weather.transport}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Enabled</span>
                <span className="font-medium text-slate-700">{page.weather.enabled ? "yes" : "no"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Cache TTL</span>
                <span className="num font-medium text-slate-700">{page.weather.cache_ttl_seconds}s</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Last retrieved</span>
                <span className="num text-right font-medium text-slate-700">{formatDateTime(page.weather.last_retrieved_at)}</span>
              </div>
            </div>
            {page.weather.last_error ? (
              <InlineAlert tone="warning">
                <span className="font-medium">Last provider error:</span> {page.weather.last_error}
              </InlineAlert>
            ) : null}
            <p className="text-[10px] leading-4 text-slate-400">
              Open-Meteo data is retrieved by a local MCP server process using the MCP SDK. The backend does not call a
              weather HTTP API directly.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Data provenance"
            subtitle="What is real, estimated or simulated"
            icon={<Database className="size-4" aria-hidden="true" />}
          />
          <CardBody className="space-y-2.5">
            {page.data_sources.map((source) => (
              <div key={source.name} className="rounded-lg border border-line px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-semibold text-slate-700">{source.name}</p>
                  <Badge
                    tone={
                      source.kind === "external" ? "success" : source.kind === "simulated" ? "info" : "warning"
                    }
                  >
                    {source.kind}
                  </Badge>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">{source.identity}</p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {source.provider} · {source.status}
                </p>
                {source.error ? <p className="mt-1 text-[10px] text-critical-600">{source.error}</p> : null}
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Backend runtime"
            subtitle="Active configuration reported by the API"
            icon={<Server className="size-4" aria-hidden="true" />}
          />
          <CardBody className="space-y-1.5">
            {Object.entries(page.backend).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3 border-b border-line py-1.5 text-[11px] last:border-b-0">
                <span className="shrink-0 capitalize text-slate-500">{key.replaceAll("_", " ")}</span>
                <span className="num break-all text-right font-medium text-slate-700">{value}</span>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Deliberately unsupported" subtitle="Boundaries of this build" />
          <CardBody className="space-y-2">
            {Object.entries(page.supported)
              .filter(([, supported]) => !supported)
              .map(([key]) => (
                <div key={key} className="flex items-center gap-2 text-[11px] text-slate-500">
                  <X className="size-3.5 text-slate-400" aria-hidden="true" />
                  <span className="capitalize">{key.replaceAll("_", " ")}</span>
                </div>
              ))}
            <p className={cn("mt-1 rounded-lg border border-line bg-slate-50/60 px-3 py-2 text-[10px] leading-4 text-slate-500")}>
              This is a simulation and control-center demo. It does not connect to meters, execute payments, use a
              blockchain, or guarantee real-world energy delivery.
            </p>
          </CardBody>
        </Card>
      </div>
    </form>
  );
}

export function SettingsPage() {
  const settings = useSettings();

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Tune the pricing and simulation model, set the real-weather coordinates and inspect data provenance. Configuration is stored in SQLite and applied by the backend."
        meta={
          settings.data ? (
            <>
              <Badge tone="neutral">Environment {settings.data.backend.environment}</Badge>
              <Badge tone="success">MCP weather {settings.data.weather.status}</Badge>
              <Badge tone="neutral">{settings.data.backend.api_prefix}</Badge>
            </>
          ) : null
        }
      />
      <PageBody>
        {settings.isPending ? (
          <div className="card p-5">
            <ChartSkeleton height={380} />
          </div>
        ) : settings.isError ? (
          <ErrorState error={settings.error} title="Could not load settings" onRetry={() => void settings.refetch()} />
        ) : (
          <SettingsForm page={settings.data} />
        )}
      </PageBody>
    </>
  );
}
