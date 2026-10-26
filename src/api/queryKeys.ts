export const queryKeys = {
  simulation: ["simulation"] as const,
  households: ["households"] as const,
  household: (id: string) => ["households", id] as const,
  forecast: (hours: number) => ["forecast", hours] as const,
  optimization: ["optimization", "latest"] as const,
  optimizationRuns: ["optimization", "runs"] as const,
  optimizationStats: ["optimization", "stats"] as const,
  transactions: (filters: Record<string, unknown>) => ["transactions", filters] as const,
  transaction: (id: number) => ["transactions", "detail", id] as const,
  evaluation: ["evaluation", "latest"] as const,
  settings: ["settings"] as const,
  health: ["health"] as const,
};
