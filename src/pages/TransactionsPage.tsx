import { Download, FilterX, ReceiptText, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useHouseholds, useTransactions } from "../hooks/queries";
import type { TransactionFilters } from "../api/transactionApi";
import { PageBody, PageHeader } from "../components/common/PageHeader";
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { Pagination } from "../components/common/Pagination";
import { ErrorState, InlineAlert } from "../components/common/States";
import { TableSkeleton } from "../components/common/Skeletons";
import { TransactionTable } from "../components/transactions/TransactionTable";
import { TransactionDrawer } from "../components/transactions/TransactionDrawer";
import { formatInr, formatInteger, formatNumber } from "../utils/format";

const DEFAULT_FILTERS: TransactionFilters = {
  page: 1,
  pageSize: 10,
  sortBy: "executed_at",
  sortDir: "desc",
};

const SORT_OPTIONS = [
  { value: "executed_at:desc", label: "Newest first" },
  { value: "executed_at:asc", label: "Oldest first" },
  { value: "energy_kwh:desc", label: "Energy high → low" },
  { value: "total_value_inr:desc", label: "Value high → low" },
  { value: "price_inr_kwh:desc", label: "Price high → low" },
] as const;

const selectClass =
  "focus-ring h-8 rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-700";

export function TransactionsPage() {
  const households = useHouseholds();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const transactions = useTransactions(filters);

  const txParam = Number(searchParams.get("tx"));
  const selectedId = Number.isFinite(txParam) && txParam > 0 ? txParam : null;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) =>
        current.q === searchInput.trim() ? current : { ...current, q: searchInput.trim() || undefined, page: 1 },
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const update = (patch: Partial<TransactionFilters>) => {
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  };

  const openTransaction = (id: number | null) => {
    if (id === null) {
      searchParams.delete("tx");
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ tx: String(id) }, { replace: true });
    }
  };

  const sortValue = `${filters.sortBy}:${filters.sortDir}`;
  const activeFilterCount =
    (filters.household ? 1 : 0) + (filters.status ? 1 : 0) + (filters.q ? 1 : 0) + (filters.sortBy !== "executed_at" ? 1 : 0);
  const pageValue = transactions.data?.items.reduce((sum, transaction) => sum + transaction.total_value_inr, 0) ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Records · SQLite"
        title="Transactions"
        description="Every executed allocation is persisted as one simulated transaction per seller–buyer link. Values are computed from allocated power, interval length and clearing price. No payment is settled."
        meta={
          <>
            <Badge tone="neutral">{formatInteger(transactions.data?.total)} matching records</Badge>
            {activeFilterCount > 0 ? <Badge tone="warning">{activeFilterCount} active filters</Badge> : null}
            {transactions.isFetching ? <Badge tone="info">Refreshing</Badge> : null}
          </>
        }
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500">
            <Download className="size-3" aria-hidden="true" />
            Persisted locally · no export
          </span>
        }
      />

      <PageBody>
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
            <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search household or transaction ID"
                aria-label="Search transactions"
                className="focus-ring h-8 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-2.5 text-[11px] text-ink-900 placeholder:text-slate-400"
              />
            </div>
            <select
              aria-label="Filter by household"
              value={filters.household ?? ""}
              onChange={(event) => update({ household: event.target.value || undefined })}
              className={selectClass}
            >
              <option value="">All households</option>
              {households.data?.map((household) => (
                <option key={household.id} value={household.id}>
                  {household.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by status"
              value={filters.status ?? ""}
              onChange={(event) => update({ status: event.target.value || undefined })}
              className={selectClass}
            >
              <option value="">All statuses</option>
              <option value="executed">Executed</option>
              <option value="proposed">Proposed</option>
              <option value="failed">Failed</option>
            </select>
            <select
              aria-label="Sort transactions"
              value={sortValue}
              onChange={(event) => {
                const [sortBy = "executed_at", sortDir = "desc"] = event.target.value.split(":");
                update({ sortBy, sortDir: sortDir === "asc" ? "asc" : "desc" });
              }}
              className={selectClass}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Rows per page"
              value={filters.pageSize}
              onChange={(event) => update({ pageSize: Number(event.target.value) })}
              className={selectClass}
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
            {activeFilterCount > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFilters(DEFAULT_FILTERS);
                  setSearchInput("");
                }}
                icon={<FilterX className="size-3.5" />}
              >
                Clear
              </Button>
            ) : null}
            <div className="ml-auto hidden items-center gap-3 text-[10px] text-slate-400 sm:flex">
              <span>Page value <span className="num font-medium text-slate-600">{formatInr(pageValue)}</span></span>
              <span>{formatNumber(transactions.data?.items.length, 0)} rows</span>
            </div>
          </div>

          {transactions.isPending ? (
            <div className="px-4 py-4 sm:px-5">
              <TableSkeleton rows={8} />
            </div>
          ) : transactions.isError ? (
            <div className="p-4 sm:p-5">
              <ErrorState
                error={transactions.error}
                title="Could not load transactions"
                onRetry={() => void transactions.refetch()}
                compact
              />
            </div>
          ) : (
            <>
              <TransactionTable
                transactions={transactions.data.items}
                onSelect={openTransaction}
                selectedId={selectedId}
              />
              <Pagination
                page={transactions.data.page}
                pages={transactions.data.pages}
                total={transactions.data.total}
                pageSize={transactions.data.page_size}
                onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
              />
            </>
          )}
        </Card>

        <InlineAlert tone="info">
          <span className="font-medium">Record semantics:</span> a transaction means energy was allocated and recorded.
          It does not mean a meter reading was verified, a payment was made, or a blockchain settlement occurred.
          Duplicate execution of the same allocation is rejected by the backend.
        </InlineAlert>

        <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <ReceiptText className="size-3" aria-hidden="true" />
          Values shown are read from the backend REST API; the UI does not recompute or invent transaction amounts.
        </p>
      </PageBody>

      <TransactionDrawer transactionId={selectedId} onClose={() => openTransaction(null)} />
    </>
  );
}
