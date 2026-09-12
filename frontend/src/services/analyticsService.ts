import { loadFixture } from "./fixtures";
import type {
  ApiResponse,
  ConditionFactor,
  CrashFilters,
  Hotspot,
} from "@/types";

/** Derived analytics: conditions associated with severe crashes, and hotspots. */

/**
 * Conditions recorded as present at crashes — not causes. CAS has no
 * contributing-factor column; these come from weather, road surface, light
 * and traffic-control fields.
 *
 * Later: apiGet<ConditionFactor[]>("/api/crashes/factors", filters)
 */
export async function getContributingFactors(
  filters: CrashFilters = {},
): Promise<ApiResponse<ConditionFactor[]>> {
  void filters;
  return loadFixture<ApiResponse<ConditionFactor[]>>("condition-factors");
}

export async function getHotspots(
  filters: CrashFilters = {},
): Promise<ApiResponse<Hotspot[]>> {
  void filters;
  return loadFixture<ApiResponse<Hotspot[]>>("hotspots");
}
