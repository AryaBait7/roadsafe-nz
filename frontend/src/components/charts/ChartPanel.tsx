"use client";

import { useId, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { PlaceholderBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

/**
 * Card wrapper giving every chart a table-view twin.
 *
 * Both views are rendered on the server and passed in as elements; this
 * component only decides which is visible. That keeps the panel interactive
 * without pulling the chart's data or rendering onto the client.
 */
export function ChartPanel({
  title,
  description,
  chart,
  table,
  isPlaceholder = false,
  className,
}: {
  title: string;
  description?: string;
  chart: React.ReactNode;
  table?: React.ReactNode;
  isPlaceholder?: boolean;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const panelId = useId();

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isPlaceholder ? <PlaceholderBadge /> : null}
          {table ? (
            <button
              type="button"
              onClick={() => setShowTable((shown) => !shown)}
              aria-expanded={showTable}
              aria-controls={panelId}
              className="rounded border border-surface-200 px-2 py-1 text-[11px] font-medium text-surface-500 transition-colors hover:bg-surface-100 hover:text-navy-900"
            >
              {showTable ? "Chart" : "Table"}
            </button>
          ) : null}
        </div>
      </CardHeader>

      <CardBody id={panelId} className="flex-1">
        {showTable && table ? table : chart}
      </CardBody>
    </Card>
  );
}
