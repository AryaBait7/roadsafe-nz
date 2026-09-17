import Link from "next/link";
import { getSummary } from "@/services/dashboardService";
import {
  activeFilterCount,
  describeFilters,
  removeFilterHref,
} from "@/lib/filters";
import { formatNumber, formatYearRange } from "@/lib/formatters";
import type { CrashFilters } from "@/types";

/**
 * Shows what is currently filtered, and how many real crashes match.
 *
 * A Server Component so the count comes straight from the service layer with
 * no client fetch. The count matters: it is the difference between filters
 * that visibly do something and filter controls that appear decorative.
 *
 * `pathname` is passed in rather than read from a hook because Server
 * Components have no `usePathname`, and each chip's remove link needs to
 * rebuild the current URL minus one filter.
 */
export async function FilterSummary({
  filters,
  pathname,
}: {
  filters: CrashFilters;
  pathname: string;
}) {
  const { data: summary } = await getSummary(filters);
  const chips = describeFilters(filters);
  const count = activeFilterCount(filters);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-surface-200 bg-white px-6 py-3">
      <p className="text-xs text-surface-500">
        <span className="tabular font-semibold text-navy-900">
          {formatNumber(summary.totalCrashes)}
        </span>{" "}
        crashes
        {summary.totalCrashes > 0 ? (
          <>
            {" "}
            · {formatYearRange(summary.yearFrom, summary.yearTo)}
          </>
        ) : null}
      </p>

      {chips.length === 0 ? (
        <span className="text-xs text-surface-500">No filters applied</span>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <Link
              key={chip.key}
              href={removeFilterHref(pathname, filters, chip.key)}
              className="group inline-flex items-center gap-1.5 rounded border border-surface-200 bg-surface-50 py-1 pr-1.5 pl-2 text-[11px] text-surface-700 transition-colors hover:border-surface-300 hover:bg-surface-100"
            >
              <span className="text-surface-500">{chip.label}:</span>
              <span className="font-medium">{chip.value}</span>
              <span
                aria-hidden
                className="text-surface-500 group-hover:text-navy-900"
              >
                ×
              </span>
              <span className="sr-only">Remove {chip.label} filter</span>
            </Link>
          ))}

          {count > 1 ? (
            <Link
              href={pathname}
              className="ml-1 text-[11px] font-medium text-accent-600 hover:underline"
            >
              Clear all
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
