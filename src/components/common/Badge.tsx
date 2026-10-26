import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "navy";

const TONES: Record<Tone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  success: "border-energy-100 bg-energy-50 text-energy-700",
  warning: "border-warn-100 bg-warn-50 text-warn-700",
  danger: "border-critical-100 bg-critical-50 text-critical-600",
  info: "border-info-100 bg-info-50 text-info-600",
  navy: "border-ink-700 bg-ink-900 text-slate-100",
};

export function Badge({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5",
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
