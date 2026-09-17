"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * Whether the visitor asked the OS for reduced motion.
 *
 * CSS animations are already covered by the global rule in globals.css, but
 * JavaScript-driven animation (Recharts draws its lines with rAF) never sees
 * that rule, so those components must ask explicitly.
 *
 * useSyncExternalStore rather than useState + effect: the server snapshot is
 * `false` (no matchMedia there), the client reads the real value during
 * hydration without a mismatch warning, and changes to the OS setting are
 * picked up live.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
