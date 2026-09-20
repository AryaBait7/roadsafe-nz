import type { CrashFilters, CrashSeverity } from "@/types";

/**
 * Filter state lives in the URL, not in React state.
 *
 * Three reasons: a filtered view is shareable and survives refresh; Server
 * Components can read it without a client round-trip; and the query string is
 * already the shape the REST API will take
 * (`/api/crashes/trends?yearFrom=2015&region=Waikato+Region`), so Stage 23
 * changes nothing above the service layer.
 *
 * Everything here is pure so it can run on either side of the boundary: pages
 * parse `searchParams` on the server, the filter panel reads the same keys on
 * the client.
 */

/**
 * The one message both ends show, so the inline error under the year controls
 * and the API's refusal cannot drift apart.
 */
export const YEAR_RANGE_MESSAGE =
  "Start year cannot be later than end year.";

export const SEVERITIES: readonly CrashSeverity[] = [
  "Fatal Crash",
  "Serious Crash",
  "Minor Crash",
  "Non-Injury Crash",
];

/** Raw `searchParams` as Next hands them to a page. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function parseYear(value: string | string[] | undefined): number | undefined {
  const raw = firstValue(value);
  if (raw === undefined) return undefined;

  const year = Number(raw);
  // Reject anything that isn't a plain 4-digit year rather than coercing it —
  // a bad URL should behave as "no filter", never as year 0.
  return Number.isInteger(year) && year >= 1900 && year <= 2200
    ? year
    : undefined;
}

function parseSeverity(
  value: string | string[] | undefined,
): CrashSeverity | undefined {
  const raw = firstValue(value);
  return SEVERITIES.find((severity) => severity === raw);
}

/**
 * Turn a page's `searchParams` into typed filters.
 *
 * Unknown or malformed values are dropped, so a hand-edited URL degrades to a
 * broader result set instead of an error page.
 */
export function parseFilters(params: RawSearchParams): CrashFilters {
  const yearFrom = parseYear(params.yearFrom);
  const yearTo = parseYear(params.yearTo);

  // A reversed range would silently match nothing; swap it instead.
  const [from, to] =
    yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo
      ? [yearTo, yearFrom]
      : [yearFrom, yearTo];

  return {
    yearFrom: from,
    yearTo: to,
    region: firstValue(params.region),
    roadType: firstValue(params.roadType),
    speedEnvironment: firstValue(params.speedEnvironment),
    severity: parseSeverity(params.severity),
  };
}

/** Serialise filters back to a query string, omitting anything unset. */
export function toSearchParams(filters: CrashFilters): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }

  return params;
}

export function activeFilterCount(filters: CrashFilters): number {
  return Object.values(filters).filter(
    (value) => value !== undefined && value !== "",
  ).length;
}

export interface FilterChip {
  key: keyof CrashFilters;
  label: string;
  value: string;
}

/**
 * Human-readable description of what is currently applied, for the summary
 * bar. The year range collapses to one chip because "2015" and "2020" as two
 * separate chips reads as two filters rather than one range.
 */
export function describeFilters(filters: CrashFilters): FilterChip[] {
  const chips: FilterChip[] = [];

  if (filters.yearFrom !== undefined || filters.yearTo !== undefined) {
    const from = filters.yearFrom ?? "earliest";
    const to = filters.yearTo ?? "latest";
    chips.push({
      key: "yearFrom",
      label: "Years",
      value: from === to ? String(from) : `${from} to ${to}`,
    });
  }

  if (filters.region) {
    chips.push({ key: "region", label: "Region", value: filters.region });
  }
  if (filters.roadType) {
    chips.push({ key: "roadType", label: "Road type", value: filters.roadType });
  }
  if (filters.speedEnvironment) {
    chips.push({
      key: "speedEnvironment",
      label: "Speed",
      value: filters.speedEnvironment,
    });
  }
  if (filters.severity) {
    chips.push({ key: "severity", label: "Severity", value: filters.severity });
  }

  return chips;
}

/** URL for the current view minus one filter — powers a chip's remove link. */
export function removeFilterHref(
  pathname: string,
  filters: CrashFilters,
  key: keyof CrashFilters,
): string {
  const next: CrashFilters = { ...filters, [key]: undefined };

  // The year chip represents both ends of the range, so clear them together.
  if (key === "yearFrom") next.yearTo = undefined;

  const query = toSearchParams(next).toString();
  return query ? `${pathname}?${query}` : pathname;
}
