"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/formatters";

/**
 * Counts a figure up when it scrolls into view.
 *
 * The animation is decoration; the number is the content. So the value the
 * server renders is the *final* one — search engines, users without
 * JavaScript, and anyone who has asked for reduced motion all read the real
 * figure with no animation involved. Only after hydration does it drop to the
 * starting value to count up, and that happens in a layout effect so it
 * commits before paint and never flashes the final value first.
 *
 * **Why the counters were showing static numbers.** The safety-net timeout
 * used to *latch*: after 4s it set the final value and marked the count as
 * started, so the observer could never run it. On the landing page the stats
 * sit below a full-height hero and the intro alone lasts 6.6s, so nobody
 * reaches them within 4s — the net fired first on every single visit and the
 * count was dead on arrival. The net now guarantees the *value* only; the
 * observer still plays the count whenever the section is genuinely reached.
 * Worst case is a figure that appears without animating, which is the right
 * way round: the number must never be wrong, the motion may be missed.
 */

/**
 * Formatting is selected by name rather than by passing a function in.
 * A Server Component cannot hand a function to a Client Component — only
 * serialisable props cross that boundary — so the formatter lives here and
 * the caller names the one it wants.
 *
 *   number — grouped thousands, for counts
 *   plain  — no grouping, for years (1,999 would be wrong)
 */
export type CountUpFormat = "number" | "plain";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CountUp({
  value,
  from = 0,
  duration = 1300,
  format = "number",
  prefix = "",
  restartOn,
  className,
}: {
  value: number;
  /**
   * Where the count starts. Zero for a total; for a year range the start of
   * the range, because "2006–0" is not a number anyone should see mid-count.
   */
  from?: number;
  duration?: number;
  format?: CountUpFormat;
  /** Static text before the animated figure, e.g. the start of a year range. */
  prefix?: string;
  /**
   * Name of a window event that re-arms the counter. The landing page uses it
   * so replaying the intro gives you the whole opening back, counters
   * included. Kept as a prop rather than an import so this component stays
   * generic — and a string crosses the Server/Client boundary, a callback
   * would not.
   */
  restartOn?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  // Bumped by `restartOn` to re-run the effect below with a fresh observer.
  const [arm, setArm] = useState(0);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;

    // Commits before paint, so the final value is never briefly visible.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplay(from);
  }, [from]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (prefersReducedMotion()) return;

    let frame = 0;
    let settled = 0;

    const run = () => {
      if (started.current) return;
      started.current = true;

      const begin = performance.now();
      const span = value - from;

      const tick = (now: number) => {
        const progress = Math.min((now - begin) / duration, 1);
        // easeOutCubic: quick off the mark, settling into the final value.
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(from + span * eased));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };

      frame = requestAnimationFrame(tick);

      // requestAnimationFrame does not run in a backgrounded tab while
      // setTimeout still does, so this ensures the count cannot be stranded
      // part-way through.
      settled = window.setTimeout(() => setDisplay(value), duration + 600);
    };

    if (typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(value);
      return;
    }

    /**
     * Safety net, deliberately non-latching.
     *
     * Content must never depend on an observer firing: if the observer is
     * never delivered — a suspended document, an exotic browser — this puts
     * the real figure on screen. It does *not* mark the count as started, so
     * the animation still plays if the section is scrolled to later.
     */
    const guarantee = window.setTimeout(() => {
      if (!started.current) setDisplay(value);
    }, 4000);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;

        // Latch and disconnect: without this, scrolling the section in and
        // out would restart the count on every crossing.
        observer.disconnect();
        window.clearTimeout(guarantee);

        // The net may already have written the final figure while the
        // section was off-screen; put it back to the start so the count is
        // visible rather than instant.
        setDisplay(from);
        run();
      },
      { threshold: 0.35 },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(guarantee);
      window.clearTimeout(settled);
    };
  }, [value, from, duration, arm]);

  useEffect(() => {
    if (!restartOn) return;

    const onRestart = () => {
      if (prefersReducedMotion()) return;
      started.current = false;
      setDisplay(from);
      setArm((current) => current + 1);
    };

    window.addEventListener(restartOn, onRestart);
    return () => window.removeEventListener(restartOn, onRestart);
  }, [restartOn, from]);

  const rendered = format === "plain" ? String(display) : formatNumber(display);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {rendered}
    </span>
  );
}
