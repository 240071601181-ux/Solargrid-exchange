import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { navGroupsForRole } from "./nav";
import { useAuth } from "../../context/AuthProvider";

export function AppShell() {
  const { user } = useAuth();
  const role = user?.role ?? "admin";
  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-white px-3 py-2 text-sm font-medium text-ink-900 shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <Sidebar groups={navGroupsForRole(role)} role={role} />
      <div className="lg:pl-60">
        <Topbar />
        <main id="main-content" className="mx-auto w-full max-w-[1560px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <Outlet />
        </main>
        <footer className="mx-auto w-full max-w-[1560px] px-4 pb-6 text-[10px] leading-5 text-slate-400 sm:px-6 lg:px-8">
          SolarGrid Exchange · generation, household demand, offers, purchases and earnings are simulated. Weather
          observations and forecasts are retrieved from Open-Meteo through an MCP stdio server. No financial settlement
          occurs.
        </footer>
      </div>
    </div>
  );
}
