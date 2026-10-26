import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router";
import { AppShell } from "./components/layout/AppShell";
import { SimulationSocketProvider } from "./context/SimulationSocketProvider";
import { PageBody, PageHeader } from "./components/common/PageHeader";
import { EmptyState } from "./components/common/States";
import { OverviewPage } from "./pages/OverviewPage";
import { MicrogridPage } from "./pages/MicrogridPage";
import { MarketplacePage } from "./pages/MarketplacePage";
import { ForecastingPage } from "./pages/ForecastingPage";
import { OptimizationPage } from "./pages/OptimizationPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { EvaluationPage } from "./pages/EvaluationPage";
import { SettingsPage } from "./pages/SettingsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 2_000,
    },
    mutations: {
      retry: 0,
    },
  },
});

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function NotFoundPage() {
  return (
    <>
      <PageHeader eyebrow="404" title="Page not found" description="This control-center route does not exist." />
      <PageBody>
        <EmptyState
          title="Nothing to show here"
          description="Return to the microgrid overview. The backend and simulation state are unaffected."
          action={
            <Link
              to="/"
              className="focus-ring inline-flex h-8 items-center rounded-lg border border-ink-900 bg-ink-900 px-3 text-xs font-medium text-white hover:bg-ink-800"
            >
              Back to overview
            </Link>
          }
        />
      </PageBody>
    </>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SimulationSocketProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<OverviewPage />} />
              <Route path="/microgrid" element={<MicrogridPage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/forecasting" element={<ForecastingPage />} />
              <Route path="/optimization" element={<OptimizationPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/evaluation" element={<EvaluationPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SimulationSocketProvider>
    </QueryClientProvider>
  );
}
