import { apiGet } from "./http";
import type {
  ApiResponse,
  FeatureImportanceReport,
  ModelMetrics,
  ScenarioGrid,
  ShapSummary,
  TrainingDataProfile,
} from "@/types";

/**
 * The crash-severity model: how it scores, what it leans on, and what it says
 * about chosen conditions.
 *
 * `data` is null when the model has not been trained, and the pages render an
 * explicit "no model" state rather than a plausible-looking number. That rule
 * has held since before the model existed and still does — the API returns
 * the same null with `meta.source: "placeholder"` if a fixture is missing.
 *
 * None of these are filter-aware: the model is trained once on the full
 * dataset, and its scores belong to the held-out test years.
 */
export async function getModelMetrics(): Promise<
  ApiResponse<ModelMetrics | null>
> {
  return apiGet<ModelMetrics | null>("/api/ml/metrics");
}

export async function getFeatureImportance(): Promise<
  ApiResponse<FeatureImportanceReport | null>
> {
  return apiGet<FeatureImportanceReport | null>("/api/ml/feature-importance");
}

export async function getShapSummary(): Promise<ApiResponse<ShapSummary | null>> {
  return apiGet<ShapSummary | null>("/api/ml/explain");
}

export async function getScenarios(): Promise<ApiResponse<ScenarioGrid | null>> {
  return apiGet<ScenarioGrid | null>("/api/ml/scenarios");
}

/** Real facts about the training data and the split the model was fitted on. */
export async function getTrainingDataProfile(): Promise<
  ApiResponse<TrainingDataProfile>
> {
  return apiGet<TrainingDataProfile>("/api/ml/training-data");
}
