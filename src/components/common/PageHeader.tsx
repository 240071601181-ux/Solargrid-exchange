import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="label-xs mb-1.5">{eyebrow}</p> : null}
        <h1 className="text-[22px] font-semibold leading-7 tracking-[-0.02em] text-ink-900 sm:text-[26px] sm:leading-8">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-[13px] leading-5 text-slate-500">{description}</p>
        ) : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("animate-rise space-y-4 sm:space-y-5", className)}>{children}</div>;
}
