import { cn } from "../../utils/cn";

export function ProgressBar({
  value,
  tone = "success",
  label,
  className,
}: {
  value: number;
  tone?: "success" | "warning" | "danger" | "info";
  label?: string;
  className?: string;
}) {
  const tones = {
    success: "bg-energy-500",
    warning: "bg-warn-500",
    danger: "bg-critical-500",
    info: "bg-info-500",
  } as const;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("w-full", className)}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        aria-label={label}
      >
        <span
          className={cn("block h-full rounded-full transition-[width] duration-500", tones[tone])}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
