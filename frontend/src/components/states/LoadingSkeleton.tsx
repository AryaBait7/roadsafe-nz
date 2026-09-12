import { Skeleton } from "@/components/ui/Skeleton";

/** Placeholder shaped like a chart panel, to avoid layout shift on load. */
export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      <Skeleton className="h-3 w-32" />
      <Skeleton style={{ height }} className="w-full" />
    </div>
  );
}

/** Placeholder shaped like a KPI card. */
export function KpiSkeleton() {
  return (
    <div className="space-y-2.5" aria-hidden>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-2.5 w-16" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}
