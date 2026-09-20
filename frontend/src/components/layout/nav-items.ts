import type { NavIconName } from "./NavIcon";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIconName;
  /** Shown under the page title. */
  description: string;
}

/**
 * Single source of truth for dashboard navigation — sidebar and drawer share it.
 *
 * Map Explorer is deliberately absent: the standalone page and its route are
 * untouched and still work, it is simply not offered as a primary
 * destination. Geography is reached through the Hotspots map and the
 * dashboard's map panel, which use the same components and the same API.
 */
export const navItems: readonly NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "dashboard",
    description: "Headline crash figures and the main breakdowns at a glance.",
  },
  {
    label: "Crash Trends",
    href: "/crash-trends",
    icon: "trends",
    description: "How crash volume and severity have shifted year to year.",
  },
  {
    label: "Hotspots",
    href: "/hotspots",
    icon: "hotspots",
    description: "Territorial authorities with the highest crash concentrations.",
  },
  {
    label: "Risk Factors",
    href: "/risk-factors",
    icon: "risk",
    description:
      "Road, weather and light conditions recorded at severe crashes.",
  },
  {
    label: "ML Insights",
    href: "/ml-insights",
    icon: "ml",
    description:
      "Severity model performance and the factors driving its predictions.",
  },
  {
    label: "Reports",
    href: "/reports",
    icon: "reports",
    description: "Exportable summaries of the current view.",
  },
  {
    label: "Data Dictionary",
    href: "/data-dictionary",
    icon: "dictionary",
    description: "Every CAS field used, what it means, and how complete it is.",
  },
] as const;
