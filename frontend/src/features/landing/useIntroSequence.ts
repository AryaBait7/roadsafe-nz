"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Drives the landing intro's timeline.
 *
 * A phase machine rather than pure CSS animation-delays, because the sequence
 * has to be interruptible (Skip), repeatable (Replay), and skippable outright
 * for users who ask for reduced motion. CSS delays alone cannot be cancelled
 * mid-flight.
 *
 *   travel   0.0-3.0s  camera accelerates down the road
 *   slowing  3.0-4.2s  deceleration begins, sign is clearly approaching
 *   title    4.2-5.4s  arrival at the sign, which is now readable
 *   reveal   5.4-6.6s  strapline and call to action
 *   done              final resting state
 *
 * The home page is the cinematic entry point, so the intro plays on **every**
 * visit to "/". It is deliberately not suppressed after the first play: an
 * earlier version stored a flag in sessionStorage, which meant returning home
 * gave you a static hero and the site quietly lost its opening.
 */
export type IntroPhase = "travel" | "slowing" | "title" | "reveal" | "done";

const TIMELINE: { phase: IntroPhase; at: number }[] = [
  { phase: "slowing", at: 3000 },
  { phase: "title", at: 4200 },
  { phase: "reveal", at: 5400 },
  { phase: "done", at: 6600 },
];

/**
 * Whether this visitor should bypass the sequence entirely.
 *
 * Reads a browser-only API, so it must never influence the *first* render:
 * the server has no matchMedia, so deciding there produces markup the client
 * disagrees with. Resolving it in a lazy useState initialiser did exactly
 * that and React reported a hydration mismatch.
 */
function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useIntroSequence() {
  // Always "travel" on the first render, matching the server exactly.
  const [phase, setPhase] = useState<IntroPhase>("travel");
  const [runId, setRunId] = useState(0);

  /**
   * Shared between the two effects below. A ref rather than state because the
   * timer effect is keyed on `runId`, so it would otherwise close over a
   * stale `phase` and arm the whole timeline for someone who should skip it.
   */
  const skipped = useRef(false);

  /**
   * useLayoutEffect, not useEffect: it commits before the browser paints, so
   * a reduced-motion visitor never sees a frame of the intro. That keeps the
   * no-flash behaviour without letting browser-only state leak into the
   * render the server has to match.
   */
  useLayoutEffect(() => {
    if (!prefersReducedMotion()) return;

    skipped.current = true;
    // set-state-in-effect is disabled deliberately, not worked around. The
    // rule catches state that could have been derived during render — but
    // this value cannot be: matchMedia does not exist on the server, and
    // reading it during render is what caused the hydration mismatch this
    // effect replaced.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("done");
  }, []);

  const skip = useCallback(() => {
    skipped.current = true;
    setPhase("done");
  }, []);

  const replay = useCallback(() => {
    skipped.current = false;
    setPhase("travel");
    setRunId((id) => id + 1);
  }, []);

  useEffect(() => {
    if (skipped.current) return;

    const timers = TIMELINE.map(({ phase: next, at }) =>
      window.setTimeout(() => setPhase(next), at),
    );

    return () => timers.forEach(window.clearTimeout);
    // Keyed on runId, not phase: the effect arms the whole timeline once per
    // run. Re-running it on every phase change would restart every timer at
    // each step.
  }, [runId]);

  const isMoving = phase !== "done";

  return { phase, isMoving, skip, replay };
}
