export type NavIconName =
  | "dashboard"
  | "trends"
  | "map"
  | "hotspots"
  | "risk"
  | "ml"
  | "reports"
  | "dictionary";

/**
 * Inline SVG rather than an icon package.
 *
 * Eight single-purpose glyphs do not justify a dependency and its bundle
 * weight, and hand-rolling them keeps stroke weight and optical size
 * consistent with the sidebar's type. Decorative: the adjacent text label is
 * the accessible name, so these are hidden from assistive technology.
 */
const PATHS: Record<NavIconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="2.5" y="2.5" width="6" height="6" rx="1" />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1" />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1" />
    </>
  ),
  trends: (
    <>
      <path d="M3 16V4" />
      <path d="M3 16h14" />
      <path d="M6 13l3.5-4L13 12l4-6" />
    </>
  ),
  map: (
    <>
      <path d="M10 17s5.5-4.9 5.5-9A5.5 5.5 0 0 0 4.5 8c0 4.1 5.5 9 5.5 9Z" />
      <circle cx="10" cy="8" r="2" />
    </>
  ),
  hotspots: (
    <>
      <circle cx="10" cy="10" r="2" />
      <circle cx="10" cy="10" r="5.5" />
      <circle cx="10" cy="10" r="8.5" />
    </>
  ),
  risk: (
    <>
      <path d="M10 3.2 2.8 16.2h14.4L10 3.2Z" />
      <path d="M10 8.4v3.2" />
      <path d="M10 14h.01" />
    </>
  ),
  ml: (
    <>
      <rect x="6" y="6" width="8" height="8" rx="1.5" />
      <path d="M8 3v3M12 3v3M8 14v3M12 14v3M3 8h3M3 12h3M14 8h3M14 12h3" />
    </>
  ),
  reports: (
    <>
      <path d="M5 2.5h6.5L15.5 6.5V17a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5Z" />
      <path d="M11.5 2.5v4h4" />
      <path d="M7.5 11h5M7.5 14h5" />
    </>
  ),
  dictionary: (
    <>
      <path d="M4 3.5h8.5a2 2 0 0 1 2 2v11H6a2 2 0 0 1-2-2v-11Z" />
      <path d="M4 14.5a2 2 0 0 1 2-2h8.5" />
      <path d="M7.5 7h5" />
    </>
  ),
};

export function NavIcon({
  name,
  size = 16,
}: {
  name: NavIconName;
  size?: number;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {PATHS[name]}
    </svg>
  );
}
