import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { formatNumber, formatPercent, formatYearRange } from "@/lib/formatters";
import type { DashboardSummary } from "@/types";

/**
 * Headline figures as five compact peers.
 *
 * No hero figure here, unlike the landing page. A 48px lead number would
 * force the row onto two lines, and the dashboard's job is to show the whole
 * picture at 1440x900 — these five are read together, not one-then-the-rest.
 *
 * Values use proportional figures deliberately: tabular-nums gives every
 * digit the width of a zero, which makes a large standalone number look
 * loosely spaced. Tabular is for columns that align vertically.
 */

type IconName = "crashes" | "serious" | "fatal" | "killed" | "injured";

const ICONS: Record<IconName, { path: React.ReactNode; tint: string }> = {
  crashes: {
    path: <path d="M3 13.5h14M5.5 13.5V9l1.8-3.6a1 1 0 0 1 .9-.55h3.6a1 1 0 0 1 .9.55L14.5 9v4.5M6.5 16.5v-3M13.5 16.5v-3" />,
    tint: "bg-accent-500/10 text-accent-600",
  },
  serious: {
    path: <path d="M10 3.4 2.9 16.3h14.2L10 3.4ZM10 8.4v3.3M10 14h.01" />,
    tint: "bg-severity-serious/12 text-severity-serious",
  },
  fatal: {
    path: <path d="M3 10h3.2l1.6-4 2.4 8 1.8-4H17" />,
    tint: "bg-severity-fatal/12 text-severity-fatal",
  },
  killed: {
    path: (
      <>
        <circle cx="10" cy="6.6" r="2.8" />
        <path d="M4.6 16.4a5.4 5.4 0 0 1 10.8 0" />
      </>
    ),
    tint: "bg-surface-500/12 text-surface-700",
  },
  injured: {
    path: <path d="M10 5.5v9M5.5 10h9" />,
    tint: "bg-severity-minor/15 text-severity-minor",
  },
};

function Icon({ name }: { name: IconName }) {
  const { path, tint } = ICONS[name];

  return (
    <span
      aria-hidden
      className={`grid size-7 shrink-0 place-items-center rounded-full ${tint}`}
    >
      <svg
        viewBox="0 0 20 20"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {path}
      </svg>
    </span>
  );
}

/**
 * Change against the equivalent preceding period.
 *
 * Colour follows whether the movement is *good*, not whether it is up. For
 * crash and casualty counts a fall is the good outcome, so a decrease is
 * green and an increase red — the opposite of a revenue dashboard, and the
 * opposite of colouring every rise green regardless of what it measures.
 */
function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;

  const change = (current - previous) / previous;
  const rising = change > 0;
  const flat = Math.abs(change) < 0.0005;

  if (flat) {
    return (
      <p className="mt-1 text-[10px] text-surface-500">
        No change vs previous period
      </p>
    );
  }

  return (
    <p
      className={`mt-1 text-[10px] font-medium ${
        rising ? "text-severity-fatal" : "text-[#0a7a35]"
      }`}
    >
      {rising ? "↑" : "↓"} {formatPercent(Math.abs(change), 1)}{" "}
      <span className="font-normal text-surface-500">vs previous period</span>
    </p>
  );
}

function Kpi({
  label,
  value,
  previous,
  period,
  icon,
  className,
}: {
  className?: string;
  label: string;
  value: number;
  previous?: number;
  period: string;
  icon: IconName;
}) {
  return (
    <Card className={cn("px-3.5 py-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] text-surface-500">{label}</p>
          <p className="mt-1 text-[26px] leading-none font-semibold tracking-tight text-navy-900">
            {formatNumber(value)}
          </p>
        </div>
        <Icon name={icon} />
      </div>

      <p className="mt-1.5 text-[10px] text-surface-500">{period}</p>
      {previous !== undefined ? (
        <Delta current={value} previous={previous} />
      ) : null}
    </Card>
  );
}

export function KpiRow({
  summary,
  previous,
}: {
  summary: DashboardSummary;
  previous: DashboardSummary | null;
}) {
  // Every tile states its period: a severity count without date context is
  // not a figure anyone can act on.
  const period = formatYearRange(summary.yearFrom, summary.yearTo);

  const tiles = [
    {
      label: "Total crashes",
      value: summary.totalCrashes,
      previous: previous?.totalCrashes,
      icon: "crashes" as const,
    },
    {
      label: "Serious crashes",
      value: summary.seriousCrashes,
      previous: previous?.seriousCrashes,
      icon: "serious" as const,
    },
    {
      label: "Fatal crashes",
      value: summary.fatalCrashes,
      previous: previous?.fatalCrashes,
      icon: "fatal" as const,
    },
    {
      label: "People killed",
      value: summary.peopleKilled,
      previous: previous?.peopleKilled,
      icon: "killed" as const,
    },
    {
      label: "People injured",
      value: summary.peopleInjured,
      previous: previous?.peopleInjured,
      icon: "injured" as const,
    },
  ];

  return (
    // Five tiles never divide evenly into 2 or 3 columns, so the tablet grid
    // runs on six tracks (3 + 2 tiles) and the lone fifth tile spans the row
    // on phones, rather than leaving a hole.
    <div className="grid grid-cols-2 gap-3 md:grid-cols-6 xl:grid-cols-5">
      {tiles.map((tile, index) => (
        <Kpi
          key={tile.label}
          {...tile}
          period={period}
          className={cn(
            index < 3 ? "md:col-span-2" : "md:col-span-3",
            index === tiles.length - 1 && "col-span-2",
            "xl:col-span-1",
          )}
        />
      ))}
    </div>
  );
}
