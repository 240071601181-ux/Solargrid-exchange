import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { useState } from "react";
import type { SimulationSnapshot } from "../../types/api";
import { useSimulationActions } from "../../hooks/useActions";
import { formatNumber, formatTime } from "../../utils/format";
import { Button } from "../common/Button";
import { InlineAlert } from "../common/States";
import { cn } from "../../utils/cn";

export function SimulationControls({
  snapshot,
  compact = false,
}: {
  snapshot: SimulationSnapshot;
  compact?: boolean;
}) {
  const { start, pause, step, reset } = useSimulationActions();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const running = snapshot.state.status === "running";
  const busy = start.isPending || pause.isPending || step.isPending || reset.isPending;
  const error = start.error ?? pause.error ?? step.error ?? reset.error;

  return (
    <div className={cn("space-y-3", compact && "space-y-2.5")}>
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <Button
            variant="secondary"
            size="sm"
            loading={pause.isPending}
            onClick={() => pause.mutate()}
            icon={<Pause className="size-3.5" />}
          >
            Pause
          </Button>
        ) : (
          <Button
            variant="success"
            size="sm"
            loading={start.isPending}
            onClick={() => start.mutate()}
            icon={<Play className="size-3.5" />}
          >
            Start simulation
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          loading={step.isPending}
          disabled={running || busy}
          onClick={() => step.mutate()}
          icon={<SkipForward className="size-3.5" />}
          title={running ? "Pause the simulation before advancing a single step" : "Advance one tick"}
        >
          Step
        </Button>

        {confirmingReset ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-critical-100 bg-critical-50 px-2 py-1">
            <span className="text-[11px] font-medium text-critical-700">Clear ticks and transactions?</span>
            <Button
              variant="danger"
              size="sm"
              loading={reset.isPending}
              onClick={() => {
                reset.mutate();
                setConfirmingReset(false);
              }}
            >
              Reset
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingReset(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setConfirmingReset(true)}
            icon={<RotateCcw className="size-3.5" />}
          >
            Reset
          </Button>
        )}

        <span className="ml-auto text-[10px] text-slate-500">
          {snapshot.state.interval_seconds / 60} simulated min / tick · auto every {formatNumber(snapshot.state.tick_seconds, 0)}s
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span>
          Status <span className="font-medium capitalize text-slate-700">{snapshot.state.status}</span>
        </span>
        <span>
          Tick <span className="num font-medium text-slate-700">{snapshot.state.tick}</span>
        </span>
        <span>
          Simulated clock <span className="num font-medium text-slate-700">{formatTime(snapshot.state.simulated_at)} IST</span>
        </span>
        <span>
          Auto-execute <span className="font-medium text-slate-700">{snapshot.state.auto_execute_trades ? "on" : "off"}</span>
        </span>
      </div>

      {snapshot.state.last_error ? (
        <InlineAlert tone="danger">
          <span className="font-medium">Simulation error:</span> {snapshot.state.last_error}
        </InlineAlert>
      ) : null}
      {error ? (
        <InlineAlert tone="danger">
          <span className="font-medium">Action failed:</span> {error instanceof Error ? error.message : String(error)}
        </InlineAlert>
      ) : null}
    </div>
  );
}
