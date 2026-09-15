"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Fades and lifts its children into view the first time they are scrolled to.
 *
 * IntersectionObserver rather than a scroll listener: the browser does the
 * work off the main thread and fires once, instead of running a handler on
 * every scroll frame. Unobserves after triggering so the reveal never repeats.
 *
 * Motion here is decorative, so anyone who has asked for reduced motion gets
 * the content immediately with no transition at all.
 */

/**
 * Resolved during the first client render rather than corrected afterwards in
 * an effect: setting state from an effect would paint one hidden frame before
 * revealing, which for a reduced-motion user is the very flash they opted out
 * of. Returns false on the server, where matchMedia does not exist.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(prefersReducedMotion);

  useEffect(() => {
    const element = ref.current;
    if (!element || shown) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.unobserve(entry.target);
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
    // Runs once: `shown` only ever goes false -> true, and once it is true
    // there is nothing left to observe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
        className,
      )}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
