import { useQuery } from "@tanstack/react-query";
import { simulationApi } from "../api/simulationApi";
import { householdApi } from "../api/householdApi";
import { forecastApi } from "../api/forecastApi";
import { optimizationApi } from "../api/optimizationApi";
import { transactionApi, type TransactionFilters } from "../api/transactionApi";
import { evaluationApi } from "../api/evaluationApi";
import { settingsApi } from "../api/settingsApi";
import { metricsApi } from "../api/metricsApi";
import { queryKeys } from "../api/queryKeys";

export function useSimulation() {
  return useQuery({
    queryKey: queryKeys.simulation,
    queryFn: () => simulationApi.state(),
    refetchInterval: 6_000,
    staleTime: 2_000,
    retry: 1,
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
