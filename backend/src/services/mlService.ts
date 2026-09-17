import { getTrends } from "./crashService";
import { getFilterOptions } from "./dashboardService";
import { loadFixture } from "../data/fixtures";
import type {
  ApiResponse,
  DatasetSplit,
  FeatureImportanceReport,
  ModelMetrics,
  ScenarioGrid,
  ShapSummary,
  TrainingDataProfile,
} from "../types";

/**
 * Crash-severity model performance and explainability.
 *
 * The model is trained by `data-pipeline/src/train_model.py`, which writes
 * these fixtures. Until Stage 20 they returned null rather than invented
 * numbers; the same rule still applies, so a missing fixture surfaces as
 * "no model" instead of a plausible-looking score.
 *
 * Not filter-aware: the model is trained once on the full dataset, and its
 * scores belong to the held-out test years, not to whatever the sidebar is
 * showing.
 */
async function loadModelFixture<T>(name: string): Promise<ApiResponse<T> | null> {
  try {
    return await loadFixture<ApiResponse<T>>(name);
  } catch (error) {
    if ((error as Error).name === "FixtureMissingError") return null;
    throw error;
  }
}

const NO_MODEL = {
  source: "placeholder",
  note:
    "No trained model is available. Run train_model.py in data-pipeline/ to " +
    "produce it. No figures are shown because fabricated metrics cannot be " +
    "distinguished from measured ones.",
} as const;

export async function getModelMetrics(): Promise<
  ApiResponse<ModelMetrics | null>
> {
  const fixture = await loadModelFixture<ModelMetrics>("model-metrics");
  return fixture ?? { data: null, meta: { ...NO_MODEL } };
}

/**
 * SHAP explanations for the trained model: which inputs push a prediction
 * towards or away from "severe", and by how much.
 *
 * Later: apiGet<ShapSummary>("/api/ml/explain")
 */
export async function getShapSummary(): Promise<ApiResponse<ShapSummary | null>> {
  const fixture = await loadModelFixture<ShapSummary>("shap-summary");
  return fixture ?? { data: null, meta: { ...NO_MODEL } };
}

/**
 * Model predictions for every combination of the conditions the scenario
 * explorer offers, scored in the pipeline. Shipping the grid rather than the
 * model keeps the browser free of a runtime, and the numbers are the model's
 * own rather than an approximation of it.
 *
 * Later: apiGet<ScenarioGrid>("/api/ml/scenarios") — or a live prediction
 * endpoint, once there is a server that can host the model.
 */
export async function getScenarios(): Promise<ApiResponse<ScenarioGrid | null>> {
  const fixture = await loadModelFixture<ScenarioGrid>("scenarios");
  return fixture ?? { data: null, meta: { ...NO_MODEL } };
}

export async function getFeatureImportance(): Promise<
  ApiResponse<FeatureImportanceReport | null>
> {
  const fixture = await loadModelFixture<FeatureImportanceReport>(
    "feature-importance",
  );
  return fixture ?? { data: null, meta: { ...NO_MODEL } };
}

/**
 * The chronological split the model was trained on. Training on the past and
 * testing on the
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
      note: "Dataset facts and the split the model was trained on.",
    },
  };
}
