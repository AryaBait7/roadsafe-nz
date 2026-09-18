import { apiGet } from "./http";
import type {
  ApiResponse,
  CrashFilters,
  CrashTrendPoint,
  HolidayBreakdown,
  LightConditionBreakdown,
  MapCrashPoint,
  RegionBreakdown,
  RoadTypeBreakdown,
  SeverityBreakdownItem,
  SeverityTrendSeries,
} from "@/types";

/**
 * Crash aggregates over time, condition and place.
 *
 * Every function is now a call to the API, which does the grouping. The
 * shapes are unchanged from when this module read files directly, so nothing
 * above it moved.
 */
export async function getTrends(
  filters: CrashFilters = {},
): Promise<ApiResponse<CrashTrendPoint[]>> {
  return apiGet<CrashTrendPoint[]>("/api/crashes/trends", filters);
}

export async function getSeverityBreakdown(
  filters: CrashFilters = {},
): Promise<ApiResponse<SeverityBreakdownItem[]>> {
  return apiGet<SeverityBreakdownItem[]>("/api/crashes/severity", filters);
}

export async function getSeverityTrends(
  filters: CrashFilters = {},
): Promise<ApiResponse<SeverityTrendSeries[]>> {
  return apiGet<SeverityTrendSeries[]>("/api/crashes/severity-trends", filters);
}

export async function getLightConditions(
  filters: CrashFilters = {},
): Promise<ApiResponse<LightConditionBreakdown[]>> {
  return apiGet<LightConditionBreakdown[]>("/api/crashes/light", filters);
}

export async function getRoadTypes(
  filters: CrashFilters = {},
): Promise<ApiResponse<RoadTypeBreakdown[]>> {
  return apiGet<RoadTypeBreakdown[]>("/api/crashes/road-types", filters);
}

export async function getRegionBreakdown(
  filters: CrashFilters = {},
): Promise<ApiResponse<RegionBreakdown[]>> {
  return apiGet<RegionBreakdown[]>("/api/crashes/regions", filters);
}

export async function getHolidayBreakdown(
  filters: CrashFilters = {},
): Promise<ApiResponse<HolidayBreakdown[]>> {
  return apiGet<HolidayBreakdown[]>("/api/crashes/holidays", filters);
}

/**
 * The map's grid comes back in one response — cells, resolution and the
 * count of crashes with no usable location — because a map cannot draw or
 * caption itself without all three. The three accessors below read that one
 * response; Next memoises the fetch, so asking for all three costs one
 * request.
 */
interface MapPayload {
  gridDegrees: number;
  unmappedCrashes: number;
  cells: MapCrashPoint[];
}

async function getMap(filters: CrashFilters) {
  return apiGet<MapPayload>("/api/map/crashes", filters);
}

export async function getMapPoints(
  filters: CrashFilters = {},
): Promise<ApiResponse<MapCrashPoint[]>> {
  const { data, meta } = await getMap(filters);
  return { data: data.cells, meta };
}

export async function getMapGridDegrees(
  filters: CrashFilters = {},
): Promise<number> {
  return (await getMap(filters)).data.gridDegrees;
}

export async function getUnmappedCrashCount(
  filters: CrashFilters = {},
): Promise<number> {
  return (await getMap(filters)).data.unmappedCrashes;
}
