import { loadFixture } from "./fixtures";
import type {
  ApiResponse,
  CrashFilters,
  DashboardSummary,
  FilterOptions,
} from "@/types";

/**
 * Dashboard-level aggregates.
 *
 * Every method takes the filter state even where the current fixture cannot
 * honour all of it — the signature is the contract, and it must not change
 * when the implementation moves to the API.
 *
 * Later:  return apiGet<DashboardSummary>("/api/dashboard/summary", filters);
 */
export async function getSummary(
  filters: CrashFilters = {},
): Promise<ApiResponse<DashboardSummary>> {
  void filters;
  return loadFixture<ApiResponse<DashboardSummary>>("dashboard-summary");
}

export async function getFilterOptions(): Promise<ApiResponse<FilterOptions>> {
  return loadFixture<ApiResponse<FilterOptions>>("filter-options");
}
