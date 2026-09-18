import { apiGet } from "./http";
import type {
  ApiResponse,
  CrashFilters,
  DashboardSummary,
  FilterOptions,
} from "@/types";

/** The selected period, and the equivalent period immediately before it. */
export interface SummaryComparison {
  current: DashboardSummary;
  /** Null when no comparable preceding period exists. */
  previous: DashboardSummary | null;
}

/**
 * Dashboard-level aggregates.
 *
 * The API decides what a comparison period is and whether one exists, so the
 * rule lives in one place rather than being re-derived per client.
 */
export async function getSummary(
  filters: CrashFilters = {},
): Promise<ApiResponse<DashboardSummary>> {
  return apiGet<DashboardSummary>("/api/dashboard/totals", filters);
}

export async function getSummaryComparison(
  filters: CrashFilters = {},
): Promise<ApiResponse<SummaryComparison>> {
  return apiGet<SummaryComparison>("/api/dashboard/summary", filters);
}

export async function getFilterOptions(): Promise<ApiResponse<FilterOptions>> {
  return apiGet<FilterOptions>("/api/filters");
}
