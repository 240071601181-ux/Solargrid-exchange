import { SunMedium, X } from "lucide-react";
import { NavLink } from "react-router";
import { NAV_GROUPS } from "./nav";
import { useSimulation } from "../../hooks/queries";
import { useSimulationSocket } from "../../hooks/useSimulationSocket";
import { cn } from "../../utils/cn";
import { ConnectionPill } from "../common/ConnectionPill";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { data } = useSimulation();
  const { status } = useSimulationSocket();
  const weather = data?.weather;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-energy-500/15 ring-1 ring-inset ring-energy-500/30">
          <SunMedium className="size-4.5 text-energy-500" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-white">SolarGrid Exchange</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
            P2P microgrid control
          </p>
        </div>
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 pb-4 pt-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex h-8.5 items-center gap-2.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors",
                        isActive
                          ? "bg-white/[0.07] text-white"
                          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={cn(
                            "absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-energy-500 transition-opacity",
                            isActive ? "opacity-100" : "opacity-0",
                          )}
                          aria-hidden="true"
                        />
                        <item.icon
                          className={cn("size-4 shrink-0", isActive ? "text-energy-500" : "text-slate-500")}
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.07] px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Data link</p>
          <ConnectionPill compact />
        </div>
        <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-400">
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              weather?.status === "live"
                ? "bg-energy-500"
                : weather?.status === "stale"
                  ? "bg-warn-500"
                  : "bg-slate-500",
            )}
            aria-hidden="true"
          />
          <span className="truncate">
            {weather ? `${weather.provider} · ${weather.transport}` : "Weather not retrieved"}
          </span>
        </div>
        <p className="mt-1.5 text-[10px] leading-4 text-slate-500">
          Household demand and trades are simulated. Weather is provider data via MCP.
        </p>
        <p className="mt-2 text-[10px] text-slate-600">
          Socket: {status === "connected" ? "streaming" : status}
        </p>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-ink-700/60 bg-ink-900 lg:block">
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-ink-950/50"
        onClick={onClose}
        aria-label="Close navigation"
      />
      <div className="animate-rise relative h-full w-72 max-w-[85vw] bg-ink-900 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="focus-ring absolute right-3 top-4 rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Close navigation"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
        <SidebarContent onNavigate={onClose} />
      </div>
    </div>
  );
}
