import { request } from "./client";
import type { ExecutionResult, TransactionDetail, TransactionPage } from "../types/api";

export interface TransactionFilters {
  page: number;
  pageSize: number;
  household?: string;
  status?: string;
  q?: string;
  sortBy: string;
  sortDir: "asc" | "desc";
}

export const transactionApi = {
  list: (filters: TransactionFilters) =>
    request<TransactionPage>("/transactions", {
      query: {
        page: filters.page,
        page_size: filters.pageSize,
        household: filters.household,
        status: filters.status,
        q: filters.q?.trim() || undefined,
        sort_by: filters.sortBy,
        sort_dir: filters.sortDir,
      },
    }),
  detail: (id: number) => request<TransactionDetail>(`/transactions/${id}`),
  execute: (runId?: number) =>
    request<ExecutionResult>("/transactions/execute", {
      method: "POST",
      body: runId === undefined ? {} : { run_id: runId },
    }),
};
