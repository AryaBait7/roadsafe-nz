"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Drives the landing intro's timeline.
 *
 * A phase machine rather than pure CSS animation-delays, because the sequence
 * has to be interruptible (Skip), repeatable (Replay), and skippable outright
 * for users who ask for reduced motion or who have already seen it this
 * session. CSS delays alone cannot be cancelled mid-flight.
 *
 *   travel   0.0-3.0s  camera moves down the road at speed
 *   slowing  3.0-4.0s  deceleration, navy overlay fades in
 *   title    4.0-5.0s  wordmark emerges from the vanishing point
 *   reveal   5.0-6.0s  tagline, CTA and navigation appear
 *   done              final resting state
 */
export type IntroPhase = "travel" | "slowing" | "title" | "reveal" | "done";

const TIMELINE: { phase: IntroPhase; at: number }[] = [
  { phase: "slowing", at: 3000 },
  { phase: "title", at: 4000 },
  { phase: "reveal", at: 5000 },
  { phase: "done", at: 6200 },
];

const SESSION_KEY = "roadsafe:intro-played";

/** sessionStorage throws in some private-browsing modes; never break on it. */
function hasPlayedThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markPlayed(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Storage unavailable — the intro simply plays again next visit.
  }
}

/**
 * Whether this visitor should bypass the sequence entirely.
 *
 * Reads browser-only APIs, so it must never influence the *first* render:
 * the server has no matchMedia and no sessionStorage, so deciding there
 * produces markup the client disagrees with. Resolving it in a lazy
 * useState initialiser did exactly that — the server rendered `travel`
 * (scale 0.35, opacity 0) while a returning client rendered `done`, and
 * React reported a hydration mismatch.
 */
function shouldSkipIntro(): boolean {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    hasPlayedThisSession()
  );
}

export function useIntroSequence() {
  // Always "travel" on the first render, matching the server exactly.
  const [phase, setPhase] = useState<IntroPhase>("travel");
  const [runId, setRunId] = useState(0);

  /**
   * Shared between the two effects below. A ref rather than state because the
   * timer effect is keyed on `runId`, so it would otherwise close over a
   * stale `phase`: on first mount the layout effect sets "done", but the
   * timer effect's captured `phase` is still "travel", its guard passes, and
   * it arms the whole timeline anyway — replaying the intro at 3s/4s/5s for
   * exactly the visitors who were meant to skip it. Reading a ref gets the
   * current decision instead of the one captured at render time.
   */
  const skipped = useRef(false);

  /**
   * useLayoutEffect, not useEffect: it commits before the browser paints, so
   * a returning or reduced-motion visitor never sees a frame of the intro.
   * That keeps the no-flash behaviour without letting browser-only state
   * leak into the render the server has to match.
   */
  // Runs once per mount. A replay deliberately re-runs the sequence and must
  // not be cancelled by this check.
  useLayoutEffect(() => {
    if (!shouldSkipIntro()) return;

    skipped.current = true;
    // set-state-in-effect is disabled deliberately, not worked around. The
    // rule catches state that could have been derived during render — but
    // this value cannot be: matchMedia and sessionStorage do not exist on the
    // server, and reading them during render is precisely what caused the
    // hydration mismatch this effect replaced. Correcting the state before
    // paint is the intended escape hatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("done");
  }, []);

  const skip = useCallback(() => {
    skipped.current = true;
    setPhase("done");
    markPlayed();
  }, []);

  // Bumping runId re-arms the timers below.
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
    const completion = window.setTimeout(markPlayed, 6200);

    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(completion);
    };
    // Keyed on runId, not phase: the effect arms the whole timeline once per
    // run. Re-running it on every phase change would restart every timer at
    // each step.
  }, [runId]);

  const isMoving = phase === "travel" || phase === "slowing";

  return { phase, isMoving, skip, replay };
}
