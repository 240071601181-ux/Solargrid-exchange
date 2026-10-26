export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <span className={`skeleton block ${className}`} aria-hidden="true" />;
}

export function MetricSkeleton() {
  return (
    <div className="card px-4 py-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-28" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}

export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div className="flex flex-col gap-2" style={{ height }} aria-busy="true" aria-label="Loading chart">
      <div className="flex flex-1 items-end gap-1.5">
        {[38, 55, 47, 70, 62, 78, 58, 84, 66, 72, 50, 44].map((value, index) => (
          <span key={index} className="skeleton flex-1" style={{ height: `${value}%` }} />
        ))}
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Loading table">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-14" />
        </div>
      ))}
    </div>
  );
}
