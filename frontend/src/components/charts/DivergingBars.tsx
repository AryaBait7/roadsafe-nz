import { DIVERGING } from "@/lib/chart-theme";
import { formatNumber, formatPercent } from "@/lib/formatters";
import type { SeverityLift } from "@/types";

/**
 * Each condition's severe rate as a deviation from the baseline.
 *
 * A diverging form because the reader's question is polarity — is this worse
 * or better than average — not magnitude in isolation. Bars grow from a
 * central baseline rule, warm to the right for worse and cool to the left for
 * better, which is why the pair must read as opposites rather than as two
 * shades of one hue.
 *
 * Every row is direct-labelled with both the deviation and the crash count.
 * The count is not decoration: a rate computed from a few hundred crashes
 * swings far more than one computed from hundreds of thousands, and the
 * reader needs to see which they are looking at.
 */
export function DivergingBars({
  data,
  baseline,
}: {
  data: SeverityLift[];
  baseline: number;
}) {
  // Scale to the largest deviation present so the chart uses its full width
  // whatever the filter set.
  const largest = Math.max(...data.map((d) => Math.abs(d.lift)), 0.001);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[10px] text-surface-500">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2 rounded-[2px]"
            style={{ backgroundColor: DIVERGING.below }}
          />
          Less severe than average
        </span>
        <span className="text-surface-500">
          Baseline {formatPercent(baseline)}
        </span>
        <span className="flex items-center gap-1.5">
          More severe than average
          <span
            aria-hidden
            className="size-2 rounded-[2px]"
            style={{ backgroundColor: DIVERGING.above }}
          />
        </span>
      </div>

      <ul className="space-y-1.5">
        {data.map((item) => {
          const worse = item.lift >= 0;
          const extent = (Math.abs(item.lift) / largest) * 50;

          return (
            <li
              key={`${item.category}-${item.factor}`}
              className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2"
            >
              <span className="min-w-0">
                <span
                  className="block truncate text-[11px] text-surface-700"
                  title={item.factor}
                >
                  {item.factor}
                </span>
                <span className="block truncate text-[10px] text-surface-500">
                  {item.category}
                </span>
              </span>

              <span className="relative block h-4">
                {/* The baseline itself — a hairline, so it reads as a
                    reference rather than as data. */}
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-1/2 w-px bg-surface-300"
                />
                <span
                  className="absolute top-1/2 h-3 -translate-y-1/2 transition-[width] duration-500 ease-out"
                  style={{
                    [worse ? "left" : "right"]: "50%",
                    width: `${extent}%`,
                    backgroundColor: worse ? DIVERGING.above : DIVERGING.below,
                    borderRadius: worse ? "0 4px 4px 0" : "4px 0 0 4px",
                  }}
                />
              </span>

              <span className="text-right">
                <span
                  className="tabular block text-[11px] font-medium"
                  style={{ color: worse ? DIVERGING.above : DIVERGING.below }}
                >
                  {worse ? "+" : "−"}
                  {(Math.abs(item.lift) * 100).toFixed(2)}pp
                </span>
                <span className="tabular block text-[10px] text-surface-500">
                  {formatNumber(item.crashCount)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
