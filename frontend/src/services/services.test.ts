import { describe, expect, it } from "vitest";
import { getSummary, getSummaryComparison } from "./dashboardService";
import {
  getMapPoints,
  getSeverityBreakdown,
  getTrends,
  getUnmappedCrashCount,
} from "./crashService";
import {
  getAdjustedAssociations,
  getHotspotDetail,
  getHotspots,
  getSeverityLift,
  getUnattributedCrashCount,
} from "./analyticsService";
import {
  getFeatureImportance,
  getModelMetrics,
  getTrainingDataProfile,
} from "./mlService";
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

describe("the trained model", () => {
  it("reports measured test-year scores, not placeholders", async () => {
    const { data, meta } = await getModelMetrics();
    expect(meta.source).toBe("real");
    expect(data).not.toBeNull();

    const model = data!;
    expect(model.modelName).toBe("XGBoost");
    // Scored once on 2022-2025, which the model never saw.
    expect(model.testYears).toEqual([2022, 2025]);
    expect(model.trainYears).toEqual([2006, 2019]);
    expect(model.testRows).toBe(121_114);

    // The headline claim: better than ranking at random, and honest about it.
    expect(model.prAuc).toBeGreaterThan(model.references.randomPrAuc * 1.5);
    expect(model.prAuc).toBeLessThan(0.5);
    expect(model.rocAuc).toBeGreaterThan(0.6);

    // The confusion matrix must add up to the test rows, and agree with
    // the reported precision and recall.
    const c = model.confusionMatrix;
    expect(
      c.truePositive + c.trueNegative + c.falsePositive + c.falseNegative,
    ).toBe(model.testRows);
    expect(c.truePositive / (c.truePositive + c.falsePositive)).toBeCloseTo(
      model.precision,
      6,
    );
    expect(c.truePositive / (c.truePositive + c.falseNegative)).toBeCloseTo(
      model.recall,
      6,
    );
  });

  it("beats every other candidate it was compared against", async () => {
    const { data } = await getModelMetrics();
    const model = data!;
    const others = model.comparison.filter(
      (row) => row.model !== model.modelName,
    );

    expect(others.length).toBeGreaterThan(0);
    const chosen = model.comparison.find(
      (row) => row.model === model.modelName,
    )!;
    for (const row of others) {
      expect(chosen.prAuc).toBeGreaterThanOrEqual(row.prAuc);
    }
    // The trivial reference has no ranking ability at all.
    const dummy = model.comparison.find((r) => r.model.startsWith("Always"))!;
    expect(dummy.rocAuc).toBeCloseTo(0.5, 3);
  });

  it("ranks features by measured permutation importance", async () => {
    const { data, meta } = await getFeatureImportance();
    expect(meta.source).toBe("real");
    expect(data!.items.length).toBeGreaterThan(3);
    const values = data!.items.map((i) => i.importance);
    expect([...values].sort((a, b) => b - a)).toEqual(values);
    expect(values.every((v) => v > 0)).toBe(true);
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

describe("uncertainty and adjustment (Stage 19)", () => {
  it("every condition carries an interval that brackets its own rate", async () => {
    const { data } = await getSeverityLift();

    for (const factor of data.factors) {
      const [low, high] = factor.severeRateInterval;
      expect(low).toBeLessThanOrEqual(factor.severeRate);
      expect(high).toBeGreaterThanOrEqual(factor.severeRate);
      // "Distinguishable" must mean exactly "the interval misses the baseline".
      expect(factor.distinguishable).toBe(
        data.baseline < low || data.baseline > high,
      );
    }
  });

  it("keeps large clear differences and flags thin ones", async () => {
    const { data } = await getSeverityLift();
    const unsealed = data.factors.find((f) => f.factor === "Unsealed road");
    expect(unsealed?.distinguishable).toBe(true);

    // On a single year of one region, most conditions cannot be told apart
    // from the baseline; the national view must not claim otherwise.
    const slice = await getSeverityLift({
      region: "Nelson Region",
      yearFrom: 2019,
      yearTo: 2019,
    });
    expect(slice.data.factors.some((f) => !f.distinguishable)).toBe(true);
  });

  it("pulls small areas towards the pooled rate, and leaves Auckland alone", async () => {
    const { data } = await getHotspots();
    const auckland = data[0];
    expect(
      Math.abs(auckland.adjustedSevereRate - auckland.severeRate),
    ).toBeLessThan(0.001);

    const smallest = [...data].sort((a, b) => a.crashCount - b.crashCount)[0];
    const pooled =
      data.reduce((sum, a) => sum + a.severeCount, 0) /
      data.reduce((sum, a) => sum + a.crashCount, 0);
    // The least-evidenced area moves further towards the pool than Auckland.
    expect(Math.abs(smallest.adjustedSevereRate - pooled)).toBeLessThan(
      Math.abs(smallest.severeRate - pooled),
    );
  });

  it("adjusted associations show the confounding the page describes", async () => {
    const { data, meta } = await getAdjustedAssociations();
    expect(meta.source).toBe("real");
    expect(data.coverage.modelledRows).toBe(694_205);

    const unsealed = data.terms.find((t) => t.factor === "Unsealed road");
    // Crude ~1.95 vs adjusted ~1.11: most of it is the roads it sits on.
    expect(unsealed!.crude.oddsRatio).toBeGreaterThan(1.8);
    expect(unsealed!.adjusted.oddsRatio).toBeLessThan(1.3);

    const speed = data.terms.find((t) => t.factor === "81-100 km/h");
    expect(speed!.adjusted.oddsRatio).toBeGreaterThan(speed!.crude.oddsRatio);

    for (const term of data.terms) {
      expect(term.adjusted.interval[0]).toBeLessThanOrEqual(
        term.adjusted.oddsRatio,
      );
      expect(term.adjusted.interval[1]).toBeGreaterThanOrEqual(
        term.adjusted.oddsRatio,
      );
    }
  });
});
