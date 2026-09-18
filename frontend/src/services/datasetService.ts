import { apiGet } from "./http";
import type { ApiResponse, DataDictionary } from "@/types";

/**
 * Column-level metadata for the dataset itself: measured types, completeness
 * and examples. Independent of the sidebar filters.
 */
export async function getDataDictionary(): Promise<ApiResponse<DataDictionary>> {
  return apiGet<DataDictionary>("/api/dataset/dictionary");
}
