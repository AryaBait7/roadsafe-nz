/**
 * Response contracts for the RoadSafe NZ API.
 *
 * These types are the agreed shape between frontend and backend. Today they
 * are satisfied by generated fixtures; from Stage 22 they are satisfied by the
 * Node/Express API reading PostgreSQL. Neither side may change a shape here
 * without the other — that is the point of this file.
 *
 * Field names map to real CAS columns. Nothing here is invented: if a value
 * cannot be derived from the dataset, it is not in this file.
 */

/** The four CAS severity categories, verbatim from the `crashSeverity` column. */
export type CrashSeverity =
  | "Fatal Crash"
  | "Serious Crash"
  | "Minor Crash"
  | "Non-Injury Crash";

/**
 * Every response is enveloped so the UI can always tell real aggregates from
 * placeholders. A panel backed by `placeholder` renders a visible badge —
 * mock numbers must never appear as though they were NZTA findings.
 */
export interface ApiResponse<T> {
  data: T;
  meta: ResponseMeta;
}

export interface ResponseMeta {
  source: "real" | "placeholder";
  /** Why this is a placeholder, or what the real figures were derived from. */
  note?: string;
  /** ISO timestamp of when the underlying aggregate was computed. */
  generatedAt?: string;
}

/** GET /api/dashboard/summary */
export interface DashboardSummary {
  totalCrashes: number;
  seriousCrashes: number;
  fatalCrashes: number;
  /** Sum of `fatalCount`. */
  peopleKilled: number;
  /** Sum of `seriousInjuryCount` + `minorInjuryCount`. */
  peopleInjured: number;
  yearFrom: number;
  yearTo: number;
}

/**
 * GET /api/crashes/trends
 *
 * Year granularity only: CAS as published has no month, day or timestamp
 * column — `crashYear` is the finest time resolution available.
 */
export interface CrashTrendPoint {
  year: number;
  totalCrashes: number;
  severeCrashes: number;
  /** severeCrashes / totalCrashes, 0–1. */
  severeRate: number;
}

/** GET /api/crashes/severity */
export interface SeverityBreakdownItem {
  severity: CrashSeverity;
  count: number;
  /** Share of all crashes in the filtered set, 0–1. */
  share: number;
}

/**
 * GET /api/crashes/factors
 *
 * CAS has no "cause" or "contributing factor" column. These are *conditions
 * recorded as present* at the crash (weather, surface, light, traffic
 * control), which is a different and weaker claim than causation.
 */
export interface ConditionFactor {
  /** e.g. "Unsealed road" */
  factor: string;
  /** Source column group, e.g. "Road surface" */
  category: string;
  crashCount: number;
  severeCount: number;
  severeRate: number;
}

/**
 * GET /api/crashes/light-conditions
 *
 * Stands in for the "time of day" panel: CAS has no time field, so the
 * `light` column (Bright sun / Overcast / Twilight / Dark / Unknown) is the
 * closest real signal about conditions at the time of the crash.
 */
export interface LightConditionBreakdown {
  lightCondition: string;
  crashCount: number;
  severeCount: number;
  severeRate: number;
}

/** GET /api/crashes/road-types */
export interface RoadTypeBreakdown {
  roadType: string;
  crashCount: number;
  severeCount: number;
  severeRate: number;
}

/**
 * GET /api/risk-factors
 *
 * Each condition's severe rate measured against the overall baseline, so the
 * question "is this associated with worse outcomes" has a reference point
 * rather than a bare percentage.
 */
export interface SeverityLift {
  factor: string;
  /** Which dimension it came from, e.g. "Speed environment". */
  category: string;
  crashCount: number;
  severeCount: number;
  severeRate: number;
  /** severeRate minus baseline, in percentage points. */
  lift: number;
  /**
   * True when the category represents *absent information* rather than a
   * real condition — CAS's "Unknown" buckets. These produce some of the
   * largest apparent lifts in the dataset and must never be presented as
   * findings.
   */
  isMissingData: boolean;
}

export interface SeverityLiftReport {
  /** Overall severe rate for the current filter set. */
  baseline: number;
  factors: SeverityLift[];
}

/**
 * GET /api/crashes/regions
 *
 * One row per regional council area. Used for comparison, not as chart
 * series: 16 regions is far past the eight-slot categorical ceiling, so this
 * is ranked bars and a table rather than sixteen lines.
 */
export interface RegionBreakdown {
  region: string;
  crashCount: number;
  severeCount: number;
  severeRate: number;
}

/**
 * GET /api/crashes/severity-trends
 *
 * One series per severity level, shaped for small multiples. Deliberately not
 * a single multi-series chart: Non-Injury (485,478) and Fatal (6,182) cannot
 * share a y-axis without flattening the levels that matter most.
 */
export interface SeverityTrendSeries {
  severity: CrashSeverity;
  points: { year: number; value: number }[];
}

/**
 * GET /api/hotspots/{areaId}
 *
 * One territorial authority in depth: its totals under the current filters,
 * how its crashes break down by severity, how it has moved year to year, and
 * where it sits in the national ranking.
 */
export interface HotspotDetail {
  area: Hotspot;
  severity: SeverityBreakdownItem[];
  trend: CrashTrendPoint[];
  /** 1-based position by crash count among areas with any crashes. */
  rank: number;
  totalAreas: number;
}

/** GET /api/hotspots */
export interface Hotspot {
  id: string;
  /** Territorial authority or named location. */
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  crashCount: number;
  severeCount: number;
  severeRate: number;
}

/**
 * GET /api/map/crashes
 *
 * Aggregated points, never raw rows — 705,609 individual crashes are not
 * shippable to a browser, and the API will not serve them either.
 */
export interface MapCrashPoint {
  latitude: number;
  longitude: number;
  crashCount: number;
  severeCount: number;
  /** Modal region for the cell — used for filtering and popup context. */
  region: string;
}

/** GET /api/ml/metrics — placeholder until a model is trained in Stage 19. */
export interface ModelMetrics {
  modelName: string;
  precision: number;
  recall: number;
  f1: number;
  rocAuc: number;
  prAuc: number;
  confusionMatrix: {
    trueNegative: number;
    falsePositive: number;
    falseNegative: number;
    truePositive: number;
  };
  /** Chronological split boundaries, e.g. trainYears [2006, 2021]. */
  trainYears: [number, number];
  testYears: [number, number];
}

/** GET /api/ml/feature-importance — placeholder until Stage 19/20. */
export interface FeatureImportanceItem {
  feature: string;
  importance: number;
}

/** Available options for the sidebar filters, derived from the dataset. */
export interface FilterOptions {
  regions: string[];
  roadTypes: string[];
  speedEnvironments: string[];
  severities: CrashSeverity[];
  lightConditions: string[];
  yearMin: number;
  yearMax: number;
  /**
   * The most recent year is a partial year of data. Trend charts exclude it
   * by default so the series does not appear to collapse at the right edge.
   */
  latestYearIsPartial: boolean;
  partialYearNote: string | null;
}

/**
 * GET /api/crashes/holidays
 *
 * The closest thing CAS offers to seasonality: crashes are tagged with the
 * public-holiday period they fell in, or none. There is no month or
 * day-of-week column to chart instead.
 */
export interface HolidayBreakdown {
  period: string;
  crashCount: number;
  severeCount: number;
  severeRate: number;
}
