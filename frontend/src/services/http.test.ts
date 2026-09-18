import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiGet, buildQuery } from "./http";

/**
 * The client, with the network faked. The figures the API returns are
 * asserted by the backend's own tests against the real data; what matters
 * here is that filters reach it unchanged and that failures arrive as
 * something a page can act on.
 */
const ok = (payload: unknown) =>
  vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildQuery", () => {
  it("uses the same keys the URL already carries", () => {
    expect(
      buildQuery({
        yearFrom: 2020,
        yearTo: 2024,
        region: "Waikato Region",
        severity: "Fatal Crash",
      }),
    ).toBe(
      "?yearFrom=2020&yearTo=2024&region=Waikato+Region&severity=Fatal+Crash",
    );
  });

  it("omits unset filters, and returns nothing when there are none", () => {
    expect(buildQuery({ region: undefined, yearTo: 2020 })).toBe("?yearTo=2020");
    expect(buildQuery({})).toBe("");
  });
});

describe("apiGet", () => {
  it("requests the path with filters attached and returns the envelope", async () => {
    const fetchMock = ok({ data: [1, 2], meta: { source: "real" } });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiGet<number[]>("/api/crashes/trends", {
      region: "Otago Region",
    });

    expect(result.data).toEqual([1, 2]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/crashes/trends?region=Otago+Region");
    // Aggregates change only when the pipeline runs.
    expect(options.next.revalidate).toBe(60);
  });

  it("reports an unreachable API as a 503 a page can explain", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const error = await apiGet("/api/crashes/trends").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(503);
    expect(error.code).toBe("api_unreachable");
    expect(error.message).toContain("npm run dev");
  });

  it("passes the API's own error code and message through", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({
          error: { code: "data_unavailable", message: "Fixture missing. Run the pipeline." },
        }),
      } as Response),
    );

    const error = await apiGet("/api/ml/metrics").catch((e) => e);
    expect(error.status).toBe(503);
    expect(error.code).toBe("data_unavailable");
    expect(error.message).toBe("Fixture missing. Run the pipeline.");
  });

  it("still fails usefully when the error body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError("not json");
        },
      } as unknown as Response),
    );

    const error = await apiGet("/api/hotspots").catch((e) => e);
    expect(error.status).toBe(500);
    expect(error.code).toBe("request_failed");
    expect(error.message).toContain("/api/hotspots");
  });
});
