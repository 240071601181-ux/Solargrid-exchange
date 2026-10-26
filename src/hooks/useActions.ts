import { useMutation, useQueryClient } from "@tanstack/react-query";
import { simulationApi } from "../api/simulationApi";
import { optimizationApi } from "../api/optimizationApi";
import { transactionApi } from "../api/transactionApi";
import { evaluationApi } from "../api/evaluationApi";
import { settingsApi } from "../api/settingsApi";
import { queryKeys } from "../api/queryKeys";
import type { ExecutionResult, SettingsPatch, SimulationSnapshot } from "../types/api";

function useApplySnapshot() {
  const queryClient = useQueryClient();
  return (snapshot: SimulationSnapshot) => {
    queryClient.setQueryData(queryKeys.simulation, snapshot);
    void queryClient.invalidateQueries({ queryKey: queryKeys.households });
    void queryClient.invalidateQueries({ queryKey: queryKeys.optimization });
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };
}

export function useSimulationActions() {
  const queryClient = useQueryClient();
  const apply = useApplySnapshot();

  const start = useMutation({
    mutationFn: () => simulationApi.start(),
    onSuccess: apply,
  });

  const pause = useMutation({
    mutationFn: () => simulationApi.pause(),
    onSuccess: apply,
  });

  const step = useMutation({
    mutationFn: () => simulationApi.step(),
    onSuccess: apply,
  });

  const reset = useMutation({
    mutationFn: () => simulationApi.reset(),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(queryKeys.simulation, snapshot);
      void queryClient.invalidateQueries({ queryKey: queryKeys.households });
      void queryClient.invalidateQueries({ queryKey: queryKeys.optimization });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.evaluation });
    },
  });

  const scenario = useMutation({
    mutationFn: ({ cloudCoverPct, advance }: { cloudCoverPct: number; advance?: boolean }) =>
      simulationApi.setCloudScenario(cloudCoverPct, advance ?? true),
    onSuccess: apply,
  });

  return { start, pause, step, reset, scenario };
}

export function useOptimizationActions() {
  const queryClient = useQueryClient();

  const refreshRelated = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.simulation });
    void queryClient.invalidateQueries({ queryKey: queryKeys.households });
    void queryClient.invalidateQueries({ queryKey: queryKeys.optimization });
    void queryClient.invalidateQueries({ queryKey: queryKeys.optimizationStats });
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };

  const run = useMutation({
    mutationFn: () => optimizationApi.run(),
    onSuccess: (allocation) => {
      queryClient.setQueryData(queryKeys.optimization, allocation);
      refreshRelated();
    },
  });

  const execute = useMutation<ExecutionResult, Error, number>({
    mutationFn: (runId: number) => optimizationApi.execute(runId),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.optimization, result.allocation);
      queryClient.setQueryData(["transactions", "execution", result.allocation.id], result.transactions);
      refreshRelated();
    },
  });

  return { run, execute };
}

export function useTransactionExecution() {
  const queryClient = useQueryClient();
  return useMutation<ExecutionResult, Error, number | undefined>({
    mutationFn: (runId) => transactionApi.execute(runId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.simulation });
      void queryClient.invalidateQueries({ queryKey: queryKeys.optimization });
    },
  });
}

export function useEvaluationAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticks, cloudCoverPct }: { ticks: number; cloudCoverPct: number }) =>
      evaluationApi.run(ticks, cloudCoverPct),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.evaluation, result);
    },
  });
}

export function useSettingsAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsPatch) => settingsApi.update(patch),
    onSuccess: (page) => {
      queryClient.setQueryData(queryKeys.settings, page);
      void queryClient.invalidateQueries({ queryKey: queryKeys.simulation });
      void queryClient.invalidateQueries({ queryKey: ["forecast"] });
    },
  });
}
