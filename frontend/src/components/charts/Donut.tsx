"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatNumber, formatPercent } from "@/lib/formatters";

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

/**
 * Hover detail for one arc.
 *
 * Recharts' default tooltip shows the series name and raw value in a narrow
 * box, which for "Non-Injury Crash" meant a wrapped, clipped label and no
 * share. This is the library's supported `content` slot rather than CSS
 * layered over the default — the names are set `whitespace-nowrap` so the box
 * sizes to the longest of them instead of truncating it.
 */
function SliceTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { payload: DonutSlice }[];
  total: number;
}) {
  const slice = payload?.[0]?.payload;
  if (!active || !slice) return null;

  return (
    <div className="rounded-md border border-surface-200 bg-white px-3 py-2 shadow-lg">
      <p className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap text-navy-900">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-[2px]"
          style={{ backgroundColor: slice.color }}
        />
        {slice.name}
      </p>
      <p className="tabular mt-1 text-xs whitespace-nowrap text-surface-700">
        {formatNumber(slice.value)} crashes
      </p>
      <p className="tabular text-[11px] whitespace-nowrap text-surface-500">
        {total > 0 ? formatPercent(slice.value / total, 1) : "—"} of total
      </p>
    </div>
  );
}

/**
 * Part-to-whole as a donut, with the total in the middle.
 *
 * A donut is only defensible when the segments are not close in size and the
 * values live somewhere they always fit. Both hold here: the severity split
 * is 69 / 24 / 6 / 1, and every count and share is printed in the legend
 * rather than on the arc — so the 0.9% Fatal slice never needs a label
 * squeezed into a sliver. That legend is also the accessible reading of the
 * chart, and every panel using this offers a table view besides.
 *
 * **Laid out against its container, not the viewport.** This sits in a card
 * whose width depends on the dashboard grid, so a viewport breakpoint tells
 * it nothing useful: the same 1440px screen can give it 300px or 700px. Below
 * 22rem of *container* it stacks the donut above the legend, which is what
 * stops the category names being truncated. They previously carried
 * `truncate` and read "Serious …", "Non-Inj…" — the names are now never
 * shortened, because a label you cannot read is not a label.
 *
 * `paddingAngle` supplies the 2px surface gap between segments. A stroke
 * around each arc would add ink that is not data.
 */
export function Donut({
  data,
  centreValue,
  centreLabel,
  size = 150,
}: {
  data: DonutSlice[];
  centreValue: number;
  centreLabel: string;
  size?: number;
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className="@container">
      <div className="flex flex-col items-center gap-4 @[22rem]:flex-row">
        <div
          className="relative shrink-0"
          style={{ width: size, height: size, maxWidth: "100%" }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="100%"
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
              >
                {data.map((slice) => (
                  <Cell key={slice.name} fill={slice.color} />
                ))}
              </Pie>
              {/* Escapes the 140px chart box so a tooltip near the edge is
                  repositioned rather than clipped. */}
              <Tooltip
                content={<SliceTooltip total={total} />}
                allowEscapeViewBox={{ x: true, y: true }}
                wrapperStyle={{ zIndex: 30, outline: "none" }}
                isAnimationActive={false}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Centred total. Pointer-events off so it never blocks the arcs. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base leading-none font-semibold text-navy-900">
              {formatNumber(centreValue)}
            </span>
            <span className="mt-1 text-[10px] text-surface-500">
              {centreLabel}
            </span>
          </div>
        </div>

        {/* The legend carries identity and value, so nothing depends on colour
            alone and no label has to fit inside an arc. A grid rather than a
            flex row: the three columns then line up down the list, and the
            name column is free to take the width it needs. */}
        <ul className="grid w-full min-w-0 flex-1 gap-1.5">
          {data.map((slice) => (
            <li
              key={slice.name}
              className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2 text-[11px]"
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: slice.color }}
              />
              <span className="whitespace-nowrap text-surface-700">
                {slice.name}
              </span>
              <span className="tabular font-medium text-navy-900">
                {formatNumber(slice.value)}
              </span>
              <span className="tabular w-10 text-right text-surface-500">
                {total > 0 ? formatPercent(slice.value / total, 1) : "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
