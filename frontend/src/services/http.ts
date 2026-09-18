import type { ApiResponse, CrashFilters } from "@/types";

/**
 * The single place the frontend talks to the Express API.
 *
 * Services call this; components never do. Everything above the service layer
 * still receives `ApiResponse<T>`, which is why swapping the data source for
 * HTTP changed only the service bodies.
 *
 * Requests run on the server (pages are Server Components), so the API needs
 * no public origin and `API_BASE_URL` is a server-side variable.
 */
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000";

/** Aggregates change only when the pipeline runs. */
const REVALIDATE_SECONDS = 60;

const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

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
  const url = `${API_BASE_URL}${path}${buildQuery(filters)}`;

  let response: Response;
  try {
    // Next memoises identical fetches within one render, so several services
    // reading the same endpoint cost one request.
    response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    });
  } catch (cause) {
    // A refused connection or a timeout is the API being down, which the page
    // should report as such rather than as a broken page. The underlying
    // error is logged server-side; the message that reaches the page says
    // what to do about it.
    console.error(`API request to ${url} failed:`, cause);
    throw new ApiError(
      `Could not reach the API at ${API_BASE_URL}. Is it running? (cd backend && npm run dev)`,
      503,
      "api_unreachable",
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null;

    throw new ApiError(
      body?.error?.message ?? `Request to ${path} failed with ${response.status}.`,
      response.status,
      body?.error?.code ?? "request_failed",
    );
  }

  return (await response.json()) as ApiResponse<T>;
}
