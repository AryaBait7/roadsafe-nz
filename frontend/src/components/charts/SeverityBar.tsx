import { SEVERITY_COLORS, SEVERITY_ORDER } from "@/lib/chart-theme";
import { formatNumber, formatPercent } from "@/lib/formatters";
import type { SeverityBreakdownItem } from "@/types";

/**
 * Part-to-whole across the four severity levels, as a single stacked bar.
 *
 * Not a donut. Fatal is 0.88% of crashes — in a donut that is an unlabelable
 * sliver, and the guidance is explicit that a label which does not fit must
 * not be clipped into the mark. A horizontal stack keeps every segment
 * visible and moves the values to a legend where they always fit.
 *
 * Segments are separated by a 2px gap in the surface colour, never a stroke:
 * a border around a mark adds ink that is not data.
 *
 * The legend carries counts and shares in text. That is the required relief
 * for the Minor slot, which sits at 2.16:1 against the card.
 */
export function SeverityBar({ data }: { data: SeverityBreakdownItem[] }) {
  const ordered = SEVERITY_ORDER.map((severity) =>
    data.find((item) => item.severity === severity),
  ).filter((item): item is SeverityBreakdownItem => item !== undefined);

  const total = ordered.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-4">
      <div
        className="flex h-6 w-full gap-[2px] overflow-hidden"
        role="img"
        aria-label={ordered
          .map(
            (item) =>
              `${item.severity}: ${formatNumber(item.count)}, ${formatPercent(item.share)}`,
          )
          .join("; ")}
      >
        {ordered.map((item, index) => (
          <div
            key={item.severity}
            className={
              index === 0
                ? "rounded-l-[4px]"
                : index === ordered.length - 1
                  ? "rounded-r-[4px]"
                  : undefined
            }
            style={{
              width: `${item.share * 100}%`,
              backgroundColor: SEVERITY_COLORS[item.severity],
              minWidth: 3,
            }}
          />
        ))}
      </div>

      {/* Legend is always present for more than one series, and doubles as the
          value readout so nothing depends on colour alone. */}
      <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {ordered.map((item) => (
          <li key={item.severity} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: SEVERITY_COLORS[item.severity] }}
            />
            <span className="min-w-0 flex-1 truncate text-surface-700">
              {item.severity}
            </span>
            <span className="tabular font-medium text-navy-900">
              {formatNumber(item.count)}
            </span>
            <span className="tabular w-12 text-right text-surface-500">
              {formatPercent(item.share)}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-surface-500">
        {formatNumber(total)} crashes in the current selection.
      </p>
    </div>
  );
}
