import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import { formatInteger } from "../../utils/format";

export function Pagination({
  page,
  pages,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
      <p className="text-[11px] text-slate-500">
        Showing <span className="num font-medium text-slate-700">{formatInteger(from)}</span>–
        <span className="num font-medium text-slate-700">{formatInteger(to)}</span> of{" "}
        <span className="num font-medium text-slate-700">{formatInteger(total)}</span> transactions
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          icon={<ChevronLeft className="size-3.5" />}
        >
          Previous
        </Button>
        <span className="num px-1 text-[11px] text-slate-500">
          {page} / {Math.max(1, pages)}
        </span>
        <Button
          size="sm"
          variant="secondary"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
