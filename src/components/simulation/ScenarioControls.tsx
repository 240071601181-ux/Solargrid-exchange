import { CloudRain, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { SimulationSnapshot } from "../../types/api";
import { useSimulationActions } from "../../hooks/useActions";
import { formatAge, formatIrradiance, formatNumber } from "../../utils/format";
import { Button } from "../common/Button";
import { InlineAlert } from "../common/States";

const PRESETS = [
  { label: "Live weather", value: 0 },
  { label: "50% cloud", value: 50 },
  { label: "75% cloud", value: 75 },
  { label: "90% cloud", value: 90 },
];

export function ScenarioControls({ snapshot }: { snapshot: SimulationSnapshot }) {
  const { scenario } = useSimulationActions();
  const [cloud, setCloud] = useState(snapshot.state.cloud_scenario_pct);
  const dirty = cloud !== snapshot.state.cloud_scenario_pct;

  const apply = (value: number) => {
    scenario.mutate({ cloudCoverPct: value, advance: true });
  };

  const providerIrradiance = snapshot.weather?.irradiance_w_m2 ?? null;
  const effective = snapshot.totals.effective_irradiance_w_m2;
  const running = snapshot.state.status === "running";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => {
              setCloud(preset.value);
            }}
            className={
              cloud === preset.value
                ? "focus-ring rounded-md border border-ink-900 bg-ink-900 px-2.5 py-1 text-[11px] font-medium text-white"
                : "focus-ring rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
            }
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <label htmlFor="cloud-scenario" className="font-medium text-slate-700">
            Cloud-cover overlay
          </label>
          <span className="num font-semibold text-ink-900">{formatNumber(cloud, 0)}%</span>
        </div>
        <input
          id="cloud-scenario"
          type="range"
          min={0}
          max={90}
          step={5}
          value={cloud}
          onChange={(event) => {
            setCloud(Number(event.target.value));
          }}
          className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-energy-600"
        />
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>0% · no overlay</span>
          <span>90% · heavy attenuation</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-slate-50/60 px-3 py-2.5 text-[11px]">
        <div>
          <p className="text-slate-500">Provider irradiance</p>
          <p className="num mt-0.5 font-semibold text-slate-700">{formatIrradiance(providerIrradiance)}</p>
        </div>
        <div>
          <p className="text-slate-500">Effective (scenario)</p>
          <p className="num mt-0.5 font-semibold text-slate-700">{formatIrradiance(effective)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-[15rem] text-[10px] leading-4 text-slate-500">
          {running
            ? "The overlay is applied on the next auto tick."
            : "Applying the overlay runs one tick now with the scenario active."}{" "}
          Weather age: {formatAge(snapshot.weather?.age_seconds ?? null)}.
        </p>
        <div className="flex items-center gap-1.5">
          {snapshot.state.cloud_scenario_pct > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              loading={scenario.isPending}
              onClick={() => apply(0)}
              icon={<RotateCcw className="size-3.5" />}
            >
              Live
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="primary"
            loading={scenario.isPending}
            disabled={!dirty}
            onClick={() => apply(cloud)}
            icon={<CloudRain className="size-3.5" />}
          >
            Apply overlay
          </Button>
        </div>
      </div>

      {scenario.error ? (
        <InlineAlert tone="danger">
          <span className="font-medium">Scenario failed:</span>{" "}
          {scenario.error instanceof Error ? scenario.error.message : String(scenario.error)}
        </InlineAlert>
      ) : null}
    </div>
  );
}
