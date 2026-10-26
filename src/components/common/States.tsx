import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { describeApiError } from "../../api/client";
import { Button } from "./Button";
import { cn } from "../../utils/cn";

export function ErrorState({
  error,
  title = "Could not load this data",
  onRetry,
  compact = false,
}: {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-critical-100 bg-critical-50/60 text-center",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-white text-critical-500 shadow-sm">
        <AlertTriangle className="size-4.5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-600">{describeApiError(error)}</p>
      </div>
      {onRetry ? (
        <Button size="sm" variant="secondary" icon={<RefreshCw className="size-3.5" />} onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
        {icon ?? <Inbox className="size-4.5" aria-hidden="true" />}
      </span>
      <div>
        <p className="text-sm font-medium text-ink-900">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function InlineAlert({
  tone = "warning",
  children,
  className,
}: {
  tone?: "warning" | "danger" | "info";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    warning: "border-warn-100 bg-warn-50 text-warn-700",
    danger: "border-critical-100 bg-critical-50 text-critical-600",
    info: "border-info-100 bg-info-50 text-info-600",
  } as const;
  return (
    <div
      className={cn("flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs leading-5", tones[tone], className)}
      role={tone === "danger" ? "alert" : "status"}
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
