"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_CHROME, SERIES_1 } from "@/lib/chart-theme";
import { formatNumber, formatPercent } from "@/lib/formatters";

/**
 * A single measure over time.
 *
 * Deliberately one series per chart. The obvious alternative — plotting all
 * four severity levels together — puts Non-Injury (485,478) on the same axis
 * as Fatal (6,182), which flattens the two series anyone actually cares about
 * into the baseline. Fixing that with a second y-axis would invent a
 * correlation out of an arbitrary scale alignment, which is the single worst
 * charting mistake. Two measures of different scale therefore become two
 * charts sharing an x-axis: small multiples.
 *
 * One series also means no legend — the panel title says what is plotted.
 */
export function TrendChart({
  data,
  valueKey,
  kind,
  height = 200,
  color = SERIES_1,
}: {
  data: { year: number; value: number }[];
  valueKey: string;
  kind: "count" | "rate";
  height?: number;
  /** Only override for small multiples where each panel *is* a category. */
  color?: string;
}) {
  const format = (value: number) =>
    kind === "rate" ? formatPercent(value) : formatNumber(value);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          {/* Hairline, solid, one step off surface. Horizontal only: vertical
              rules would compete with the year ticks. */}
          <CartesianGrid
            stroke={CHART_CHROME.grid}
            strokeWidth={1}
            vertical={false}
          />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: CHART_CHROME.muted }}
            tickLine={false}
            axisLine={{ stroke: CHART_CHROME.axis }}
            minTickGap={16}
          />
          <YAxis
            width={52}
            tick={{ fontSize: 11, fill: CHART_CHROME.muted }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) =>
              kind === "rate"
                ? `${(value * 100).toFixed(0)}%`
                : formatNumber(value)
            }
          />
          <Tooltip
            cursor={{ stroke: CHART_CHROME.axis, strokeWidth: 1 }}
            contentStyle={{
              borderRadius: 6,
              border: "1px solid var(--color-surface-200)",
              fontSize: 12,
              padding: "6px 10px",
            }}
            labelStyle={{ color: CHART_CHROME.muted, fontSize: 11 }}
            // Recharts 3 hands the formatter `ValueType | undefined`, not a
            // number, so the parameter is left to inference and coerced here
            // rather than annotated as `number` (which does not typecheck).
            formatter={(value) => [format(Number(value)), valueKey]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            // A dot per year would be 21 marks competing with the line; the
            // crosshair tooltip already answers "what was 2019".
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: CHART_CHROME.surface }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
