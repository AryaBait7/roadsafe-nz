import { apiGet } from "./http";
import type {
  AdjustedAssociations,
  ApiResponse,
  ConditionFactor,
  CrashFilters,
  Hotspot,
  HotspotDetail,
  SeverityLiftReport,
} from "@/types";

/**
 * Conditions, hotspots and the associations between them and severity.
 *
 * The statistics these rely on — Wilson intervals, empirical-Bayes shrinkage,
 * the baseline comparison — are computed by the API against the filtered set,
 * so a filtered view carries uncertainty measured for *that* view.
 */
export async function getContributingFactors(
  filters: CrashFilters = {},
): Promise<ApiResponse<ConditionFactor[]>> {
  return apiGet<ConditionFactor[]>("/api/crashes/factors", filters);
}

export async function getSeverityLift(
  filters: CrashFilters = {},
): Promise<ApiResponse<SeverityLiftReport>> {
  return apiGet<SeverityLiftReport>("/api/risk-factors", filters);
}

export async function getBaselineSevereRate(
  filters: CrashFilters = {},
): Promise<number> {
  const { data } = await apiGet<{ baseline: number }>(
    "/api/risk-factors/baseline",
    filters,
  );
  return data.baseline;
}

/**
 * The ranking and the count of crashes it cannot place come back together:
 * the page must state both, and Next memoises the fetch so asking for each
 * costs one request.
 */
interface HotspotsPayload {
  areas: Hotspot[];
  unattributedCrashes: number;
}

async function getHotspotsPayload(filters: CrashFilters) {
  return apiGet<HotspotsPayload>("/api/hotspots", filters);
}

export async function getHotspots(
  filters: CrashFilters = {},
): Promise<ApiResponse<Hotspot[]>> {
  const { data, meta } = await getHotspotsPayload(filters);
  return { data: data.areas, meta };
}

export async function getUnattributedCrashCount(
  filters: CrashFilters = {},
): Promise<number> {
  return (await getHotspotsPayload(filters)).data.unattributedCrashes;
}

export async function getHotspotDetail(
  areaId: string,
  filters: CrashFilters = {},
): Promise<ApiResponse<HotspotDetail | null>> {
  return apiGet<HotspotDetail | null>(
    `/api/hotspots/${encodeURIComponent(areaId)}`,
    filters,
  );
}

/**
 * Crude and adjusted odds ratios from one logistic regression over the whole
 * dataset. Deliberately not filter-aware — see DECISIONS #46.
 */
export async function getAdjustedAssociations(): Promise<
  ApiResponse<AdjustedAssociations>
> {
  return apiGet<AdjustedAssociations>("/api/risk-factors/adjusted");
}
