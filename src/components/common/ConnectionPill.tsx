import { LoaderCircle, Wifi, WifiOff } from "lucide-react";
import { useSimulationSocket } from "../../hooks/useSimulationSocket";
import { cn } from "../../utils/cn";
import { formatTime } from "../../utils/format";

const LABELS = {
  connected: "Realtime connected",
  connecting: "Connecting",
  reconnecting: "Reconnecting",
  offline: "Realtime offline",
  disabled: "Realtime disabled",
} as const;

const TONES = {
  connected: "border-energy-100 bg-energy-50 text-energy-700",
  connecting: "border-info-100 bg-info-50 text-info-600",
  reconnecting: "border-warn-100 bg-warn-50 text-warn-700",
  offline: "border-critical-100 bg-critical-50 text-critical-600",
  disabled: "border-slate-200 bg-slate-50 text-slate-500",
} as const;

export function ConnectionPill({ compact = false }: { compact?: boolean }) {
  const { status, lastEventAt, reconnectAttempt, reconnect, lastError } = useSimulationSocket();
  const canRetry = status === "offline" || status === "reconnecting";

  return (
    <button
      type="button"
      onClick={canRetry ? reconnect : undefined}
      disabled={!canRetry}
      title={lastError ?? (lastEventAt ? `Last event ${formatTime(lastEventAt)} IST` : LABELS[status])}
      className={cn(
        "focus-ring inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium",
        TONES[status],
        canRetry ? "cursor-pointer hover:brightness-[0.98]" : "cursor-default",
      )}
    >
      {status === "connected" ? (
        <Wifi className="size-3.5" aria-hidden="true" />
      ) : status === "connecting" || status === "reconnecting" ? (
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <WifiOff className="size-3.5" aria-hidden="true" />
      )}
      <span>{compact ? (status === "connected" ? "Live" : LABELS[status].replace("Realtime ", "")) : LABELS[status]}</span>
      {status === "reconnecting" && reconnectAttempt > 0 ? (
        <span className="num opacity-70">#{reconnectAttempt}</span>
      ) : null}
    </button>
  );
}
