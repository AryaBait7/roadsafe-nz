import { loadFixture } from "./fixtures";
import type {
  ApiResponse,
  CrashFilters,
  CrashTrendPoint,
  LightConditionBreakdown,
  MapCrashPoint,
  RoadTypeBreakdown,
  SeverityBreakdownItem,
} from "@/types";

/** Crash counts sliced by time, severity, condition and location. */

/** Later: apiGet<CrashTrendPoint[]>("/api/crashes/trends", filters) */
export async function getTrends(
  filters: CrashFilters = {},
): Promise<ApiResponse<CrashTrendPoint[]>> {
  void filters;
  return loadFixture<ApiResponse<CrashTrendPoint[]>>("crash-trends");
}

export async function getSeverityBreakdown(
  filters: CrashFilters = {},
): Promise<ApiResponse<SeverityBreakdownItem[]>> {
  void filters;
  return loadFixture<ApiResponse<SeverityBreakdownItem[]>>("severity-breakdown");
}

/**
 * Stands in for "crashes by time of day" — CAS has no time column, so this
 * reports the `light` condition recorded at the crash instead.
 */
export async function getLightConditions(
  filters: CrashFilters = {},
): Promise<ApiResponse<LightConditionBreakdown[]>> {
  void filters;
  return loadFixture<ApiResponse<LightConditionBreakdown[]>>("light-conditions");
}

export async function getRoadTypes(
  filters: CrashFilters = {},
): Promise<ApiResponse<RoadTypeBreakdown[]>> {
  void filters;
  return loadFixture<ApiResponse<RoadTypeBreakdown[]>>("road-types");
}

/** Aggregated map points, not individual crash rows. */
export async function getMapPoints(
  filters: CrashFilters = {},
): Promise<ApiResponse<MapCrashPoint[]>> {
  void filters;
  return loadFixture<ApiResponse<MapCrashPoint[]>>("map-points");
}
