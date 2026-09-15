import { loadFixture } from "./fixtures";
import {
  groupBy,
  isLowLight,
  isSevere,
  queryCube,
  rate,
  severeCrashes,
  sum,
  totalCrashes,
} from "./dev/crashCube";
import type {
  ApiResponse,
  CrashFilters,
  CrashTrendPoint,
  HolidayBreakdown,
  LightConditionBreakdown,
  MapCrashPoint,
  RoadTypeBreakdown,
  SeverityBreakdownItem,
} from "@/types";

const SEVERITY_ORDER = [
  "Fatal Crash",
  "Serious Crash",
  "Minor Crash",
  "Non-Injury Crash",
] as const;

/** Later: apiGet<CrashTrendPoint[]>("/api/crashes/trends", filters) */
export async function getTrends(
  filters: CrashFilters = {},
): Promise<ApiResponse<CrashTrendPoint[]>> {
  const { rows, meta } = await queryCube(filters);

  const data = [...groupBy(rows, (row) => row.crashYear)]
    .map(([year, yearRows]) => {
      const total = totalCrashes(yearRows);
      const severe = severeCrashes(yearRows);

      return {
        year,
        totalCrashes: total,
        severeCrashes: severe,
        severeRate: rate(severe, total),
      };
    })
    .sort((a, b) => a.year - b.year);

  return { data, meta };
}

export async function getSeverityBreakdown(
  filters: CrashFilters = {},
): Promise<ApiResponse<SeverityBreakdownItem[]>> {
  const { rows, meta } = await queryCube(filters);
  const total = totalCrashes(rows);

  // Fixed order so the chart's colour mapping is stable across filters.
  const data = SEVERITY_ORDER.map((severity) => {
    const count = sum(rows, (row) =>
      row.crashSeverity === severity ? row.crashCount : 0,
    );

    return { severity, count, share: rate(count, total) };
  }).filter((item) => item.count > 0);

  return { data, meta };
}

/**
 * Stands in for "crashes by time of day". CAS records no time, date, month or
 * weekday — only `crashYear` — so the light condition at the crash is the
 * closest real signal about when it happened.
 */
export async function getLightConditions(
  filters: CrashFilters = {},
): Promise<ApiResponse<LightConditionBreakdown[]>> {
  const { rows, meta } = await queryCube(filters);

  const data = [...groupBy(rows, (row) => row.light)]
    .map(([lightCondition, lightRows]) => {
      const crashCount = totalCrashes(lightRows);
      const severeCount = severeCrashes(lightRows);

      return {
        lightCondition,
        crashCount,
        severeCount,
        severeRate: rate(severeCount, crashCount),
      };
    })
    .sort((a, b) => b.crashCount - a.crashCount);

  return { data, meta };
}

export async function getRoadTypes(
  filters: CrashFilters = {},
): Promise<ApiResponse<RoadTypeBreakdown[]>> {
  const { rows, meta } = await queryCube(filters);

  const data = [...groupBy(rows, (row) => row.roadType)]
    .map(([roadType, typeRows]) => {
      const crashCount = totalCrashes(typeRows);
      const severeCount = severeCrashes(typeRows);

      return {
        roadType,
        crashCount,
        severeCount,
        severeRate: rate(severeCount, crashCount),
      };
    })
    .sort((a, b) => b.crashCount - a.crashCount);

  return { data, meta };
}

/** The only seasonality dimension CAS supports — public-holiday periods. */
export async function getHolidayBreakdown(
  filters: CrashFilters = {},
): Promise<ApiResponse<HolidayBreakdown[]>> {
  const { rows, meta } = await queryCube(filters);

  const data = [...groupBy(rows, (row) => row.holiday)]
    .map(([period, periodRows]) => {
      const crashCount = totalCrashes(periodRows);
      const severeCount = severeCrashes(periodRows);

      return {
        period,
        crashCount,
        severeCount,
        severeRate: rate(severeCount, crashCount),
      };
    })
    .sort((a, b) => b.crashCount - a.crashCount);

  return { data, meta };
}

interface MapCellFixture {
  gridDegrees: number;
  columns: string[];
  rows: number[][];
}

/**
 * Crash density on a fixed grid, aggregated server-side — individual crash
 * coordinates are never published, and 705,609 markers would not render.
 *
 * Only the year filter applies: the grid fixture carries no region, road type
 * or severity dimension, so those filters are ignored here rather than
 * silently returning wrong counts. The real endpoint will honour all of them
 * via PostGIS.
 */
export async function getMapPoints(
  filters: CrashFilters = {},
): Promise<ApiResponse<MapCrashPoint[]>> {
  const { data, meta } = await loadFixture<ApiResponse<MapCellFixture>>(
    "map-cells",
  );
  const at = Object.fromEntries(data.columns.map((name, i) => [name, i]));

  const cells = new Map<string, MapCrashPoint>();

  for (const row of data.rows) {
    const year = row[at.crashYear];
    if (filters.yearFrom !== undefined && year < filters.yearFrom) continue;
    if (filters.yearTo !== undefined && year > filters.yearTo) continue;

    const latitude = row[at.latitude];
    const longitude = row[at.longitude];
    const key = `${latitude},${longitude}`;

    const existing = cells.get(key);
    if (existing) {
      existing.crashCount += row[at.crashCount];
      existing.severeCount += row[at.severeCount];
    } else {
      cells.set(key, {
        latitude,
        longitude,
        crashCount: row[at.crashCount],
        severeCount: row[at.severeCount],
      });
    }
  }

  return { data: [...cells.values()], meta };
}

export { isLowLight, isSevere };
