import { loadFixture } from "./fixtures";
import {
  groupBy,
  isSevere,
  queryCube,
  rate,
  severeCrashes,
  sum,
  totalCrashes,
} from "./dev/crashCube";
import type {
  ApiResponse,
  ConditionFactor,
  CrashFilters,
  CrashSeverity,
  CrashTrendPoint,
  Hotspot,
  HotspotDetail,
  SeverityBreakdownItem,
  SeverityLift,
  SeverityLiftReport,
} from "@/types";

const SEVERITY_ORDER: readonly CrashSeverity[] = [
  "Fatal Crash",
  "Serious Crash",
  "Minor Crash",
  "Non-Injury Crash",
];

const SEVERE: ReadonlySet<string> = new Set(["Fatal Crash", "Serious Crash"]);

/**
 * Conditions recorded as present at crashes — deliberately not "causes".
 *
 * CAS has no contributing-factor or cause column. What it has is the state of
 * the road and environment when the crash was recorded. Reporting these as
 * causes would assert something the data cannot support: fine weather shows a
 * *higher* severe rate than rain in this dataset, which is a correlation with
 * speed, not evidence that clear skies are dangerous.
 *
 * Later: apiGet<ConditionFactor[]>("/api/crashes/factors", filters)
 */
export async function getContributingFactors(
  filters: CrashFilters = {},
): Promise<ApiResponse<ConditionFactor[]>> {
  const { rows, meta } = await queryCube(filters);

  const severeRows = rows.filter(isSevere);

  const factors: ConditionFactor[] = [
    {
      factor: "Adverse weather",
      category: "Weather",
      crashCount: sum(rows, (row) => row.adverseWeather),
      severeCount: sum(severeRows, (row) => row.adverseWeather),
      severeRate: 0,
    },
    {
      factor: "Dark or twilight",
      category: "Light",
      crashCount: sum(rows, (row) =>
        row.light === "Dark" || row.light === "Twilight" ? row.crashCount : 0,
      ),
      severeCount: sum(severeRows, (row) =>
        row.light === "Dark" || row.light === "Twilight" ? row.crashCount : 0,
      ),
      severeRate: 0,
    },
    {
      factor: "No traffic control",
      category: "Traffic control",
      crashCount: sum(rows, (row) => row.noTrafficControl),
      severeCount: sum(severeRows, (row) => row.noTrafficControl),
      severeRate: 0,
    },
    {
      factor: "Hill road",
      category: "Road geometry",
      crashCount: sum(rows, (row) => row.hillRoad),
      severeCount: sum(severeRows, (row) => row.hillRoad),
      severeRate: 0,
    },
    {
      factor: "Unsealed road",
      category: "Road surface",
      crashCount: sum(rows, (row) => row.unsealedRoad),
      severeCount: sum(severeRows, (row) => row.unsealedRoad),
      severeRate: 0,
    },
  ];

  const data = factors
    .map((factor) => ({
      ...factor,
      severeRate: rate(factor.severeCount, factor.crashCount),
    }))
    .filter((factor) => factor.crashCount > 0)
    .sort((a, b) => b.crashCount - a.crashCount);

  return { data, meta };
}

/**
 * Every available condition, measured against the baseline severe rate.
 *
 * This is the Risk Factors page's whole argument: a condition's own severe
 * rate means little on its own, but the gap between it and the overall rate
 * says whether crashes under that condition tend to be worse.
 *
 * Deliberately reports *association*, never cause. CAS has no causal field,
 * and the data actively punishes the assumption — adverse weather sits below
 * the baseline, almost certainly because bad conditions suppress speed.
 *
 * Later: apiGet<SeverityLiftReport>("/api/risk-factors", filters)
 */
