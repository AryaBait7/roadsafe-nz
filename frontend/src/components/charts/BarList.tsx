import { SERIES_1 } from "@/lib/chart-theme";
import { formatNumber, formatPercent } from "@/lib/formatters";

export interface BarDatum {
  label: string;
  value: number;
  /** Optional second measure shown as text, never as a second colour. */
  rate?: number;
}

/**
 * Horizontal bars for nominal categories.
 *
 * Plain HTML rather than a charting library: the mandated mark specs — a
 * capped bar thickness, a 4px rounded data-end square at the baseline, and a
 * real 2px surface gap between neighbours — are exact in CSS and fought at
 * every turn in SVG.
 *
 * One series, so one hue for every bar. Colouring each bar by its own value
 * would double-encode the length and spend the identity channel showing what
 * the bar already shows. One series also means no legend: the panel title
 * names what is plotted.
 *
 * Every bar is direct-labelled because there are only a handful; that is also
 * the relief channel that keeps values readable without hover.
 */
export function BarList({
  data,
  color = SERIES_1,
  valueLabel = "crashes",
}: {
  data: BarDatum[];
  color?: string;
  valueLabel?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((datum) => (
        <li key={datum.label} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3">
          <span className="truncate text-xs text-surface-700" title={datum.label}>
            {datum.label}
          </span>

          <div className="flex items-center gap-2">
            {/* Track is invisible; the fill grows from a single baseline. */}
            <div className="h-4 min-w-0 flex-1">
              <div
                className="h-full rounded-r-[4px]"
                style={{
                  width: `${Math.max((datum.value / max) * 100, 0.6)}%`,
                  backgroundColor: color,
                }}
              />
            </div>

            <span className="tabular shrink-0 text-xs font-medium text-navy-900">
              {formatNumber(datum.value)}
            </span>

            {datum.rate !== undefined ? (
              <span
                className="tabular w-14 shrink-0 text-right text-[11px] text-surface-500"
                title={`${formatPercent(datum.rate)} of these ${valueLabel} were severe`}
              >
                {formatPercent(datum.rate)}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
