import { NavIcon } from "@/components/layout/NavIcon";
import type { NewsItem } from "@/types";

const dateFormat = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : dateFormat.format(parsed);
}

/**
 * One official road-safety update.
 *
 * A plain `<a>`, not `next/link`: this leaves the site for the agency that
 * published the item, and "Read more" has to reach the original rather than
 * an internal copy of it. There is no internal article page, because writing
 * one would mean restating someone else's publication in our own words.
 *
 * The visual is a category icon drawn from the set the site already ships.
 * The feed supplies no images, and hotlinking one from a government site
 * would be both a bandwidth and a licensing liberty — an icon that says what
 * kind of update this is carries more than a stock photograph would.
 */
export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full flex-col rounded-lg border border-surface-200 bg-white p-5 shadow-sm transition-all duration-200 ease-out hover:border-accent-400 hover:shadow-lg focus-visible:border-accent-400 focus-visible:shadow-lg motion-safe:hover:-translate-y-1.5 motion-safe:focus-visible:-translate-y-1.5"
    >
      <span
        aria-hidden
        className="grid size-9 place-items-center rounded-md bg-accent-500/10 text-accent-600 transition-all duration-200 ease-out group-hover:bg-accent-500/15 motion-safe:group-hover:scale-105"
      >
        <NavIcon name={item.icon} size={18} />
      </span>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold tracking-[0.14em] uppercase">
        <span className="text-accent-600">{item.category}</span>
        <span aria-hidden className="text-surface-300">
          ·
        </span>
        <time dateTime={item.publishedAt} className="text-surface-500">
          {formatDate(item.publishedAt)}
        </time>
      </div>

      <h3 className="mt-2 text-base font-semibold tracking-tight text-navy-900">
        {item.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-surface-500">
        {item.summary}
      </p>

      <p className="mt-4 text-[11px] text-surface-500">{item.source}</p>

      <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-600">
        Read more
        <span
          aria-hidden
          className="transition-transform duration-200 ease-out motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1"
        >
          →
        </span>
        <span className="sr-only">(opens {item.source} in a new tab)</span>
      </span>
    </a>
  );
}