export async function getSeverityLift(
  filters: CrashFilters = {},
): Promise<ApiResponse<SeverityLiftReport>> {
  const { rows, meta } = await queryCube(filters);

  const total = totalCrashes(rows);
  const baseline = rate(severeCrashes(rows), total);

  const factors: SeverityLift[] = [];

  const addDimension = (
    category: string,
    key: (row: (typeof rows)[number]) => string,
  ) => {
    for (const [value, group] of groupBy(rows, key)) {
      const crashCount = totalCrashes(group);
      if (crashCount === 0) continue;

      const severeCount = severeCrashes(group);
      const severeRate = rate(severeCount, crashCount);

      factors.push({
        factor: value,
        category,
        crashCount,
        severeCount,
        severeRate,
        lift: severeRate - baseline,
        isMissingData: value === "Unknown",
      });
    }
  };

  addDimension("Speed environment", (row) => row.speedEnvironment);
  addDimension("Light", (row) => row.light);
  addDimension("Road type", (row) => row.roadType);

  // Holiday periods only: "Not a holiday period" is the complement of the
  // others, not a condition, and at 94% of crashes it simply restates the
  // baseline.
  for (const [value, group] of groupBy(rows, (row) => row.holiday)) {
    if (value === "Not a holiday period") continue;

    const crashCount = totalCrashes(group);
    if (crashCount === 0) continue;

    const severeCount = severeCrashes(group);
    const severeRate = rate(severeCount, crashCount);

    factors.push({
      factor: value,
      category: "Holiday period",
      crashCount,
      severeCount,
      severeRate,
      lift: severeRate - baseline,
      isMissingData: false,
    });
  }

  // Condition flags are counts of crashes where the condition was recorded,
  // so they are summed rather than grouped.
  const severeRows = rows.filter(isSevere);
  const flags: [string, string, (row: (typeof rows)[number]) => number][] = [
    ["Adverse weather", "Weather", (row) => row.adverseWeather],
    ["Unsealed road", "Road surface", (row) => row.unsealedRoad],
    ["Hill road", "Road geometry", (row) => row.hillRoad],
    ["No traffic control", "Traffic control", (row) => row.noTrafficControl],
  ];

  for (const [factor, category, pick] of flags) {
    const crashCount = sum(rows, pick);
    if (crashCount === 0) continue;

    const severeCount = sum(severeRows, pick);
    const severeRate = rate(severeCount, crashCount);

    factors.push({
      factor,
      category,
      crashCount,
      severeCount,
      severeRate,
      lift: severeRate - baseline,
      isMissingData: false,
    });
  }

  factors.sort((a, b) => b.lift - a.lift);

  return { data: { baseline, factors }, meta };
}

/**
 * Baseline severe rate for the same filter set, so a condition's rate can be
 * read as better or worse than average rather than in isolation.
 */
export async function getBaselineSevereRate(
  filters: CrashFilters = {},
): Promise<number> {
  const { rows } = await queryCube(filters);
  const total = totalCrashes(rows);
  return rate(sum(rows, (row) => (isSevere(row) ? row.crashCount : 0)), total);
}

interface HotspotFixture {
  areas: {
    id: string;
    name: string;
    region: string;
    latitude: number;
    longitude: number;
  }[];
  columns: string[];
  rows: (string | number)[][];
}

/**
 * Crash concentrations by territorial authority.
 *
 * Counts are per (area, year, severity) so region, year and severity filters
 * all apply. Road type and speed environment are not carried at this grain
 * and are ignored — the PostGIS query will support them.
 */
export async function getHotspots(
  filters: CrashFilters = {},
): Promise<ApiResponse<Hotspot[]>> {
  const { data, meta } = await loadFixture<ApiResponse<HotspotFixture>>(
    "hotspots",
  );
  const at = Object.fromEntries(data.columns.map((name, i) => [name, i]));

  const totals = new Map<number, { crashCount: number; severeCount: number }>();

  for (const row of data.rows) {
    const year = row[at.crashYear] as number;
    const severity = row[at.crashSeverity] as string;

    if (filters.yearFrom !== undefined && year < filters.yearFrom) continue;
    if (filters.yearTo !== undefined && year > filters.yearTo) continue;
    if (filters.severity && severity !== filters.severity) continue;

    const index = row[at.areaIndex] as number;
    const count = row[at.crashCount] as number;
    const severe =
      severity === "Fatal Crash" || severity === "Serious Crash" ? count : 0;

    const running = totals.get(index);
    if (running) {
      running.crashCount += count;
      running.severeCount += severe;
    } else {
      totals.set(index, { crashCount: count, severeCount: severe });
    }
  }

  const hotspots = [...totals]
    .map(([index, counts]) => {
      const area = data.areas[index];

      return {
        id: area.id,
        name: area.name,
        region: area.region,
        latitude: area.latitude,
        longitude: area.longitude,
        crashCount: counts.crashCount,
        severeCount: counts.severeCount,
        severeRate: rate(counts.severeCount, counts.crashCount),
      };
    })
    .filter((hotspot) => !filters.region || hotspot.region === filters.region)
    .sort((a, b) => b.crashCount - a.crashCount);

  return { data: hotspots, meta };
}

