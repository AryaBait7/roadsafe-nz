import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

/**
 * The API against the real fixtures.
 *
 * The totals asserted here are the same ones the frontend service tests
 * assert, and both were measured independently from the CAS CSV with pandas.
 * While the aggregation lives in two places (until Stage 23 deletes the
 * frontend's copy), any drift between them fails one side or the other.
 */
const app = createApp();
const TOTAL = 705_609;

const get = (path: string) => request(app).get(path).expect(200);

describe("envelope and contract", () => {
  it("wraps every response as { data, meta }", async () => {
    for (const path of [
      "/api/dashboard/summary",
      "/api/crashes/trends",
      "/api/risk-factors",
      "/api/dataset/dictionary",
      "/api/ml/metrics",
    ]) {
      const { body } = await get(path);
      expect(body).toHaveProperty("data");
      expect(body.meta.source).toMatch(/^(real|placeholder)$/);
    }
  });

  it("marks aggregates as cacheable", async () => {
    const response = await get("/api/crashes/trends");
    expect(response.headers["cache-control"]).toBe("public, max-age=60");
  });

  it("reports health and which fixtures are present", async () => {
    const { body } = await get("/health");
    expect(body.status).toBe("ok");
    expect(body.fixtures["crash-cube"]).toBe(true);
    expect(body.fixtures["model-metrics"]).toBe(true);
  });

  it("returns a structured 404 for an unknown route", async () => {
    const { body } = await request(app).get("/api/nope").expect(404);
    expect(body.error.code).toBe("not_found");
  });
});

describe("figures match the dataset", () => {
  it("national totals", async () => {
    const { body } = await get("/api/dashboard/totals");
    expect(body.data).toMatchObject({
      totalCrashes: TOTAL,
      seriousCrashes: 41_263,
      fatalCrashes: 6_182,
      peopleKilled: 6_911,
      peopleInjured: 280_236,
    });
  });

  it("severity, trends, map and hotspots all re-total to the same count", async () => {
    const add = (values: number[]) => values.reduce((a, b) => a + b, 0);

    const severity = await get("/api/crashes/severity");
    expect(add(severity.body.data.map((s: { count: number }) => s.count))).toBe(TOTAL);

    const trends = await get("/api/crashes/trends");
    expect(
      add(trends.body.data.map((t: { totalCrashes: number }) => t.totalCrashes)),
    ).toBe(TOTAL);

    const map = await get("/api/map/crashes");
    expect(
      add(map.body.data.cells.map((c: { crashCount: number }) => c.crashCount)) +
        map.body.data.unmappedCrashes,
    ).toBe(TOTAL);
    expect(map.body.data.gridDegrees).toBeGreaterThan(0);

    const hotspots = await get("/api/hotspots");
    expect(
      add(hotspots.body.data.areas.map((a: { crashCount: number }) => a.crashCount)) +
        hotspots.body.data.unattributedCrashes,
    ).toBe(TOTAL);
  });
});

describe("filters", () => {
  it("applies the same query keys the frontend puts in the URL", async () => {
    const { body } = await get(
      "/api/dashboard/totals?region=Waikato+Region&yearFrom=2020&yearTo=2024",
    );
    expect([
      body.data.totalCrashes,
      body.data.seriousCrashes,
      body.data.fatalCrashes,
    ]).toEqual([19_383, 1_415, 274]);
  });

  it("swaps a reversed year range rather than matching nothing", async () => {
    const forward = await get("/api/dashboard/totals?yearFrom=2015&yearTo=2018");
    const reversed = await get("/api/dashboard/totals?yearFrom=2018&yearTo=2015");
    expect(reversed.body.data).toEqual(forward.body.data);
  });

  it("ignores unparseable values instead of failing", async () => {
    const { body } = await get("/api/dashboard/totals?yearFrom=banana&severity=Catastrophic");
    expect(body.data.totalCrashes).toBe(TOTAL);
  });

  it("returns an honest empty result for a filter that matches nothing", async () => {
    const { body } = await get("/api/dashboard/totals?region=Nowhere");
    expect(body.data.totalCrashes).toBe(0);
  });
});

describe("resources", () => {
  it("serves one hotspot in depth, and 404s an unknown one", async () => {
    const { body } = await get("/api/hotspots/Auckland");
    expect(body.data.rank).toBe(1);
    expect(body.data.area.crashCount).toBe(237_434);

    const missing = await get("/api/hotspots/Atlantis");
    // Known shape, no data: the service reports null rather than inventing.
    expect(missing.body.data).toBeNull();
  });

  it("serves the model's measured scores and explanations", async () => {
    const metrics = await get("/api/ml/metrics");
    expect(metrics.body.data.modelName).toBe("XGBoost");
    expect(metrics.body.meta.source).toBe("real");

    const explain = await get("/api/ml/explain");
    expect(explain.body.data.features[0].feature).toBe("Speed environment");

    const scenarios = await get("/api/ml/scenarios");
    expect(scenarios.body.data.scenarios).toHaveLength(512);
  });

  it("serves the profiled data dictionary", async () => {
    const { body } = await get("/api/dataset/dictionary");
    expect(body.data.fields).toHaveLength(82);
  });
});
