import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "success" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink-900 text-white hover:bg-ink-800 border-ink-900",
  secondary: "bg-white text-slate-700 hover:bg-slate-50 border-slate-300",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 border-transparent",
  success: "bg-energy-500 text-white hover:bg-energy-600 border-energy-500",
  danger: "bg-critical-500 text-white hover:bg-critical-600 border-critical-500",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-9.5 px-3.5 text-sm gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  children,
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  className,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "focus-ring inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg border font-medium shadow-[0_1px_1px_rgb(11_18_32/0.04)] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}
