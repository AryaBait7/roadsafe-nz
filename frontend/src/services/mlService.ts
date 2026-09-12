import { loadFixture } from "./fixtures";
import type {
  ApiResponse,
  FeatureImportanceItem,
  ModelMetrics,
} from "@/types";

/**
 * Model performance and explainability.
 *
 * No model exists until Stage 19, so both fixtures are marked
 * `meta.source: "placeholder"` and the UI renders them behind a visible
 * placeholder badge. These numbers are not NZTA findings and are not
 * presented as any.
 */
export async function getModelMetrics(): Promise<ApiResponse<ModelMetrics>> {
  return loadFixture<ApiResponse<ModelMetrics>>("model-metrics");
}

export async function getFeatureImportance(): Promise<
  ApiResponse<FeatureImportanceItem[]>
> {
  return loadFixture<ApiResponse<FeatureImportanceItem[]>>("feature-importance");
}
