import { Reveal } from "./Reveal";
import { NewsCard } from "./NewsCard";
import type { NewsItem } from "@/types";

/**
 * Road safety updates, from the agency that publishes the data.
 *
 * `items` is null when the API could not reach the source and has nothing
 * cached. The section then says so in one line. It does not fall back to
 * skeletons or sample headlines: on a platform whose entire argument is that
 * its figures are real, a placeholder article is indistinguishable from an
 * invented one.
 */
export function NewsSection({ items }: { items: NewsItem[] | null }) {
  const shown = items?.slice(0, 3) ?? [];

  return (
    <section className="border-t border-surface-200 bg-white px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-accent-600 uppercase">
            Road safety updates
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
            Latest insights &amp; updates.
          </h2>
          <p className="mt-4 max-w-2xl text-sm text-surface-500">
            Published by the NZ Transport Agency, read from its open data
            portal. Each card links to the agency&rsquo;s own page.
          </p>
        </Reveal>

        {shown.length > 0 ? (
          <div className="mt-10 grid items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((item, index) => (
              <Reveal key={item.id} delay={index * 80} className="h-full">
                <NewsCard item={item} />
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal>
            <p className="mt-8 rounded-lg border border-surface-200 bg-surface-50 p-5 text-sm text-surface-700">
              Updates are temporarily unavailable — the source could not be
              reached. Everything else on this site is unaffected, and the
              updates will return on the next refresh.
            </p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
