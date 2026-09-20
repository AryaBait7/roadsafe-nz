"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * The public site's own navigation, deliberately not the same list as the
 * dashboard sidebar (`components/layout/nav-items.ts`). Map Explorer is
 * offered here as a headline way into the data and left out of the sidebar,
 * where Hotspots and the dashboard's own map panel cover geography.
 */
const LINKS = [
  { label: "Overview", href: "/dashboard" },
  { label: "Crash Trends", href: "/crash-trends" },
  { label: "Map Explorer", href: "/map-explorer" },
  { label: "Hotspots", href: "/hotspots" },
  { label: "Risk Factors", href: "/risk-factors" },
  { label: "ML Insights", href: "/ml-insights" },
  { label: "About the Data", href: "/data-dictionary" },
] as const;

/**
 * Transparent over the hero, solid once the page scrolls under it.
 *
 * Seven links plus a call to action do not fit a phone, and the previous
 * version resolved that by hiding the whole list below 1024px — which is not
 * responsive design, it is amputation: every route except the dashboard
 * became unreachable from the home page. Below that width the same list is
 * now behind a menu button, so nothing is lost at any size.
 */
export function LandingNav({ visible }: { visible: boolean }) {
  const [isScrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuId = useId();

  // Derived, not synchronised in an effect: while the header is hidden during
  // the intro the menu is closed by definition, and an open panel behind an
  // invisible header would hold focus where nobody can see it.
  const isOpen = menuOpen && visible;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Escape closes and hands focus back to the control that opened it, which
    // is what a keyboard user expects and what returns them to their place.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        buttonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || !menuRef.current) return;

      // Keep Tab inside the open menu: the page behind it is inert while it
      // is covering the screen.
      const focusable = menuRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const linkClass = (href: string) =>
    cn(
      "transition-colors",
      pathname === href ? "text-white" : "text-surface-300 hover:text-white",
    );

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-700",
        isScrolled || isOpen
          ? "border-b border-white/10 bg-navy-950/90 backdrop-blur"
          : "bg-transparent",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-white"
        >
          RoadSafe<span className="text-safety-400"> NZ</span>
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-6">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className={cn("text-[13px]", linkClass(link.href))}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="hidden shrink-0 rounded-md bg-safety-400 px-4 py-2 text-[13px] font-semibold text-navy-950 transition-colors hover:bg-safety-300 sm:inline-block"
          >
            Explore dashboard
          </Link>

          <button
            ref={buttonRef}
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={isOpen}
            aria-controls={menuId}
            className="rounded-md p-2 text-surface-200 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <span className="sr-only">
              {isOpen ? "Close menu" : "Open menu"}
            </span>
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
              <path
                d={isOpen ? "M6 6l10 10M16 6L6 16" : "M4 6h14M4 11h14M4 16h14"}
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Rendered only when open, so nothing in it is focusable while closed —
          a `display:none` panel that still holds tab stops is the usual way
          this goes wrong. */}
      {isOpen ? (
        <div
          id={menuId}
          ref={menuRef}
          className="border-t border-white/10 bg-navy-950/95 backdrop-blur lg:hidden"
        >
          <nav aria-label="Main" className="mx-auto max-w-7xl px-5 py-3">
            <ul className="flex flex-col">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={pathname === link.href ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2 py-2.5 text-sm",
                      linkClass(link.href),
                      "hover:bg-white/5",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="mt-3 block rounded-md bg-safety-400 px-4 py-2.5 text-center text-sm font-semibold text-navy-950 transition-colors hover:bg-safety-300"
            >
              Explore dashboard
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
