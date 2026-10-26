import { ChevronDown, CloudSun, LogOut, Menu, RefreshCw, Settings, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router";
import { useEffect, useRef, useState } from "react";
import { useSharedStatus } from "../../hooks/queries";
import { metaForPath, navGroupsForRole, roleLabel } from "./nav";
import { MobileSidebar } from "./Sidebar";
import { ConnectionPill } from "../common/ConnectionPill";
import { Badge } from "../common/Badge";
import { formatNumber, formatTime } from "../../utils/format";
import { cn } from "../../utils/cn";
import { homeForRole, useAuth } from "../../context/AuthProvider";

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

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const settingsPath =
    user.role === "seller" ? "/seller/settings" : user.role === "buyer" ? "/buyer/settings" : "/settings";

  const signOut = async () => {
    setBusy(true);
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="focus-ring flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1 pl-1 pr-2 text-slate-600 hover:bg-slate-50"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <span className="flex size-6.5 items-center justify-center rounded-md bg-ink-900 text-[10px] font-semibold uppercase text-white">
          {user.full_name.slice(0, 2)}
        </span>
        <span className="hidden max-w-28 truncate text-[11.5px] font-medium text-ink-900 sm:block">{user.full_name}</span>
        <ChevronDown className={cn("size-3.5 text-slate-400 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          className="animate-rise absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-xl border border-line bg-white shadow-raised"
        >
          <div className="border-b border-line px-3.5 py-3">
            <p className="truncate text-xs font-semibold text-ink-900">{user.full_name}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{user.email}</p>
            <Badge tone="navy" className="mt-2 capitalize">
              {user.role} account
            </Badge>
          </div>
          <div className="p-1.5">
            <Link
              to={settingsPath}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="focus-ring flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-ink-900"
            >
              <Settings className="size-3.5 text-slate-400" aria-hidden="true" />
              Profile & settings
            </Link>
            <Link
              to={homeForRole(user.role)}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="focus-ring flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-ink-900"
            >
              <UserRound className="size-3.5 text-slate-400" aria-hidden="true" />
              My workspace
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => void signOut()}
              disabled={busy}
              className="focus-ring flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-critical-600 hover:bg-critical-50 disabled:opacity-50"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              {busy ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Topbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const role = user?.role ?? "admin";
  const { data, isPending, isFetching, refetch } = useSharedStatus();
  const state = data?.state;
  const weather = data?.weather;
  const simulationStatus = state?.status ?? "idle";
  const meta = metaForPath(location.pathname);
  const title = meta?.title ?? "SolarGrid workspace";

  const refresh = () => {
    void queryClient.invalidateQueries();
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
          <p className="truncate text-[13px] font-semibold text-ink-900">{title}</p>
          <p className="hidden truncate text-[11px] text-slate-500 sm:block">
            {user
              ? `${roleLabel(user.role)} · ${user.email}`
              : "Perur, Coimbatore · simulated microgrid · real weather through MCP"}
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

          <span className="hidden sm:inline-flex">
            <Badge tone={STATUS_TONE[simulationStatus]} dot>
              {STATUS_LABEL[simulationStatus]}
              {state && state.tick > 0 ? <span className="num opacity-75">· t{state.tick}</span> : null}
            </Badge>
          </span>

          <span className="hidden items-center gap-1 text-[11px] text-slate-500 xl:flex" title="Simulated clock (IST)">
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
            title="Refresh current page data"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} aria-hidden="true" />
          </button>

          <UserMenu />
        </div>
      </header>
      <MobileSidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        groups={navGroupsForRole(role)}
        role={role}
      />
    </>
  );
}
