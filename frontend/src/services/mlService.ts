import type {
  ApiResponse,
  FeatureImportanceItem,
  ModelMetrics,
} from "@/types";

/**
 * Crash-severity model performance and explainability.
 *
 * No model has been trained yet — that is Stage 20. These return `null`
 * rather than invented metrics: publishing a plausible-looking precision or
 * feature ranking would misrepresent model performance, and a reader has no
 * way to tell a placeholder 0.81 from a measured one. The UI renders an
 * explicit "awaiting model" state instead.
 *
 * When the model exists, these read `model-metrics` / `feature-importance`
 * fixtures written by the training script, and `meta.source` becomes "real".
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
