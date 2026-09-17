import { Card, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChartSkeleton, KpiSkeleton } from "@/components/states/LoadingSkeleton";

/**
 * Shown while an analytics page renders on the server for the first time.
 * Shaped like a typical page (header, a row of figures, two panels) so the
 * real content replaces it without the layout jumping.
 *
 * Filter changes on an already-open page do not show this: they navigate
 * inside a transition, which keeps the current view and marks it pending.
 */
export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading crash data…</span>
      <div className="border-b border-surface-200 bg-white px-4 py-2.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-1.5 h-2.5 w-72 max-w-full" />
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Card key={i} className="px-3.5 py-3">
              <KpiSkeleton />
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <Card key={i}>
              <CardBody>
                <ChartSkeleton height={220} />
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
