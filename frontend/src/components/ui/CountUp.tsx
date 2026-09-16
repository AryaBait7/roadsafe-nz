"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/formatters";

/**
 * Counts a figure up from zero when it scrolls into view.
 *
 * The animation is decoration; the number is the content. So the value the
 * server renders is the *final* one — search engines, users without
 * JavaScript, and anyone who has asked for reduced motion all read the real
 * figure with no animation involved. Only after hydration does it drop to
 * zero to count up, and that happens in a layout effect so it commits before
 * paint and never flashes the final value first.
 *
 * Safety net: a timeout snaps to the final value if the animation has not
 * finished. requestAnimationFrame does not run in a backgrounded tab while
 * setTimeout still does, so without this a counter could be stranded
 * mid-count for someone who scrolled past in another tab and came back.
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

export function CountUp({
  value,
  duration = 1300,
  format = "number",
  prefix = "",
  className,
}: {
  value: number;
  duration?: number;
  format?: CountUpFormat;
  /** Static text before the animated figure, e.g. the start of a year range. */
  prefix?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Commits before paint, so the final value is never briefly visible.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplay(0);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let settled = 0;

    /**
     * Armed at mount, not inside the observer.
     *
     * An earlier version armed it in the observer callback, which meant that
     * if the observer never fired — an unsupported browser, a suspended
     * document — nothing ever restored the value and the figure sat at zero.
     * Showing "0 crashes analysed" is a far worse failure than showing a
     * figure that did not animate, so the real number is now guaranteed
     * regardless of whether anything else runs.
     */
    const guarantee = window.setTimeout(() => {
      if (started.current) return;
      started.current = true;
      setDisplay(value);
    }, 4000);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;

        // Latch and disconnect: without this, scrolling the section in and
        // out would restart the count on every crossing.
        started.current = true;
        observer.disconnect();
        window.clearTimeout(guarantee);

        const begin = performance.now();

        const tick = (now: number) => {
          const progress = Math.min((now - begin) / duration, 1);
          // easeOutCubic: quick off the mark, settling into the final value.
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplay(Math.round(value * eased));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);

        // requestAnimationFrame does not run in a backgrounded tab while
        // setTimeout still does, so this ensures the count cannot be
        // stranded part-way through.
        settled = window.setTimeout(() => setDisplay(value), duration + 600);
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
  }, [value, duration]);

  const rendered = format === "plain" ? String(display) : formatNumber(display);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {rendered}
    </span>
  );
}
