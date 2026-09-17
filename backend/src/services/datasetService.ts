import { loadFixture } from "../data/fixtures";
import type { ApiResponse, DataDictionary } from "../types";

/**
 * Column-level metadata for the dataset itself. Types, completeness and
 * examples are measured by `generate_data_dictionary.py`; descriptions come
 * from DATA_DICTIONARY.md. Independent of the sidebar filters.
 *
 * Later: apiGet<DataDictionary>("/api/dataset/dictionary")
 */
export async function getDataDictionary(): Promise<ApiResponse<DataDictionary>> {
  return loadFixture<ApiResponse<DataDictionary>>("data-dictionary");
}
