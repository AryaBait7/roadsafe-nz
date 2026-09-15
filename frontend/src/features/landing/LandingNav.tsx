"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const LINKS = [
  { label: "Overview", href: "/dashboard" },
  { label: "Crash Trends", href: "/crash-trends" },
  { label: "Map Explorer", href: "/map-explorer" },
  { label: "Hotspots", href: "/hotspots" },
  { label: "Risk Factors", href: "/risk-factors" },
  { label: "ML Insights", href: "/ml-insights" },
  { label: "About the Data", href: "/data-dictionary" },
] as const;

/** Transparent over the hero, solid once the page scrolls under it. */
export function LandingNav({ visible }: { visible: boolean }) {
  const [isScrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-700",
        isScrolled
          ? "border-b border-white/10 bg-navy-950/90 backdrop-blur"
          : "bg-transparent",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5">
        <Link href="/" className="text-base font-semibold tracking-tight text-white">
          RoadSafe<span className="text-safety-400"> NZ</span>
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-6">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-[13px] text-surface-300 transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Link
          href="/dashboard"
          className="shrink-0 rounded-md bg-safety-400 px-4 py-2 text-[13px] font-semibold text-navy-950 transition-colors hover:bg-safety-300"
        >
          Explore dashboard
        </Link>
      </div>
    </header>
  );
}
