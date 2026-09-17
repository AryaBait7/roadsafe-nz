import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";
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

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <Link
      href={item.href}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-400 hover:shadow-md"
    >
      <div className="aspect-[16/9] w-full bg-surface-100">
        {item.imageUrl ? (
          // Plain img rather than next/image: these are author-supplied and
          // may be remote, which would need host configuration up front.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.14em] text-accent-600 uppercase">
          <span>{item.category}</span>
          <span aria-hidden className="text-surface-300">
            ·
          </span>
          <time dateTime={item.publishedAt} className="text-surface-500">
            {formatDate(item.publishedAt)}
          </time>
        </div>

        <h3 className="mt-2.5 text-base font-semibold tracking-tight text-navy-900">
          {item.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-surface-500">
          {item.summary}
        </p>

        <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-accent-600">
          Read more
          <span
            aria-hidden
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          >
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

/**
 * Structural stand-in used until real updates are supplied.
 *
 * Deliberately skeleton bars rather than sample headlines: invented article
 * titles on a data platform read as real editorial, and there is no way for a
 * viewer to tell placeholder copy from published content.
 */
export function NewsCardPlaceholder() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-dashed border-surface-300 bg-white">
      <div className="grid aspect-[16/9] w-full place-items-center bg-surface-100">
        <span className="text-[10px] tracking-[0.14em] text-surface-700 uppercase">
          Image
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2.5 w-20" />
        </div>

        <Skeleton className="mt-3 h-4 w-11/12" />
        <Skeleton className="mt-2 h-4 w-3/5" />

        <div className="mt-4 flex-1 space-y-2">
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-4/5" />
        </div>

        <Skeleton className="mt-4 h-3 w-24" />
      </div>
    </div>
  );
}
