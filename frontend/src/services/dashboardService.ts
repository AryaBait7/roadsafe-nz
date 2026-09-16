import { loadFixture } from "./fixtures";
import {
  queryCube,
  sum,
  severeCrashes,
  totalCrashes,
  type CubeRow,
} from "./dev/crashCube";
import type {
  ApiResponse,
  CrashFilters,
  DashboardSummary,
  FilterOptions,
} from "@/types";

/**
 * Dashboard-level aggregates.
 *
 * Later: return apiGet<DashboardSummary>("/api/dashboard/summary", filters);
 */
export async function getSummary(
  filters: CrashFilters = {},
): Promise<ApiResponse<DashboardSummary>> {
  const { rows, meta } = await queryCube(filters);

  const countOf = (severity: string) =>
    sum(rows, (row: CubeRow) =>
      row.crashSeverity === severity ? row.crashCount : 0,
    );

  // Reported range is what the data actually covers after filtering, not what
  // was requested — asking for 2000-2030 must not imply we hold those years.
  const years = rows.map((row) => row.crashYear);

  return {
    data: {
      totalCrashes: totalCrashes(rows),
      seriousCrashes: countOf("Serious Crash"),
      fatalCrashes: countOf("Fatal Crash"),
      peopleKilled: sum(rows, (row) => row.peopleKilled),
      peopleInjured: sum(rows, (row) => row.seriousInjuries + row.minorInjuries),
      yearFrom: years.length ? Math.min(...years) : 0,
      yearTo: years.length ? Math.max(...years) : 0,
    },
    meta,
  };
}

/** Unused here but kept for symmetry with the future endpoint set. */
export async function getSevereCount(
  filters: CrashFilters = {},
): Promise<number> {
  const { rows } = await queryCube(filters);
  return severeCrashes(rows);
}

export interface SummaryComparison {
  current: DashboardSummary;
  /** Null when no comparable preceding period exists. */
  previous: DashboardSummary | null;
}

/**
 * The selected period alongside the equivalent period immediately before it.
 *
 * Only returned when the user has actually chosen a year range: with no
 * filter the selection is the entire dataset, which has nothing before it to
 * compare against. Rather than invent a baseline, the KPI deltas simply do
 * not render in that case.
 *
 * Later: the API returns both windows in one response.
 */
export async function getSummaryComparison(
  filters: CrashFilters = {},
): Promise<ApiResponse<SummaryComparison>> {
  const current = await getSummary(filters);

  const { yearFrom, yearTo } = filters;
  if (yearFrom === undefined || yearTo === undefined) {
    return {
      data: { current: current.data, previous: null },
      meta: current.meta,
    };
  }

  const span = yearTo - yearFrom + 1;
  const previousTo = yearFrom - 1;
  const previousFrom = previousTo - span + 1;

  const options = await getFilterOptions();
  if (previousFrom < options.data.yearMin) {
    return {
      data: { current: current.data, previous: null },
      meta: current.meta,
    };
  }

  const previous = await getSummary({
    ...filters,
    yearFrom: previousFrom,
    yearTo: previousTo,
  });

  return {
    data: { current: current.data, previous: previous.data },
    meta: current.meta,
  };
}

export async function getFilterOptions(): Promise<ApiResponse<FilterOptions>> {
  return loadFixture<ApiResponse<FilterOptions>>("filter-options");
}
