"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { navItems } from "./nav-items";
import { NavIcon } from "./NavIcon";
import { FilterPanel } from "./FilterPanel";
import type { FilterOptions } from "@/types";

function Brand() {
  return (
    <Link href="/" className="block px-3.5 py-3.5">
      <span className="block text-[15px] leading-tight font-semibold tracking-tight text-white">
        RoadSafe<span className="text-safety-400"> NZ</span>
      </span>
      <span className="mt-0.5 block text-[10px] text-surface-400">
        Road Crash Intelligence
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard sections" className="px-2">
      <ul className="space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                  isActive
                    ? "bg-navy-700 font-medium text-white"
                    : "text-surface-300 hover:bg-navy-800 hover:text-white",
                )}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SidebarContent({
  options,
  onNavigate,
}: {
  options?: FilterOptions;
  onNavigate?: () => void;
}) {
  return (
    <>
      <Brand />
      <NavLinks onNavigate={onNavigate} />
      {/* useSearchParams would otherwise opt the whole route out of static
          rendering; suspending it keeps the shell prerendered. */}
      <Suspense fallback={<div className="h-64" />}>
        <FilterPanel options={options} />
      </Suspense>
    </>
  );
}

export function Sidebar({ options }: { options?: FilterOptions }) {
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDrawerOpen) return;

    // Modal behaviour: focus moves in, Tab cannot leave, and focus returns
    // to whichever control opened the drawer when it closes.
    const opener = document.activeElement as HTMLElement | null;
    const drawer = drawerRef.current;
    drawer?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawer) return;

      const focusable = drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === drawer)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [isDrawerOpen]);

  return (
    <>
      {/* Desktop: always-visible column */}
      <aside className="hidden w-52 shrink-0 overflow-y-auto bg-navy-950 lg:block print:hidden">
        <SidebarContent options={options} />
      </aside>

      {/* Mobile: top bar + drawer */}
      <header className="flex h-14 items-center gap-3 bg-navy-950 px-4 lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-expanded={isDrawerOpen}
          aria-controls="mobile-nav"
          className="rounded-md p-1.5 text-surface-300 hover:bg-navy-800 hover:text-white"
        >
          <span className="sr-only">Open navigation and filters</span>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
            <path
              d="M3 5h14M3 10h14M3 15h14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <Link href="/" className="text-sm font-semibold text-white">
          RoadSafe<span className="text-safety-400"> NZ</span>
        </Link>
        {/* The filters live in the drawer on small screens; a labelled
            control makes that discoverable, where the hamburger alone does not. */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-expanded={isDrawerOpen}
          aria-controls="mobile-nav"
          className="ml-auto flex h-8 items-center gap-1.5 rounded-md border border-navy-700 px-2.5 text-xs font-medium text-surface-200 hover:bg-navy-800 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
            <path
              d="M2 4h12M4.5 8h7M7 12h2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Filters
        </button>
      </header>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-navy-950/60"
          />
          <div
            id="mobile-nav"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation and filters"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-navy-950"
          >
            <div className="flex justify-end px-2 pt-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-md p-1.5 text-surface-300 hover:bg-navy-800 hover:text-white"
              >
                <span className="sr-only">Close navigation</span>
                <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
                  <path
                    d="M5 5l10 10M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <SidebarContent
              options={options}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
