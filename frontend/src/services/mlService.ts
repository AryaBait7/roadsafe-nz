import { getTrends } from "./crashService";
import { getFilterOptions } from "./dashboardService";
import type {
  ApiResponse,
  DatasetSplit,
  FeatureImportanceItem,
  ModelMetrics,
  TrainingDataProfile,
} from "@/types";

/**
 * Crash-severity model performance and explainability.
 *
 * No model has been trained yet — that is Stage 20. The metric endpoints
 * return `null` rather than invented numbers: a reader cannot tell a
 * placeholder 0.81 precision from a measured one, and a screenshot of that in
 * a portfolio would be a false claim about a model that does not exist.
 */
const AWAITING_MODEL = {
  source: "placeholder",
  note:
    "No model has been trained yet (Stage 20). No figures are shown because " +
    "fabricated metrics cannot be distinguished from measured ones.",
} as const;

export async function getModelMetrics(): Promise<
  ApiResponse<ModelMetrics | null>
> {
  return { data: null, meta: { ...AWAITING_MODEL } };
}

export async function getFeatureImportance(): Promise<
  ApiResponse<FeatureImportanceItem[] | null>
> {
  return { data: null, meta: { ...AWAITING_MODEL } };
}

/**
 * The planned chronological split. Training on the past and testing on the
 * most recent complete years mirrors how the model would actually be used,
 * and the severe rate rose after 2021 — a random split would leak that shift
 * into training and flatter the test score.
 */
const SPLIT_PLAN: Omit<DatasetSplit, "rows" | "severeRows" | "severeRate">[] = [
  { name: "Train", yearFrom: 2006, yearTo: 2019 },
  { name: "Validation", yearFrom: 2020, yearTo: 2021 },
  { name: "Test", yearFrom: 2022, yearTo: 2025 },
];

const CANDIDATE_FEATURES = [
  { name: "Speed environment", description: "Posted speed limit, banded" },
  { name: "Road type", description: "State highway or local, urban or open" },
  { name: "Light condition", description: "Bright sun, overcast, twilight, dark" },
  { name: "Adverse weather", description: "Rain, fog, snow, hail, frost or wind" },
  { name: "Road surface", description: "Sealed, unsealed or end of seal" },
  { name: "Road geometry", description: "Flat or hill road" },
  { name: "Traffic control", description: "Signals, stop, give way or none" },
  { name: "Number of lanes", description: "Lanes at the crash site" },
  { name: "Vehicles involved", description: "Count across vehicle types" },
  { name: "Region", description: "Regional council area" },
  { name: "Holiday period", description: "Public-holiday period, if any" },
];

const LEAKAGE_EXCLUDED = [
  { name: "fatalCount", reason: "Any death makes a crash fatal — it is the label" },
  { name: "seriousInjuryCount", reason: "Defines the Serious category directly" },
  { name: "minorInjuryCount", reason: "Only known after the outcome is recorded" },
  { name: "crashSeverity", reason: "The source of the target itself" },
  { name: "OBJECTID", reason: "A record identifier with no predictive meaning" },
];

/**
 * Real facts about the training data. Always computed over the full dataset:
 * the model is trained once on everything, so the sidebar filters do not
 * apply here.
 *
 * Later: apiGet<TrainingDataProfile>("/api/ml/training-data")
 */
export async function getTrainingDataProfile(): Promise<
  ApiResponse<TrainingDataProfile>
> {
  const [trends, options] = await Promise.all([
    getTrends({}),
    getFilterOptions(),
  ]);

  const heldOutYear = options.data.latestYearIsPartial
    ? options.data.yearMax
    : null;

  const splits: DatasetSplit[] = SPLIT_PLAN.map((plan) => {
    const years = trends.data.filter(
      (p) => p.year >= plan.yearFrom && p.year <= plan.yearTo,
    );
    const rows = years.reduce((sum, p) => sum + p.totalCrashes, 0);
    const severeRows = years.reduce((sum, p) => sum + p.severeCrashes, 0);

    return {
      ...plan,
      rows,
      severeRows,
      severeRate: rows === 0 ? 0 : severeRows / rows,
    };
  });

  const totalRows = trends.data.reduce((sum, p) => sum + p.totalCrashes, 0);
  const positiveRows = trends.data.reduce((sum, p) => sum + p.severeCrashes, 0);

  return {
    data: {
      target: "is_severe",
      positiveLabel: "Serious or fatal crash",
      totalRows,
      positiveRows,
      prevalence: totalRows === 0 ? 0 : positiveRows / totalRows,
      splits,
      heldOutYear,
      candidateFeatures: CANDIDATE_FEATURES,
      leakageExcluded: LEAKAGE_EXCLUDED,
    },
    meta: {
      source: "real",
      note: "Dataset facts and the planned split. No model has been trained.",
    },
  };
}
