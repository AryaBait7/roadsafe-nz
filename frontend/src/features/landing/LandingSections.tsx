import Link from "next/link";
import { Reveal } from "./Reveal";
import { formatNumber, formatYearRange } from "@/lib/formatters";
import type { DashboardSummary } from "@/types";

/**
 * Everything below the hero.
 *
 * A Server Component: none of this is interactive beyond the Reveal wrappers,
 * so it ships no JavaScript of its own. The figures are real aggregates
 * passed down from the page, not marketing copy.
 */

const FEATURES = [
  {
    title: "Crash Analytics",
    href: "/crash-trends",
    description:
      "Twenty-one years of crash volume and severity, broken down by region, road type and speed environment.",
  },
  {
    title: "Interactive Maps",
    href: "/map-explorer",
    description:
      "Every crash placed on the map, aggregated into a density grid you can pan, zoom and filter across the country.",
  },
  {
    title: "Crash Hotspots",
    href: "/hotspots",
    description:
      "Which territorial authorities carry the highest crash concentrations, and how severe those crashes are.",
  },
  {
    title: "Risk Factors",
    href: "/risk-factors",
    description:
      "The road, weather and light conditions recorded at severe crashes — reported as associations, never as causes.",
  },
  {
    title: "Machine Learning Insights",
    href: "/ml-insights",
    description:
      "A severity model that estimates how serious a crash is likely to be, given that a crash has occurred.",
  },
] as const;

export function LandingSections({ summary }: { summary: DashboardSummary }) {
  const stats = [
    { value: formatNumber(summary.totalCrashes), label: "Crashes analysed" },
    { value: formatNumber(summary.seriousCrashes), label: "Serious crashes" },
    { value: formatNumber(summary.fatalCrashes), label: "Fatal crashes" },
    {
      value: formatYearRange(summary.yearFrom, summary.yearTo),
      label: "Years covered",
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
            <dl className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 border-t border-surface-200 pt-10 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="text-xs text-surface-500">{stat.label}</dt>
                  <dd className="tabular mt-1.5 text-3xl font-semibold text-navy-900">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-xs text-surface-500">
              Figures are counts from the full CAS dataset. {summary.yearTo} is a
              partial year.
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
              Five ways into the data.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <Reveal key={feature.href} delay={index * 80}>
                <Link
                  href={feature.href}
                  className="group block h-full rounded-lg border border-surface-200 bg-white p-6 shadow-sm transition-colors hover:border-accent-400"
                >
                  <h3 className="text-sm font-semibold text-navy-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-surface-500">
                    {feature.description}
                  </p>
                  <span className="mt-4 inline-block text-xs font-medium text-accent-600 transition-transform group-hover:translate-x-0.5">
                    Open →
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

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

      <footer className="border-t border-white/10 bg-navy-950 px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 text-xs text-surface-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Source: Waka Kotahi NZ Transport Agency, Crash Analysis System (CAS)
            open data.
          </p>
          <p>
            RoadSafe NZ — a portfolio project. Not an official NZTA service.
          </p>
        </div>
      </footer>
    </>
  );
}
