import { loadFixture } from "./fixtures";
import {
  estimateShrinkagePrior,
  shrinkRate,
  wilsonInterval,
} from "@/lib/stats";
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
  AdjustedAssociations,
  HotspotDetail,
  ResponseMeta,
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

  /**
   * One condition, with the uncertainty its sample size allows. A gap from
   * the baseline is only reported as a difference when the interval excludes
   * the baseline — otherwise a thin category's apparent lift is just noise.
   */
  const describe = (
    factor: string,
    category: string,
    crashCount: number,
    severeCount: number,
    isMissingData: boolean,
  ): SeverityLift => {
    const severeRate = rate(severeCount, crashCount);
    const severeRateInterval = wilsonInterval(severeCount, crashCount);

    return {
      factor,
      category,
      crashCount,
      severeCount,
      severeRate,
      lift: severeRate - baseline,
      severeRateInterval,
      distinguishable:
        baseline < severeRateInterval[0] || baseline > severeRateInterval[1],
      isMissingData,
    };
  };

  const addDimension = (
    category: string,
    key: (row: (typeof rows)[number]) => string,
  ) => {
    for (const [value, group] of groupBy(rows, key)) {
      const crashCount = totalCrashes(group);
      if (crashCount === 0) continue;

      const severeCount = severeCrashes(group);

      factors.push(
        describe(value, category, crashCount, severeCount, value === "Unknown"),
      );
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

    factors.push(describe(value, "Holiday period", crashCount, severeCount, false));
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

    factors.push(describe(factor, category, crashCount, severeCount, false));
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
  return rate(
    sum(rows, (row) => (isSevere(row) ? row.crashCount : 0)),
    total,
  );
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

/** CAS's bucket for crashes with no recorded territorial authority. */
const UNKNOWN_AREA = "Unknown";

/** Per-area totals under the filters, including the Unknown bucket. */
async function aggregateAreas(
  filters: CrashFilters,
): Promise<{ areas: Hotspot[]; meta: ResponseMeta }> {
  const { data, meta } =
    await loadFixture<ApiResponse<HotspotFixture>>("hotspots");
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

  const counted = [...totals]
    .map(([index, counts]) => ({ area: data.areas[index], ...counts }))
    .filter((row) => !filters.region || row.area.region === filters.region);

  // The prior is estimated from the areas actually in view, excluding the
  // Unknown bucket: it is not a place, and its rate would distort the pool.
  const prior = estimateShrinkagePrior(
    counted
      .filter((row) => row.area.id !== UNKNOWN_AREA)
      .map((row) => ({ successes: row.severeCount, trials: row.crashCount })),
  );

  const areas = counted.map((row) => ({
    id: row.area.id,
    name: row.area.name,
    region: row.area.region,
    latitude: row.area.latitude,
    longitude: row.area.longitude,
    crashCount: row.crashCount,
    severeCount: row.severeCount,
    severeRate: rate(row.severeCount, row.crashCount),
    adjustedSevereRate: shrinkRate(
      { successes: row.severeCount, trials: row.crashCount },
      prior,
    ),
    severeRateInterval: wilsonInterval(row.severeCount, row.crashCount),
  }));

  return { areas, meta };
}

/**
 * Crash concentrations by territorial authority.
 *
 * Counts are per (area, year, severity) so region, year and severity filters
 * all apply. Road type and speed environment are not carried at this grain
 * and are ignored — the PostGIS query will support them.
 *
 * The Unknown bucket is left out: it is absent information, not a place, and
 * its "centroid" is an average of crashes scattered across the country.
 * `getUnattributedCrashCount` reports its size instead.
 */
export async function getHotspots(
  filters: CrashFilters = {},
): Promise<ApiResponse<Hotspot[]>> {
  const { areas, meta } = await aggregateAreas(filters);

  return {
    data: areas
      .filter((area) => area.id !== UNKNOWN_AREA)
      .sort((a, b) => b.crashCount - a.crashCount),
    meta,
  };
}

/**
 * Crashes matching the filters that have no recorded territorial authority,
 * so the hotspot ranking can say how many it does not cover.
 */
export async function getUnattributedCrashCount(
  filters: CrashFilters = {},
): Promise<number> {
  const { areas } = await aggregateAreas(filters);
  return areas.find((area) => area.id === UNKNOWN_AREA)?.crashCount ?? 0;
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
        // Reuse the ranking's prior so the detail view and the list agree.
        // An area filtered out of the ranking has no pool to borrow from.
        adjustedSevereRate:
          ranking.data.find((hotspot) => hotspot.id === areaId)
            ?.adjustedSevereRate ?? rate(severeTotal, total),
        severeRateInterval: wilsonInterval(severeTotal, total),
      },
      severity,
      trend,
      rank: ranked === -1 ? 0 : ranked + 1,
      totalAreas: ranking.data.length,
    },
    meta,
  };
}

/**
 * Crude and adjusted associations from one logistic regression fitted over
 * the whole dataset by `analyze_associations.py`.
 *
 * Deliberately not filter-aware: refitting per filter would be a different
 * model each time, and a model fitted on a slice cannot be compared with one
 * fitted on another. The page says the filters do not apply here.
 *
 * Later: apiGet<AdjustedAssociations>("/api/risk-factors/adjusted")
 */
export async function getAdjustedAssociations(): Promise<
  ApiResponse<AdjustedAssociations>
> {
  return loadFixture<ApiResponse<AdjustedAssociations>>("adjusted-associations");
}
