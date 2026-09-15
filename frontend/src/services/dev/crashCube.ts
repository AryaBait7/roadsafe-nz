import { loadFixture } from "../fixtures";
import type { ApiResponse, CrashFilters, CrashSeverity, ResponseMeta } from "@/types";

/**
 * Temporary in-memory query engine over the aggregate crash cube.
 *
 * `crash-cube.json` holds real CAS data pre-aggregated to the grain the
 * dashboard filters on: (year, region, roadType, speedEnvironment, severity,
 * light, holiday) with crash/casualty/condition counts. Every dashboard
 * figure except the map and hotspots is a group-by over this cube.
 *
 * This deliberately mirrors the SQL the analytics layer will run later — the
 * filters become a WHERE clause and the grouping becomes GROUP BY. When the
 * Express API lands, this whole directory is deleted and the services call
 * `apiGet` instead.
 *
 * Server-side only.
 */

/** Column-oriented on disk: a `columns` header plus rows of bare values. */
interface ColumnarFixture {
  columns: string[];
  rows: (string | number)[][];
}

export interface CubeRow {
  crashYear: number;
  region: string;
  roadType: string;
  speedEnvironment: string;
  crashSeverity: CrashSeverity;
  light: string;
  holiday: string;
  crashCount: number;
  peopleKilled: number;
  seriousInjuries: number;
  minorInjuries: number;
  adverseWeather: number;
  unsealedRoad: number;
  hillRoad: number;
  noTrafficControl: number;
}

export interface Cube {
  rows: CubeRow[];
  meta: ResponseMeta;
}

const SEVERE: ReadonlySet<string> = new Set(["Fatal Crash", "Serious Crash"]);
const LOW_LIGHT: ReadonlySet<string> = new Set(["Dark", "Twilight"]);

export function isSevere(row: CubeRow): boolean {
  return SEVERE.has(row.crashSeverity);
}

export function isLowLight(row: CubeRow): boolean {
  return LOW_LIGHT.has(row.light);
}

function decode({ columns, rows }: ColumnarFixture): CubeRow[] {
  const at = Object.fromEntries(columns.map((name, index) => [name, index]));

  return rows.map((row) => ({
    crashYear: row[at.crashYear] as number,
    region: row[at.region] as string,
    roadType: row[at.roadType] as string,
    speedEnvironment: row[at.speedEnvironment] as string,
    crashSeverity: row[at.crashSeverity] as CrashSeverity,
    light: row[at.light] as string,
    holiday: row[at.holiday] as string,
    crashCount: row[at.crashCount] as number,
    peopleKilled: row[at.peopleKilled] as number,
    seriousInjuries: row[at.seriousInjuries] as number,
    minorInjuries: row[at.minorInjuries] as number,
    adverseWeather: row[at.adverseWeather] as number,
    unsealedRoad: row[at.unsealedRoad] as number,
    hillRoad: row[at.hillRoad] as number,
    noTrafficControl: row[at.noTrafficControl] as number,
  }));
}

/**
 * Cached as a promise, not a value, so concurrent requests during the first
 * read share one parse instead of each decoding 47k rows.
 */
let cached: Promise<Cube> | null = null;

export function loadCube(): Promise<Cube> {
  cached ??= loadFixture<ApiResponse<ColumnarFixture>>("crash-cube").then(
    (response) => ({ rows: decode(response.data), meta: response.meta }),
  );

  return cached;
}

/** The WHERE clause. Undefined filters match everything. */
export function applyFilters(rows: CubeRow[], filters: CrashFilters): CubeRow[] {
  return rows.filter((row) => {
    if (filters.yearFrom !== undefined && row.crashYear < filters.yearFrom) return false;
    if (filters.yearTo !== undefined && row.crashYear > filters.yearTo) return false;
    if (filters.region && row.region !== filters.region) return false;
    if (filters.roadType && row.roadType !== filters.roadType) return false;
    if (
      filters.speedEnvironment &&
      row.speedEnvironment !== filters.speedEnvironment
    ) {
      return false;
    }
    if (filters.severity && row.crashSeverity !== filters.severity) return false;
    return true;
  });
}

export async function queryCube(filters: CrashFilters): Promise<Cube> {
  const cube = await loadCube();
  return { rows: applyFilters(cube.rows, filters), meta: cube.meta };
}

export function sum(rows: CubeRow[], pick: (row: CubeRow) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

export function totalCrashes(rows: CubeRow[]): number {
  return sum(rows, (row) => row.crashCount);
}

export function severeCrashes(rows: CubeRow[]): number {
  return sum(rows, (row) => (isSevere(row) ? row.crashCount : 0));
}

/** GROUP BY one dimension, preserving insertion order of first appearance. */
export function groupBy<K extends string | number>(
  rows: CubeRow[],
  key: (row: CubeRow) => K,
): Map<K, CubeRow[]> {
  const groups = new Map<K, CubeRow[]>();

  for (const row of rows) {
    const value = key(row);
    const bucket = groups.get(value);
    if (bucket) bucket.push(row);
    else groups.set(value, [row]);
  }

  return groups;
}

/** Guards against 0/0 when a filter combination matches nothing. */
export function rate(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}
