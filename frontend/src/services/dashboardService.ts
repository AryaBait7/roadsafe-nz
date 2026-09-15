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

export async function getFilterOptions(): Promise<ApiResponse<FilterOptions>> {
  return loadFixture<ApiResponse<FilterOptions>>("filter-options");
}