/**
 * One area in depth.
 *
 * The hotspot fixture is stored per (area, year, severity), so severity
 * composition and a year-by-year trend both fall straight out of it — no
 * extra data is needed for the detail view, only a different grouping of
 * rows the ranking already reads.
 *
 * Later: apiGet<HotspotDetail>(`/api/hotspots/${areaId}`, filters)
 */
export async function getHotspotDetail(
  areaId: string,
  filters: CrashFilters = {},
): Promise<ApiResponse<HotspotDetail | null>> {
  const [{ data, meta }, ranking] = await Promise.all([
    loadFixture<ApiResponse<HotspotFixture>>("hotspots"),
    getHotspots(filters),
  ]);

  const at = Object.fromEntries(data.columns.map((name, i) => [name, i]));
  const index = data.areas.findIndex((area) => area.id === areaId);

  if (index === -1) return { data: null, meta };

  const bySeverity = new Map<string, number>();
  const byYear = new Map<number, { total: number; severe: number }>();

  for (const row of data.rows) {
    if ((row[at.areaIndex] as number) !== index) continue;

    const year = row[at.crashYear] as number;
    const severity = row[at.crashSeverity] as string;
    const count = row[at.crashCount] as number;

    if (filters.yearFrom !== undefined && year < filters.yearFrom) continue;
    if (filters.yearTo !== undefined && year > filters.yearTo) continue;
    if (filters.severity && severity !== filters.severity) continue;

    bySeverity.set(severity, (bySeverity.get(severity) ?? 0) + count);

    const running = byYear.get(year) ?? { total: 0, severe: 0 };
    running.total += count;
    if (SEVERE.has(severity)) running.severe += count;
    byYear.set(year, running);
  }

  const total = [...bySeverity.values()].reduce((sum, n) => sum + n, 0);

  // The area may fall outside the ranking entirely — for example when a
  // region filter excludes it — so its own totals are recomputed here rather
  // than assumed to be present in `ranking`.
  const ranked = ranking.data.findIndex((hotspot) => hotspot.id === areaId);
  const severeTotal = [...bySeverity]
    .filter(([severity]) => SEVERE.has(severity))
    .reduce((sum, [, count]) => sum + count, 0);

  const source = data.areas[index];

  const severity: SeverityBreakdownItem[] = SEVERITY_ORDER.map((level) => ({
    severity: level,
    count: bySeverity.get(level) ?? 0,
    share: rate(bySeverity.get(level) ?? 0, total),
  })).filter((item) => item.count > 0);

  const trend: CrashTrendPoint[] = [...byYear]
    .map(([year, counts]) => ({
      year,
      totalCrashes: counts.total,
      severeCrashes: counts.severe,
      severeRate: rate(counts.severe, counts.total),
    }))
    .sort((a, b) => a.year - b.year);

  return {
    data: {
      area: {
        id: source.id,
        name: source.name,
        region: source.region,
        latitude: source.latitude,
        longitude: source.longitude,
        crashCount: total,
        severeCount: severeTotal,
        severeRate: rate(severeTotal, total),
      },
      severity,
      trend,
      rank: ranked === -1 ? 0 : ranked + 1,
      totalAreas: ranking.data.length,
    },
    meta,
  };
}
