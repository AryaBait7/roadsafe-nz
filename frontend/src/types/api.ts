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
  /** 95% Wilson interval for severeRate, as [low, high]. */
  severeRateInterval: [number, number];
  /**
   * False when that interval contains the baseline: the gap is within what
   * this many crashes could produce by chance, so it is not a finding.
   */
  distinguishable: boolean;
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
  /**
   * Severe rate pulled towards the national rate by how little evidence the
   * area carries (empirical Bayes). A district with 150 crashes showing 15%
   * is mostly noise; this is what to rank and colour by.
   */
  adjustedSevereRate: number;
  /** 95% Wilson interval for the raw severeRate. */
  severeRateInterval: [number, number];
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
/** One candidate's scores on the validation years. */
export interface ModelComparisonRow {
  model: string;
  fitSeconds: number;
  threshold: number;
  precision: number;
  recall: number;
  f1: number;
  rocAuc: number;
  prAuc: number;
  accuracy: number;
  confusionMatrix: ConfusionMatrix;
}

/** Predicted probability against what actually happened, for one bin. */
export interface CalibrationBin {
  predicted: number;
  observed: number;
  crashes: number;
}

export interface ConfusionMatrix {
  trueNegative: number;
  falsePositive: number;
  falseNegative: number;
  truePositive: number;
}

/**
 * GET /api/ml/metrics — the trained model's scores on the held-out test
 * years, plus everything needed to read them honestly: what it was compared
 * against, how the threshold was chosen, and whether its probabilities mean
 * anything.
 */
export interface ModelMetrics {
  modelName: string;
  trainedAt: string;
  precision: number;
  recall: number;
  f1: number;
  rocAuc: number;
  prAuc: number;
  accuracy: number;
  confusionMatrix: ConfusionMatrix;
  /** Probability above which a crash is flagged severe. */
  threshold: number;
  thresholdRule: string;
  trainYears: [number, number];
  validationYears: [number, number];
  testYears: [number, number];
  trainRows: number;
  testRows: number;
  /** Share of test crashes that were actually severe. */
  testPrevalence: number;
  /** What trivial strategies score, so the model's figures have a floor. */
  references: {
    alwaysNotSevereAccuracy: number;
    randomPrAuc: number;
  };
  comparison: ModelComparisonRow[];
  calibration: CalibrationBin[];
  features: string[];
}

/** One chronological slice of the planned training data. */
export interface DatasetSplit {
  name: "Train" | "Validation" | "Test";
  yearFrom: number;
  yearTo: number;
  rows: number;
  severeRows: number;
  severeRate: number;
}

/**
 * GET /api/ml/training-data
 *
 * Facts about the data the model will be trained on. Real now, before any
 * model exists: the target, its class balance and the planned time-based
 * split are properties of the dataset, not results.
 */
export interface TrainingDataProfile {
  target: string;
  positiveLabel: string;
  totalRows: number;
  positiveRows: number;
  /** Share of rows in the positive class, 0–1. */
  prevalence: number;
  splits: DatasetSplit[];
  /** Incomplete year left out of every split, if any. */
  heldOutYear: number | null;
  candidateFeatures: { name: string; description: string }[];
  /** Columns that encode the outcome and must never be model inputs. */
  leakageExcluded: { name: string; reason: string }[];
}

/** GET /api/ml/feature-importance */
export interface FeatureImportanceItem {
  feature: string;
  /** Mean drop in PR-AUC when this input is shuffled. */
  importance: number;
  standardDeviation: number;
}

export interface FeatureImportanceReport {
  model: string;
  method: string;
  items: FeatureImportanceItem[];
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

/** How a column relates to the planned severity model. A plan, not a result. */
export type MlRole = "Target" | "Candidate" | "Excluded" | "No";

/** One CAS column, profiled from the dataset. */
export interface DataDictionaryField {
  name: string;
  group: string;
  /** From DATA_DICTIONARY.md; null if the column is not yet described. */
  description: string | null;
  type: "Integer" | "Decimal" | "Text" | "Boolean" | "Empty";
  /** Most common value, or the first value for all-unique columns. */
  example: string | null;
  /** 0–100. */
  missingPct: number;
  distinct: number;
  /** Created by the pipeline rather than shipped by CAS. */
  derived: boolean;
  usedInDashboard: boolean;
  ml: MlRole;
}

/** GET /api/dataset/dictionary */
export interface DataDictionary {
  rowCount: number;
  columnCount: number;
  sourceFile: string;
  fields: DataDictionaryField[];
}

/** One condition's association with severity, crude and adjusted. */
export interface AssociationTerm {
  factor: string;
  category: string;
  /** The level the odds ratio is measured against. */
  reference: string;
  crashCount: number;
  severeCount: number;
  severeRate: number;
  /** One condition at a time. */
  crude: { oddsRatio: number; interval: [number, number] };
  /** Every condition in one model, so each holds the others fixed. */
  adjusted: { oddsRatio: number; interval: [number, number] };
}

/** GET /api/risk-factors/adjusted — the whole dataset, not the filtered view. */
export interface AdjustedAssociations {
  model: string;
  target: string;
  baselineSevereRate: number;
  pseudoR2: number;
  coverage: {
    totalRows: number;
    modelledRows: number;
    excludedRows: number;
    reason: string;
  };
  terms: AssociationTerm[];
}
