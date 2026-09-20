import Link from "next/link";
import { Reveal } from "./Reveal";
import { NewsSection } from "./NewsSection";
import { CountUp, type CountUpFormat } from "@/components/ui/CountUp";
import { INTRO_REPLAY_EVENT } from "./introEvents";
import { NavIcon, type NavIconName } from "@/components/layout/NavIcon";
import type { DashboardSummary, NewsItem } from "@/types";

/**
 * Everything below the hero.
 *
 * A Server Component: only the counters and reveal wrappers are interactive,
 * so the bulk of this ships no JavaScript. The figures are real aggregates
 * passed down from the page, not marketing copy.
 */

const FEATURES: {
  title: string;
  href: string;
  icon: NavIconName;
  description: string;
}[] = [
  {
    title: "Crash Analytics",
    href: "/crash-trends",
    icon: "trends",
    description:
      "Twenty-one years of crash volume and severity, broken down by region, road type and speed environment.",
  },
  {
    title: "Interactive Maps",
    href: "/map-explorer",
    icon: "map",
    description:
      "Every crash placed on the map, aggregated into a density grid you can pan, zoom and filter across the country.",
  },
  {
    title: "Crash Hotspots",
    href: "/hotspots",
    icon: "hotspots",
    description:
      "Which territorial authorities carry the highest crash concentrations, and how severe those crashes are.",
  },
  {
    title: "Risk Factors",
    href: "/risk-factors",
    icon: "risk",
    description:
      "The road, weather and light conditions recorded at severe crashes — reported as associations, never as causes.",
  },
  {
    title: "Machine Learning Insights",
    href: "/ml-insights",
    icon: "ml",
    description:
      "A severity model that estimates how serious a crash is likely to be, given that a crash has occurred.",
  },
  {
    title: "Reports & Data",
    href: "/reports",
    icon: "reports",
    description:
      "Explore reports, key summaries and the data dictionary behind the RoadSafe NZ analysis.",
  },
];

export function LandingSections({
  summary,
  news,
}: {
  summary: DashboardSummary;
  /** null when the updates source could not be reached — see NewsSection. */
  news: NewsItem[] | null;
}) {
  // `format` is a name, not a function: this is a Server Component and only
  // serialisable props may cross into a Client Component.
  const stats: {
    label: string;
    value: number;
    format: CountUpFormat;
    from?: number;
    prefix?: string;
  }[] = [
    {
      label: "Crashes analysed",
      value: summary.totalCrashes,
      format: "number",
    },
    {
      label: "Serious crashes",
      value: summary.seriousCrashes,
      format: "number",
    },
    {
      label: "Fatal crashes",
      value: summary.fatalCrashes,
      format: "number",
    },
    {
      label: "Years covered",
      value: summary.yearTo,
      // Only the end of the range counts up; animating both ends would show a
      // nonsensical range on every intermediate frame. It runs from the start
      // of the range rather than from zero, so every frame is a real range
      // opening out — 2006–2006 through to 2006–2026, never 2006–431. Years
      // are unformatted: grouped thousands would render 2,026.
      format: "plain",
      from: summary.yearFrom,
      prefix: `${summary.yearFrom}–`,
    },
  ];

  return (
    <>
      <section className="border-t border-surface-200 bg-white px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-[11px] font-semibold tracking-[0.22em] text-accent-600 uppercase">
              What is RoadSafe NZ?
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
              A road-safety intelligence platform built on New Zealand&rsquo;s
              official crash record.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-surface-700">
              RoadSafe NZ analyses the Waka Kotahi Crash Analysis System — the
              national record of reported road crashes — to show where, when and
              under what conditions serious crashes happen. It is built for
              people who need evidence rather than anecdote: analysts, planners,
              and anyone asking which roads deserve attention first.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <dl className="mt-14 grid grid-cols-2 gap-x-6 gap-y-9 border-t border-surface-200 pt-10 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label}>
                  {/* A short accent rule instead of an icon: enough hierarchy
                      to separate the figures, without turning restrained
                      statistics into decorated cards. */}
                  <span
                    aria-hidden
                    className="block h-0.5 w-7 rounded-full bg-safety-400"
                  />
                  <dt className="mt-3 text-xs text-surface-500">
                    {stat.label}
                  </dt>
                  <dd className="mt-1.5 text-3xl font-semibold text-navy-900 sm:text-4xl">
                    <CountUp
                      value={stat.value}
                      from={stat.from}
                      format={stat.format}
                      prefix={stat.prefix}
                      restartOn={INTRO_REPLAY_EVENT}
                    />
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-xs text-surface-500">
              Figures are counts from the full CAS dataset. {summary.yearTo} is
              a partial year.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-surface-50 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-[11px] font-semibold tracking-[0.22em] text-accent-600 uppercase">
              What you can explore
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
              Six ways into the data.
            </h2>
          </Reveal>

          {/* Six cards fill a 3 x 2 grid exactly, collapsing to 2 columns on
              tablets and 1 on phones. `items-stretch` plus `h-full` keeps every
              card the same height regardless of description length, and the
              description's `flex-1` pins "Open" to the same baseline. */}
          <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <Reveal key={feature.href} delay={index * 80} className="h-full">
                <Link
                  href={feature.href}
                  className="group flex h-full flex-col rounded-lg border border-surface-200 bg-white p-6 shadow-sm transition-all duration-200 ease-out hover:border-accent-400 hover:shadow-lg focus-visible:border-accent-400 focus-visible:shadow-lg motion-safe:hover:-translate-y-1.5 motion-safe:focus-visible:-translate-y-1.5"
                >
                  <span
                    aria-hidden
                    className="grid size-9 place-items-center rounded-md bg-accent-500/10 text-accent-600 transition-all duration-200 ease-out group-hover:bg-accent-500/15 motion-safe:group-hover:scale-105"
                  >
                    <NavIcon name={feature.icon} size={18} />
                  </span>

                  <h3 className="mt-4 text-sm font-semibold text-navy-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-surface-500">
                    {feature.description}
                  </p>

                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-accent-600">
                    Open
                    <span
                      aria-hidden
                      className="transition-transform duration-200 ease-out motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1"
                    >
                      →
                    </span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <NewsSection items={news} />

      <section className="bg-navy-950 px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Start with the national picture.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-surface-300">
              Headline figures, crash trends, hotspots and the conditions
              associated with severe outcomes — in one view.
            </p>
            <Link
              href="/dashboard"
              className="mt-8 inline-flex h-11 items-center rounded-md bg-safety-400 px-6 text-sm font-semibold text-navy-950 transition-colors hover:bg-safety-300"
            >
              Explore road safety data →
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}

/**
 * Kept outside <main> (see app/page.tsx) so it is exposed as the page's
 * contentinfo landmark.
 */
export function LandingFooter() {
  return (
    <footer className="border-t border-white/10 bg-navy-950 px-6 py-10">
      {/* surface-400, not 500: 500 on navy-950 measured 4.1:1, under the
          4.5:1 AA minimum for body text. */}
      <div className="mx-auto flex max-w-5xl flex-col gap-3 text-xs text-surface-400 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Source: Waka Kotahi NZ Transport Agency, Crash Analysis System (CAS)
          open data.
        </p>
        <p>RoadSafe NZ — a portfolio project. Not an official NZTA service.</p>
      </div>
    </footer>
  );
}
