const nzNumber = new Intl.NumberFormat("en-NZ");

/** 705609 -> "705,609" */
export function formatNumber(value: number): string {
  return nzNumber.format(value);
}

/** 0.06724 -> "6.7%" */
export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Compact form for tight spaces: 705609 -> "705.6k" */
export function formatCompact(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}k`;
  return `${(value / 1_000_000).toFixed(2)}m`;
}

/** 2006, 2026 -> "2006–2026" (en dash, per NZ style) */
export function formatYearRange(from: number, to: number): string {
  return from === to ? String(from) : `${from}–${to}`;
}
