import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("card", className)}>{children}</section>;
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-slate-400">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="text-[13.5px] font-semibold leading-5 text-ink-900">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs leading-5 text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 py-4 sm:px-5", className)}>{children}</div>;
}
