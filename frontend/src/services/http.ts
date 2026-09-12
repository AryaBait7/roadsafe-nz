import type { ApiResponse } from "@/types";
import type { CrashFilters } from "@/types";

/**
 * The single place the frontend talks to the Node/Express API.
 *
 * Not wired up yet — it exists so Stage 22 is a change to four service
 * modules and nothing else. No component imports this, or knows it exists.
 */
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";

export function buildQuery(filters: CrashFilters): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function apiGet<T>(
  path: string,
  filters: CrashFilters = {},
): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${path}${buildQuery(filters)}`);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${path}`);
  }

  return (await response.json()) as ApiResponse<T>;
}
