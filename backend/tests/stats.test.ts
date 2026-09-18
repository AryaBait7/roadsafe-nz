import { describe, expect, it } from "vitest";
import { estimateShrinkagePrior, shrinkRate, wilsonInterval } from "../src/stats";

describe("wilsonInterval", () => {
  it("matches the textbook value for 10 of 100", () => {
    const [low, high] = wilsonInterval(10, 100);
    expect(low).toBeCloseTo(0.0552, 4);
    expect(high).toBeCloseTo(0.1744, 4);
  });

  it("stays informative at 0 and n successes, where Wald collapses", () => {
    const [low, high] = wilsonInterval(0, 20);
    expect(low).toBe(0);
    expect(high).toBeCloseTo(0.1611, 4);

    const [allLow, allHigh] = wilsonInterval(20, 20);
    expect(allLow).toBeCloseTo(0.8389, 4);
    expect(allHigh).toBe(1);
  });

  it("narrows as the sample grows", () => {
    const small = wilsonInterval(67, 1_000);
    const large = wilsonInterval(6_700, 100_000);
    expect(large[1] - large[0]).toBeLessThan((small[1] - small[0]) / 5);
  });

  it("returns the whole range when there is no data", () => {
    expect(wilsonInterval(0, 0)).toEqual([0, 1]);
  });
});

describe("empirical-Bayes shrinkage", () => {
  it("pulls a small extreme group much further than a large one", () => {
    const groups = [
      { successes: 30, trials: 100 }, // 30%, small
      { successes: 3_000, trials: 30_000 }, // 10%, large
      { successes: 2_000, trials: 20_000 }, // 10%
      { successes: 1_600, trials: 20_000 }, // 8%
      { successes: 2_400, trials: 20_000 }, // 12%
    ];
    const prior = estimateShrinkagePrior(groups);

    const small = shrinkRate(groups[0], prior);
    const large = shrinkRate(groups[1], prior);

    expect(small).toBeLessThan(0.3);
    expect(small).toBeGreaterThan(prior.mean);
    // The small group moves most of the way to the pool; the large one barely moves.
    expect(0.3 - small).toBeGreaterThan(0.1);
    expect(Math.abs(large - 0.1)).toBeLessThan(0.001);
  });

  it("shrinks everything to the pooled rate when groups differ only by chance", () => {
    const groups = [
      { successes: 10, trials: 100 },
      { successes: 11, trials: 100 },
      { successes: 9, trials: 100 },
      { successes: 10, trials: 100 },
    ];
    const prior = estimateShrinkagePrior(groups);
    expect(prior.strength).toBe(Infinity);
    expect(shrinkRate(groups[1], prior)).toBeCloseTo(0.1, 10);
  });

  it("keeps the pooled rate as the weighted mean", () => {
    const prior = estimateShrinkagePrior([
      { successes: 1, trials: 10 },
      { successes: 30, trials: 90 },
    ]);
    expect(prior.mean).toBeCloseTo(0.31, 10);
  });
});
