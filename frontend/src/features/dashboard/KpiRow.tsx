import { Card } from "@/components/ui/Card";
import { formatNumber, formatYearRange } from "@/lib/formatters";
import type { DashboardSummary } from "@/types";

/**
 * Headline figures as stat tiles.
 *
 * A handful of headline numbers is a KPI row, not a grouped bar chart — the
 * numbers *are* the chart. Total crashes is the single hero figure; there is
 * exactly one per view.
 *
 * No delta indicators. A delta needs a defined comparison period, and this
 * dataset has no "previous period" the user has chosen — inventing one to
 * decorate the tiles would be fabricating a statistic.
 *
 * Values use proportional figures deliberately: `tabular-nums` gives every
 * digit the width of a zero, which makes a large standalone number look
 * loosely spaced. Tabular is reserved for columns that align vertically.
 */
function StatTile({
  label,
  value,
  period,
  hero = false,
}: {
  label: string;
  value: number;
  period: string;
  hero?: boolean;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs text-surface-500">{label}</p>
      <p
        className={
          hero
            ? "mt-1.5 text-5xl font-semibold tracking-tight text-navy-900"
            : "mt-1.5 text-2xl font-semibold tracking-tight text-navy-900"
        }
      >
        {formatNumber(value)}
      </p>
      <p className="mt-1 text-[11px] text-surface-400">{period}</p>
    </Card>
  );
}

export function KpiRow({ summary }: { summary: DashboardSummary }) {
  // Every tile states its period explicitly: a severity count without its
  // date context is not a figure anyone can act on.
  const period = formatYearRange(summary.yearFrom, summary.yearTo);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <div className="sm:col-span-2 xl:col-span-1">
        <StatTile
          hero
          label="Total crashes"
          value={summary.totalCrashes}
          period={period}
        />
      </div>
      <StatTile
        label="Serious crashes"
        value={summary.seriousCrashes}
        period={period}
      />
      <StatTile
        label="Fatal crashes"
        value={summary.fatalCrashes}
        period={period}
      />
      <StatTile
        label="People killed"
        value={summary.peopleKilled}
        period={period}
      />
      <StatTile
        label="People injured"
        value={summary.peopleInjured}
        period={period}
      />
    </div>
  );
}
