/**
 * Small, dependency-free statistics for rates computed from counts.
 *
 * These run in the service layer because they must follow the sidebar
 * filters: an interval computed once for the national data says nothing
 * about "Waikato, 2020–2024". Model-based estimates that do not depend on
 * filters (adjusted odds ratios) are computed in the Python pipeline instead.
 */

/** Two-sided 95% normal quantile. */
export const Z_95 = 1.959963984540054;

/**
 * Wilson score interval for a binomial proportion.
 *
 * Preferred over the textbook "p ± z·√(p(1−p)/n)" (Wald) interval, which
 * collapses to zero width when p is 0 or 1 and is badly miscalibrated for
 * the small or lopsided counts a filtered view produces.
 */
export function wilsonInterval(
  successes: number,
  trials: number,
  z: number = Z_95,
): [number, number] {
  if (trials <= 0) return [0, 1];

  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const centre = (p + z2 / (2 * trials)) / denominator;
  const halfWidth =
    (z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) /
    denominator;

  return [Math.max(0, centre - halfWidth), Math.min(1, centre + halfWidth)];
}

export interface GroupCounts {
  successes: number;
  trials: number;
}

export interface ShrinkagePrior {
  /** Pooled rate every group is pulled towards. */
  mean: number;
  /**
   * Prior strength in "pseudo-trials": a group with this many real trials is
   * weighted half on its own rate and half on the pooled rate. Infinity means
   * the observed spread is no more than chance, so every group gets the
   * pooled rate.
   */
  strength: number;
}

/**
 * Empirical-Bayes beta-binomial prior, by the method of moments.
 *
 * Small areas produce extreme rates by chance: a district with 150 crashes
 * can show 15% severe with no underlying difference. The observed spread of
 * group rates is split into what binomial noise alone would produce and the
 * genuine between-group variation; the prior carries only the genuine part.
 */
export function estimateShrinkagePrior(groups: GroupCounts[]): ShrinkagePrior {
  const used = groups.filter((g) => g.trials > 0);
  const totalTrials = used.reduce((sum, g) => sum + g.trials, 0);
  if (used.length < 2 || totalTrials === 0) {
    return { mean: totalTrials ? used[0].successes / totalTrials : 0, strength: Infinity };
  }

  const mean = used.reduce((sum, g) => sum + g.successes, 0) / totalTrials;

  // Trial-weighted variance of the observed rates around the pooled rate...
  const observed =
    used.reduce((sum, g) => sum + g.trials * (g.successes / g.trials - mean) ** 2, 0) /
    totalTrials;
  // ...minus the variance binomial noise alone would contribute.
  const noise = (mean * (1 - mean) * used.length) / totalTrials;
  const between = observed - noise;

  if (between <= 0 || mean <= 0 || mean >= 1) {
    return { mean, strength: Infinity };
  }

  return { mean, strength: Math.max(mean * (1 - mean) / between - 1, 0) };
}

/** Posterior-mean rate for one group under the prior. */
export function shrinkRate(group: GroupCounts, prior: ShrinkagePrior): number {
  if (!Number.isFinite(prior.strength)) return prior.mean;
  return (
    (group.successes + prior.mean * prior.strength) /
    (group.trials + prior.strength)
  );
}
