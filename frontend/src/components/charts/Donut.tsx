"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatNumber, formatPercent } from "@/lib/formatters";

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

/**
 * Part-to-whole as a donut, with the total in the middle.
 *
 * A donut is only defensible when the segments are not close in size and the
 * values live somewhere they always fit. Both hold here: the severity split
 * is 69 / 24 / 6 / 1, and every count and share is printed in the legend
 * rather than on the arc — so the 0.9% Fatal slice never needs a label
 * squeezed into a sliver.
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
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
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
          alone and no label has to fit inside an arc. */}
      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.map((slice) => (
          <li key={slice.name} className="flex items-center gap-2 text-[11px]">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: slice.color }}
            />
            <span className="min-w-0 flex-1 truncate text-surface-700">
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
  );
}
