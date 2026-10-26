import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

const fieldClass =
  "focus-ring h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-ink-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export function FieldShell({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? <p className="text-[11px] leading-4 text-critical-600">{error}</p> : null}
      {!error && hint ? <p className="text-[11px] leading-4 text-slate-500">{hint}</p> : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function Input({ label, hint, error, id, className, ...rest }: InputProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={inputId}>
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        className={cn(fieldClass, error && "border-critical-500", className)}
        {...rest}
      />
    </FieldShell>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  hint?: ReactNode;
  error?: string;
}

export function Select({ label, options, hint, error, id, className, ...rest }: SelectProps) {
  const generated = useId();
  const selectId = id ?? generated;
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={selectId}>
      <select
        id={selectId}
        aria-invalid={Boolean(error)}
        className={cn(fieldClass, "appearance-none bg-[length:16px] pr-8", className)}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-xs font-medium text-slate-700">
          {label}
        </label>
        {description ? <p className="mt-0.5 max-w-md text-[11px] leading-4 text-slate-500">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "focus-ring relative mt-0.5 h-5.5 w-10 shrink-0 rounded-full border transition-colors disabled:opacity-50",
          checked ? "border-energy-600 bg-energy-500" : "border-slate-300 bg-slate-200",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-all",
            checked ? "left-5" : "left-0.5",
          )}
        />
        <span className="sr-only">{label}</span>
      </button>
    </div>
  );
}
