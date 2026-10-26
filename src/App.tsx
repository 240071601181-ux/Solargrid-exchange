import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router";
import { AppShell } from "./components/layout/AppShell";
import { SimulationSocketProvider } from "./context/SimulationSocketProvider";
import { AuthProvider } from "./context/AuthProvider";
import { PageBody, PageHeader } from "./components/common/PageHeader";
import { EmptyState } from "./components/common/States";
import { RequireAuth, RequireGuest, RequireRole } from "./components/auth/RouteGuards";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { OverviewPage } from "./pages/OverviewPage";
import { MicrogridPage } from "./pages/MicrogridPage";
import { MarketplacePage } from "./pages/MarketplacePage";
import { ForecastingPage } from "./pages/ForecastingPage";
import { OptimizationPage } from "./pages/OptimizationPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { EvaluationPage } from "./pages/EvaluationPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SellerDashboardPage } from "./pages/seller/SellerDashboardPage";
import { SellerSolarPage } from "./pages/seller/SellerSolarPage";
import { SellerOffersPage } from "./pages/seller/SellerOffersPage";
import { SellerMarketplacePage } from "./pages/seller/SellerMarketplacePage";
import { SellerSalesPage } from "./pages/seller/SellerSalesPage";
import { SellerEarningsPage } from "./pages/seller/SellerEarningsPage";
import { SellerForecastingPage } from "./pages/seller/SellerForecastingPage";
import { SellerSettingsPage } from "./pages/seller/SellerSettingsPage";
import { BuyerDashboardPage } from "./pages/buyer/BuyerDashboardPage";
import { BuyerMarketplacePage } from "./pages/buyer/BuyerMarketplacePage";
import { BuyerPurchasesPage } from "./pages/buyer/BuyerPurchasesPage";
import { BuyerUsagePage } from "./pages/buyer/BuyerUsagePage";
import { BuyerPricesPage } from "./pages/buyer/BuyerPricesPage";
import { BuyerSettingsPage } from "./pages/buyer/BuyerSettingsPage";

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
      <PageHeader eyebrow="404" title="Page not found" description="This workspace route does not exist." />
      <PageBody>
        <EmptyState
          title="Nothing to show here"
          description="Return to your workspace. The backend and simulation state are unaffected."
          action={
            <Link
              to="/login"
              className="focus-ring inline-flex h-8 items-center rounded-lg border border-ink-900 bg-ink-900 px-3 text-xs font-medium text-white hover:bg-ink-800"
            >
              Go to sign in
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
      <AuthProvider>
        <SimulationSocketProvider>
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              <Route
                path="/login"
                element={
                  <RequireGuest>
                    <LoginPage />
                  </RequireGuest>
                }
              />
              <Route
                path="/register"
                element={
                  <RequireGuest>
                    <RegisterPage />
                  </RequireGuest>
                }
              />

              <Route element={<RequireAuth />}>
                <Route element={<RequireRole role="admin" />}>
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
                </Route>

                <Route element={<RequireRole role="seller" />}>
                  <Route path="/seller" element={<AppShell />}>
                    <Route index element={<SellerDashboardPage />} />
                    <Route path="solar" element={<SellerSolarPage />} />
                    <Route path="offers" element={<SellerOffersPage />} />
                    <Route path="marketplace" element={<SellerMarketplacePage />} />
                    <Route path="sales" element={<SellerSalesPage />} />
                    <Route path="earnings" element={<SellerEarningsPage />} />
                    <Route path="forecasting" element={<SellerForecastingPage />} />
                    <Route path="settings" element={<SellerSettingsPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Route>

                <Route element={<RequireRole role="buyer" />}>
                  <Route path="/buyer" element={<AppShell />}>
                    <Route index element={<BuyerDashboardPage />} />
                    <Route path="marketplace" element={<BuyerMarketplacePage />} />
                    <Route path="purchases" element={<BuyerPurchasesPage />} />
                    <Route path="usage" element={<BuyerUsagePage />} />
                    <Route path="prices" element={<BuyerPricesPage />} />
                    <Route path="settings" element={<BuyerSettingsPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </SimulationSocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
