import { describe, expect, it } from "vitest";
import { getSummary, getSummaryComparison } from "./dashboardService";
import {
  getMapPoints,
  getSeverityBreakdown,
  getTrends,
  getUnmappedCrashCount,
} from "./crashService";
import {
  getHotspotDetail,
  getHotspots,
  getSeverityLift,
  getUnattributedCrashCount,
} from "./analyticsService";
import { getModelMetrics, getTrainingDataProfile } from "./mlService";
import { getDataDictionary } from "./datasetService";

/**
 * These run the real services against the real fixtures. Every expected
 * figure below was measured independently from the CAS CSV with pandas, so a
 * change to the aggregation that alters a published number fails here.
 */
const TOTAL = 705_609;

const add = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("national totals reconcile with the CAS dataset", () => {
  it("summary", async () => {
    const { data, meta } = await getSummary();
    expect(data).toEqual({
      totalCrashes: TOTAL,
      seriousCrashes: 41_263,
      fatalCrashes: 6_182,
      peopleKilled: 6_911,
      peopleInjured: 280_236,
      yearFrom: 2006,
      yearTo: 2026,
    });
    expect(meta.source).toBe("real");
  });

  it("every independent path re-totals to the same crash count", async () => {
    const [severity, trends, map, unmapped, hotspots] = await Promise.all([
      getSeverityBreakdown(),
      getTrends(),
      getMapPoints(),
      getUnmappedCrashCount(),
      getHotspots(),
    ]);

    expect(add(severity.data.map((s) => s.count))).toBe(TOTAL);
    expect(add(trends.data.map((t) => t.totalCrashes))).toBe(TOTAL);
    // One 2024 Chatham Islands crash carries placeholder coordinates in the
    // ocean; it is counted everywhere except on the map, which says so.
    expect(unmapped).toBe(1);
    expect(await getUnmappedCrashCount({ yearTo: 2023 })).toBe(0);
    expect(add(map.data.map((p) => p.crashCount)) + unmapped).toBe(TOTAL);
    // 140 crashes have no recorded territorial authority; they are left out
    // of the ranking (not a place) and reported separately.
    const unattributed = await getUnattributedCrashCount();
    expect(unattributed).toBe(140);
    expect(add(hotspots.data.map((h) => h.crashCount)) + unattributed).toBe(
      TOTAL,
    );
  });
});

describe("filtering", () => {
  const waikato = { region: "Waikato Region", yearFrom: 2020, yearTo: 2024 };

  it("Waikato 2020–2024", async () => {
    const { data } = await getSummary(waikato);
    expect([data.totalCrashes, data.seriousCrashes, data.fatalCrashes]).toEqual(
      [19_383, 1_415, 274],
    );
    expect([data.yearFrom, data.yearTo]).toEqual([2020, 2024]);
  });

  it("an impossible filter returns an honest empty result", async () => {
    const { data } = await getSummary({ region: "Nowhere" });
    expect(data.totalCrashes).toBe(0);
    expect([data.yearFrom, data.yearTo]).toEqual([0, 0]);
  });

  it("compares with a previous period only when a range is set", async () => {
    expect((await getSummaryComparison({})).data.previous).toBeNull();

    const { previous } = (await getSummaryComparison(waikato)).data;
    expect(previous).not.toBeNull();
    expect([previous?.yearFrom, previous?.yearTo]).toEqual([2015, 2019]);
  });
});

describe("analytics", () => {
  it("Auckland is the largest hotspot", async () => {
    const { data } = await getHotspots();
    expect(data).toHaveLength(67);
    expect(data.map((h) => h.id)).not.toContain("Unknown");
    expect(data[0]).toMatchObject({
      name: "Auckland",
      crashCount: 237_434,
      severeCount: 10_604,
    });

    const detail = await getHotspotDetail(data[0].id);
    expect(detail.data?.rank).toBe(1);
  });

  it("severity lift keeps known findings and flags missing data", async () => {
    const { data } = await getSeverityLift();
    expect(data.baseline).toBeCloseTo(0.0672, 4);

    const unsealed = data.factors.find((f) => f.factor === "Unsealed road");
    expect(unsealed?.lift).toBeCloseTo(0.0622, 4);

    const unknown = data.factors.filter((f) => f.factor === "Unknown");
    expect(unknown.length).toBeGreaterThan(0);
    expect(unknown.every((f) => f.isMissingData)).toBe(true);
  });
});

describe("ML honesty", () => {
  it("returns no metrics until a model exists", async () => {
    const { data, meta } = await getModelMetrics();
    expect(data).toBeNull();
    expect(meta.source).toBe("placeholder");
  });

  it("splits chronologically on real counts and holds out the partial year", async () => {
    const { data } = await getTrainingDataProfile();
    expect(data.splits.map((s) => s.rows)).toEqual([502_946, 66_976, 121_114]);
    expect(data.heldOutYear).toBe(2026);
    expect(data.positiveRows).toBe(47_445);
  });
});

describe("data dictionary", () => {
  it("profiles all 82 columns and agrees with the ML exclusions", async () => {
    const [{ data }, profile] = await Promise.all([
      getDataDictionary(),
      getTrainingDataProfile(),
    ]);
    // 72 raw columns, minus 3 dropped in cleaning, plus 13 derived.
    expect(data.fields).toHaveLength(82);
    expect(data.fields.map((f) => f.name)).not.toContain("intersection");
    expect(data.fields.filter((f) => f.description === null)).toEqual([]);

    const excluded = data.fields
      .filter((f) => f.ml === "Excluded")
      .map((f) => f.name)
      .sort();
    expect(excluded).toEqual(
      profile.data.leakageExcluded.map((l) => l.name).sort(),
    );
  });
});
