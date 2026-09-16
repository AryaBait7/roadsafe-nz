import type { CrashSeverity } from "@/types";

/**
 * Chart colour, computed rather than chosen.
 *
 * Every value below was validated with the dataviz skill's
 * `validate_palette.js` against the real card surface (#ffffff, light mode).
 * Re-run it before changing any hex here.
 *
 * SEVERITY — 4 slots, categorical, adjacent pairlist (the segments touch in a
 * stacked bar):
 *   lightness band PASS · chroma floor PASS · CVD separation PASS
 *   (worst adjacent minor↔serious ΔE 15.3 deutan) · normal-vision PASS
 *   (worst serious↔fatal ΔE 15.9) · contrast WARN on `minor` at 2.16:1.
 *
 * That contrast WARN is not dismissable: it obligates a relief channel. Both
 * are shipped — every segment carries a visible value label, and every chart
 * has a table view. Do not remove either without re-validating.
 *
 * Rejected alternatives, so this is not relitigated:
 *  - The reference status scale (good/warning/serious/critical). Yellow and
 *    orange are inherent neighbours in a 4-step status ramp and measure ΔE
 *    8–9 normal vision, 2–3 under protanopia, in every re-stepping tried.
 *    Structurally unfixable, and documented as such in the skill's palette.md.
 *  - A true single-hue ordinal ramp for severity. Fails light-end contrast,
 *    and darkening it makes Non-injury — 69% of the bar — the heaviest
 *    segment, which inverts the emphasis.
 */
export const SEVERITY_COLORS: Record<CrashSeverity, string> = {
  "Fatal Crash": "#a31621",
  "Serious Crash": "#d9534f",
  "Minor Crash": "#e8a33d",
  "Non-Injury Crash": "#2e6fd9",
};

/** Fixed order — severity is an ordered scale, so the sequence is meaningful. */
export const SEVERITY_ORDER: readonly CrashSeverity[] = [
  "Fatal Crash",
  "Serious Crash",
  "Minor Crash",
  "Non-Injury Crash",
];

/**
 * Single-series marks. Nominal categories (regions, road types, conditions)
 * all take this one hue — colouring them by value would re-encode what bar
 * length already shows and burn the identity channel for nothing.
 * 4.78:1 on white.
 */
export const SERIES_1 = "#2e6fd9";

/** De-emphasis for context marks behind an emphasised one. */
export const SERIES_MUTED = "#cbd2de";

/**
 * Sequential ramp for magnitude (the map's density cells). One hue,
 * light→dark. Validated with --ordinal: monotone PASS · adjacent ΔL PASS ·
 * light-end contrast 2.11:1 PASS · single hue (3° spread) PASS.
 *
 * The light end deliberately starts at 2.11:1 rather than something paler —
 * anything lighter dropped below the 2:1 floor and vanished into the surface.
 */
export const SEQUENTIAL_RAMP = ["#86b6ef", "#3987e5", "#1c5cab", "#104281"];

/**
 * Sequential ramp for the dark basemap, low density to high.
 *
 * Not the light ramp reversed. A dark surface needs its own steps validated
 * against it, because "nearest the surface" flips: on white the palest step
 * is at risk of vanishing, on near-black it is the darkest one. Here the
 * dimmest step still clears the surface at 2.71:1, and density reads as
 * brightness, which is what a dark map expects.
 *
 * Validated with --ordinal --mode dark --surface #0e1013:
 * monotone PASS · adjacent ΔL PASS · low-end contrast 2.71:1 PASS ·
 * single hue (7° spread) PASS.
 */
export const SEQUENTIAL_RAMP_DARK = [
  "#1f55b0",
  "#3987e5",
  "#86b6ef",
  "#cde2fb",
];

/** Chart chrome. Hairline, solid, one step off surface — never dashed. */
export const CHART_CHROME = {
  grid: "var(--color-chart-grid)",
  axis: "var(--color-chart-axis)",
  ink: "var(--color-chart-ink)",
  muted: "var(--color-chart-muted)",
  surface: "#ffffff",
} as const;

/** Pick readable text for a label sitting inside a coloured fill. */
export function inkOn(fill: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16));
  // Rec. 601 luma is adequate for a light/dark decision on solid fills.
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#0b1b30" : "#ffffff";
}
