"use client";

import Link from "next/link";
import { useCallback } from "react";
import { cn } from "@/lib/cn";
import { INTRO_REPLAY_EVENT } from "./introEvents";
import { LandingNav } from "./LandingNav";
import { RoadScene } from "./RoadScene";
import { useIntroSequence } from "./useIntroSequence";

/**
 * The cinematic hero.
 *
 * All text is present in the DOM from the first render and only its
 * *appearance* is animated, so screen readers and search engines see the full
 * hero regardless of where the sequence has got to. The road itself is
 * decorative and hidden from assistive technology.
 */
export function HeroIntro() {
  const { phase, runId, skip, replay } = useIntroSequence();

  const titleVisible = phase === "title" || phase === "reveal" || phase === "done";
  const contentVisible = phase === "reveal" || phase === "done";
  const finished = phase === "done";

  /**
   * Replaying the intro should give back the whole opening, not just the
   * road: the statistics below count up on arrival, and after a replay they
   * would otherwise stay at their final values. The event is fired here
   * rather than inside the hook because it is a page-level announcement, not
   * part of the timeline.
   */
  const replayAll = useCallback(() => {
    replay();
    window.dispatchEvent(new Event(INTRO_REPLAY_EVENT));
  }, [replay]);

  return (
    <section className="relative flex min-h-screen flex-col overflow-hidden">
      <RoadScene phase={phase} runId={runId} />
      <LandingNav visible={contentVisible} />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        {/* Emerges from the vanishing point: starts small, soft and faint,
            then travels toward the viewer as it sharpens.

            `transform` is set inline rather than through Tailwind's scale and
            translate utilities. v4 composes those into a single transform via
            custom properties, and at identity values it collapses the whole
            thing to `transform: none`. A transition out of `none` has no
            interpolable start value, so the browser animates opacity and blur
            while silently skipping the scale. Two explicit endpoints give it
            something to move between, which is what makes the wordmark travel
            toward the viewer instead of just fading up in place. */}
        <h1
          className="text-5xl font-semibold tracking-tight text-white transition-all duration-[700ms] ease-out sm:text-7xl"
          style={{
            transform: titleVisible
              ? "translateY(0) scale(1)"
              : "translateY(2rem) scale(0.35)",
            opacity: titleVisible ? 1 : 0,
            filter: titleVisible ? "blur(0px)" : "blur(12px)",
          }}
        >
          RoadSafe<span className="text-safety-400"> NZ</span>
        </h1>

        <div
          className={cn(
            "transition-all duration-700 ease-out",
            contentVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
        >
          <p className="mt-6 text-[11px] font-semibold tracking-[0.25em] text-safety-400 uppercase sm:text-xs">
            New Zealand Road Crash Intelligence
          </p>
          <p className="mx-auto mt-3 max-w-lg text-base text-surface-300">
            Turning crash data into safer-road insights.
          </p>

          <Link
            href="/dashboard"
            className="mt-9 inline-flex h-12 items-center rounded-md bg-safety-400 px-7 text-sm font-semibold text-navy-950 transition-colors hover:bg-safety-300"
          >
            Explore road safety data →
          </Link>
        </div>
      </div>

      {/* Skip while running; offer replay once it has finished. */}
      <div className="absolute right-5 bottom-6 z-20">
        {finished ? (
          <button
            type="button"
            onClick={replayAll}
            className="rounded-md px-3 py-1.5 text-[11px] text-surface-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            Replay intro
          </button>
        ) : (
          <button
            type="button"
            onClick={skip}
            className="rounded-md border border-white/20 px-3 py-1.5 text-[11px] text-surface-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            Skip intro
          </button>
        )}
      </div>

      <div
        className={cn(
          "absolute inset-x-0 bottom-7 z-10 flex flex-col items-center gap-1.5 transition-opacity duration-700",
          contentVisible ? "opacity-100" : "opacity-0",
        )}
      >
        <span className="text-[10px] tracking-[0.2em] text-surface-400 uppercase">
          Scroll to explore
        </span>
        <span
          aria-hidden
          className="text-surface-400"
          style={{
            animationName: "scroll-hint",
            animationDuration: "2s",
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
          }}
        >
          ↓
        </span>
      </div>
    </section>
  );
}
