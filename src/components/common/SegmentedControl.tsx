import { cn } from "../../utils/cn";

export function SegmentedControl<T extends string | number>({
  value,
  options,
  onChange,
  label,
  size = "sm",
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-100 p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "focus-ring rounded-md font-medium transition-colors",
              size === "sm" ? "h-6.5 px-2.5 text-[11px]" : "h-8 px-3 text-xs",
              active ? "bg-white text-ink-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
