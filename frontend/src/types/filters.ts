import type { CrashSeverity } from "./api";

/**
 * The dashboard filter state.
 *
 * Held in the URL as search params so views are shareable and survive
 * refresh, and so it maps 1:1 onto the future API query string
 * (?yearFrom=2015&yearTo=2025&region=Waikato).
 */
export interface CrashFilters {
  yearFrom?: number;
  yearTo?: number;
  region?: string;
  roadType?: string;
  speedEnvironment?: string;
  severity?: CrashSeverity;
}
