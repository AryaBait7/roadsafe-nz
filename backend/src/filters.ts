import type { CrashFilters, CrashSeverity } from "./types";

/**
 * Filter state lives in the URL, not in React state.
 *
 * Three reasons: a filtered view is shareable and survives refresh; Server
 * Components can read it without a client round-trip; and the query string is
 * already the shape the REST API will take
 * (`/api/crashes/trends?yearFrom=2015&region=Waikato+Region`), so Stage 23
 * changes nothing above the service layer.
 *
 * The API parses the same query keys the frontend already puts in the URL.
 * Unknown values are dropped rather than rejected, so a hand-edited URL
 * degrades to a broader result set instead of an error page.
 *
 * A reversed year range is the one exception. It used to be swapped silently,
 * which is friendly until you realise the caller asked one question and got
 * the answer to another; for an API that is worse than a refusal. It is now
 * a 400 with the same message the filter panel shows, so a client that skips
 * the UI cannot quietly receive figures for a range it did not request.
 */

/**
 * The one message both ends show, so the inline error under the year controls
 * and the API's refusal cannot drift apart.
 */
export const YEAR_RANGE_MESSAGE =
  "Start year cannot be later than end year.";

/** A filter the caller got wrong — answered with 400, not 500. */
export class InvalidFilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFilterError";
  }
}

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

  if (yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo) {
    throw new InvalidFilterError(YEAR_RANGE_MESSAGE);
  }

  return {
    yearFrom,
    yearTo,
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
