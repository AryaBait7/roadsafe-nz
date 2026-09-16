import { Badge } from "@/components/ui/Badge";
import { Reveal } from "./Reveal";
import { NewsCard, NewsCardPlaceholder } from "./NewsCard";
import type { NewsItem } from "@/types";

/**
 * Road safety updates.
 *
 * Data-driven from the outset: passing a populated `items` array is all that
 * is needed to go live, with no layout change. While it is empty the section
 * renders labelled placeholders and says plainly that no updates have been
 * published — rather than inventing articles that would be indistinguishable
 * from real editorial on a platform whose whole point is trustworthy data.
 */
export function NewsSection({ items = [] }: { items?: NewsItem[] }) {
  const hasItems = items.length > 0;

  return (
    <section className="border-t border-surface-200 bg-white px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.22em] text-accent-600 uppercase">
                Road safety updates
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
                Latest insights &amp; updates.
              </h2>
            </div>

            {hasItems ? null : (
              <Badge tone="placeholder">Placeholder</Badge>
            )}
          </div>

          {hasItems ? null : (
            <p className="mt-4 max-w-2xl text-sm text-surface-500">
              No updates have been published yet. This section is wired and
              waiting for content — the cards below show the layout, not real
              articles.
            </p>
          )}
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {hasItems
            ? items.slice(0, 3).map((item, index) => (
                <Reveal key={item.id} delay={index * 80}>
                  <NewsCard item={item} />
                </Reveal>
              ))
            : Array.from({ length: 3 }, (_, index) => (
                <Reveal key={index} delay={index * 80}>
                  <NewsCardPlaceholder />
                </Reveal>
              ))}
        </div>
      </div>
    </section>
  );
}
