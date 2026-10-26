import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function StatCard({
  label,
  value,
  unit,
  icon,
  hint,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  icon: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const iconTone = {
    neutral: "bg-slate-100 text-slate-500",
    success: "bg-energy-50 text-energy-600",
    warning: "bg-warn-50 text-warn-600",
    danger: "bg-critical-50 text-critical-500",
    info: "bg-info-50 text-info-600",
  } as const;

  return (
    <div className={cn("card px-4 py-3.5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="label-xs pt-0.5">{label}</p>
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", iconTone[tone])}>
          {icon}
        </span>
      </div>
      <p className="num mt-2 text-[26px] font-semibold leading-8 tracking-[-0.02em] text-ink-900">
        {value}
        {unit ? <span className="ml-1.5 text-xs font-medium tracking-normal text-slate-500">{unit}</span> : null}
      </p>
      {hint ? <div className="mt-1.5 text-[11px] leading-4 text-slate-500">{hint}</div> : null}
    </div>
  );
}
