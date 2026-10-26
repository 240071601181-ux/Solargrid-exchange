import { useQuery } from "@tanstack/react-query";
import { simulationApi } from "../api/simulationApi";
import { householdApi } from "../api/householdApi";
import { forecastApi } from "../api/forecastApi";
import { optimizationApi } from "../api/optimizationApi";
import { transactionApi, type TransactionFilters } from "../api/transactionApi";
import { evaluationApi } from "../api/evaluationApi";
import { settingsApi } from "../api/settingsApi";
import { metricsApi } from "../api/metricsApi";
import { sharedApi } from "../api/sharedApi";
import { sellerApi } from "../api/sellerApi";
import { buyerApi } from "../api/buyerApi";
import { marketApi, type MarketOfferFilters } from "../api/marketApi";
import { queryKeys } from "../api/queryKeys";

export function useSimulation(enabled = true) {
  return useQuery({
    queryKey: queryKeys.simulation,
    queryFn: () => simulationApi.state(),
    refetchInterval: 6_000,
    staleTime: 2_000,
    retry: 1,
    enabled,
  });
}

export function useSharedStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.sharedStatus,
    queryFn: () => sharedApi.status(),
    refetchInterval: 15_000,
    staleTime: 5_000,
    retry: 1,
    enabled,
  });
}

export function useHouseholds() {
  return useQuery({
    queryKey: queryKeys.households,
    queryFn: () => householdApi.list(),
    refetchInterval: 6_000,
    staleTime: 2_000,
  });
}

export function useHousehold(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.household(id ?? "unknown"),
    queryFn: () => householdApi.detail(id ?? ""),
    enabled: Boolean(id),
    staleTime: 5_000,
  });
}

export function useForecast(hours: number) {
  return useQuery({
    queryKey: queryKeys.forecast(hours),
    queryFn: () => forecastApi.get(hours),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useLatestOptimization() {
  return useQuery({
    queryKey: queryKeys.optimization,
    queryFn: () => optimizationApi.latest(),
    refetchInterval: 6_000,
    staleTime: 2_000,
  });
}

export function useOptimizationStats() {
  return useQuery({
    queryKey: queryKeys.optimizationStats,
    queryFn: () => optimizationApi.stats(),
    staleTime: 15_000,
  });
}

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: queryKeys.transactions(filters as unknown as Record<string, unknown>),
    queryFn: () => transactionApi.list(filters),
    staleTime: 3_000,
    placeholderData: (previous) => previous,
  });
}

export function useEvaluation() {
  return useQuery({
    queryKey: queryKeys.evaluation,
    queryFn: () => evaluationApi.latest(),
    staleTime: 60_000,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => settingsApi.get(),
    staleTime: 30_000,
  });
}

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => metricsApi.health(),
    refetchInterval: 30_000,
    retry: 1,
  });
}

export function useSellerDashboard(enabled = true) {
  return useQuery({
    queryKey: queryKeys.sellerDashboard,
    queryFn: () => sellerApi.dashboard(),
    refetchInterval: 20_000,
    staleTime: 5_000,
    retry: 1,
    enabled,
  });
}

export function useSellerProfile() {
  return useQuery({
    queryKey: queryKeys.sellerProfile,
    queryFn: () => sellerApi.profile(),
    staleTime: 30_000,
  });
}

export function useSellerSolar() {
  return useQuery({
    queryKey: queryKeys.sellerSolar,
    queryFn: () => sellerApi.solar(),
    refetchInterval: 30_000,
    staleTime: 10_000,
    retry: 1,
  });
}

export function useSellerForecast() {
  return useQuery({
    queryKey: queryKeys.sellerForecast,
    queryFn: () => sellerApi.forecast(),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useSellerOffers() {
  return useQuery({
    queryKey: queryKeys.sellerOffers,
    queryFn: () => sellerApi.offers(),
    refetchInterval: 10_000,
    staleTime: 3_000,
  });
}

export function useSellerAvailability(enabled = true) {
  return useQuery({
    queryKey: queryKeys.sellerAvailability,
    queryFn: () => sellerApi.availability(),
    refetchInterval: 60_000,
    staleTime: 20_000,
    retry: 1,
    enabled,
  });
}

export function useSellerSales() {
  return useQuery({
    queryKey: queryKeys.sellerSales,
    queryFn: () => sellerApi.sales(),
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
}

export function useSellerEarnings() {
  return useQuery({
    queryKey: queryKeys.sellerEarnings,
    queryFn: () => sellerApi.earnings(),
    refetchInterval: 20_000,
    staleTime: 5_000,
  });
}

export function useSellerMarketDemand() {
  return useQuery({
    queryKey: queryKeys.sellerMarketDemand,
    queryFn: () => sellerApi.marketDemand(),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useBuyerDashboard(enabled = true) {
  return useQuery({
    queryKey: queryKeys.buyerDashboard,
    queryFn: () => buyerApi.dashboard(),
    refetchInterval: 20_000,
    staleTime: 5_000,
    retry: 1,
    enabled,
  });
}

export function useBuyerProfile() {
  return useQuery({
    queryKey: queryKeys.buyerProfile,
    queryFn: () => buyerApi.profile(),
    staleTime: 30_000,
  });
}

export function useBuyerUsage() {
  return useQuery({
    queryKey: queryKeys.buyerUsage,
    queryFn: () => buyerApi.usage(),
    refetchInterval: 30_000,
    staleTime: 10_000,
    retry: 1,
  });
}

export function useBuyerPurchases() {
  return useQuery({
    queryKey: queryKeys.buyerPurchases,
    queryFn: () => buyerApi.purchases(),
    refetchInterval: 10_000,
    staleTime: 3_000,
  });
}

export function useBuyerSpending() {
  return useQuery({
    queryKey: queryKeys.buyerSpending,
    queryFn: () => buyerApi.spending(),
    refetchInterval: 20_000,
    staleTime: 5_000,
  });
}

export function useBuyerPrices() {
  return useQuery({
    queryKey: queryKeys.buyerPrices,
    queryFn: () => buyerApi.prices(),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useMarketOffers(filters: MarketOfferFilters = {}) {
  return useQuery({
    queryKey: queryKeys.marketOffers(filters as Record<string, unknown>),
    queryFn: () => marketApi.offers(filters),
    refetchInterval: 15_000,
    staleTime: 4_000,
  });
}
