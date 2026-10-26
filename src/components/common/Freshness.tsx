import { CloudSun, Clock3 } from "lucide-react";
import type { WeatherFreshness } from "../../types/api";
import { formatAge, formatDateTime } from "../../utils/format";
import { Badge, type Tone } from "./Badge";

export const FRESHNESS_TONE: Record<WeatherFreshness, Tone> = {
  live: "success",
  stale: "warning",
  expired: "danger",
  unavailable: "danger",
};

export const FRESHNESS_LABEL: Record<WeatherFreshness, string> = {
  live: "Live",
  stale: "Stale",
  expired: "Expired",
  unavailable: "Unavailable",
};

export function FreshnessBadge({ status, ageSeconds }: { status: WeatherFreshness; ageSeconds: number | null }) {
  return (
    <Badge tone={FRESHNESS_TONE[status]} dot>
      {FRESHNESS_LABEL[status]} · {formatAge(ageSeconds)}
    </Badge>
  );
}

export function DataSourceLine({
  provider,
  transport,
  retrievedAt,
  status,
  ageSeconds,
}: {
  provider: string;
  transport: string;
  retrievedAt: string | null;
  status: WeatherFreshness;
  ageSeconds: number | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
      <span className="inline-flex items-center gap-1.5">
        <CloudSun className="size-3.5 text-slate-400" aria-hidden="true" />
        {provider} via {transport.toUpperCase()}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Clock3 className="size-3.5 text-slate-400" aria-hidden="true" />
        {retrievedAt ? formatDateTime(retrievedAt) : "Never retrieved"}
      </span>
      <FreshnessBadge status={status} ageSeconds={ageSeconds} />
    </div>
  );
}
