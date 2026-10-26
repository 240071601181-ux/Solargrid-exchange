import { CloudSun, Menu, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router";
import { useState } from "react";
import { useSimulation } from "../../hooks/queries";
import { PAGE_META } from "./nav";
import { MobileSidebar } from "./Sidebar";
import { ConnectionPill } from "../common/ConnectionPill";
import { Badge } from "../common/Badge";
import { formatNumber, formatTime } from "../../utils/format";
import { cn } from "../../utils/cn";
import { queryKeys } from "../../api/queryKeys";

const STATUS_TONE = {
  running: "success",
  paused: "warning",
  idle: "neutral",
  error: "danger",
} as const;

const STATUS_LABEL = {
  running: "Running",
  paused: "Paused",
  idle: "Idle",
  error: "Error",
} as const;

function currentTitle(pathname: string): string {
  if (pathname.startsWith("/households/")) return "Household detail";
  if (pathname.startsWith("/households")) return "Households";
  const match = PAGE_META.find((item) => (item.path === "/" ? pathname === "/" : pathname.startsWith(item.path)));
  return match?.title ?? "Solar microgrid";
}

export function Topbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data, isPending, isFetching, refetch } = useSimulation();
  const state = data?.state;
  const weather = data?.weather;
  const simulationStatus = state?.status ?? "idle";

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.simulation });
    void queryClient.invalidateQueries({ queryKey: queryKeys.households });
    void refetch();
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="focus-ring -ml-1 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink-900">{currentTitle(location.pathname)}</p>
          <p className="hidden truncate text-[11px] text-slate-500 sm:block">
            Perur, Coimbatore · simulated microgrid · real weather through MCP
          </p>
        </div>

        <div className="flex items-center gap-2">
          {weather ? (
            <div
              className="hidden items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 md:flex"
              title={`${weather.provider} · observed ${formatTime(weather.observed_at)} IST`}
            >
              <CloudSun className="size-3.5 text-slate-400" aria-hidden="true" />
              <span className="num">{formatNumber(weather.temperature_c, 1)}°C</span>
              <span className="text-slate-300">|</span>
              <span className="num">{formatNumber(weather.cloud_cover_pct, 0)}% cloud</span>
            </div>
          ) : isPending ? (
            <Badge tone="neutral" dot className="hidden md:inline-flex">
              Loading weather
            </Badge>
          ) : (
            <Badge tone="danger" dot className="hidden md:inline-flex">
              Weather unavailable
            </Badge>
          )}

          <Badge tone={STATUS_TONE[simulationStatus]} dot>
            {STATUS_LABEL[simulationStatus]}
            {state && state.tick > 0 ? <span className="num opacity-75">· t{state.tick}</span> : null}
          </Badge>

          <span className="hidden items-center gap-1 text-[11px] text-slate-500 sm:flex" title="Simulated clock (IST)">
            <span className="num">{formatTime(state?.simulated_at ?? null)}</span>
            <span>IST</span>
          </span>

          <ConnectionPill compact />

          <button
            type="button"
            onClick={refresh}
            disabled={isFetching}
            className={cn(
              "focus-ring rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50",
            )}
            aria-label="Refresh data"
            title="Refresh REST snapshot"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} aria-hidden="true" />
          </button>
        </div>
      </header>
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
