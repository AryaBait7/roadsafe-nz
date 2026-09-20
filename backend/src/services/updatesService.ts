import type { ApiResponse } from "../types";

/**
 * Road-safety updates from an official New Zealand source.
 *
 * **Why this source.** Three candidates were probed directly:
 *
 * | Source | Result |
 * |---|---|
 * | nzta.govt.nz, transport.govt.nz | Behind Imperva/Incapsula. Every request, including with a browser user agent, returns a challenge page with HTTP 200 — server-side fetching is not supported and would be brittle by definition. |
 * | police.govt.nz/rss.xml | A real RSS 2.0 feed, but it is the site-wide default: the ten current items are job vacancies, not road-safety news. No news-specific feed exists (`/news/release/feed` and variants return 404). |
 * | NZTA Open Data portal | A DCAT-US 1.1 JSON catalogue, no authentication, stable, and updated the same day it is read. Chosen. |
 *
 * The catalogue is the same portal the CAS data in this project comes from, so
 * an update here is literally an update to the evidence the site is built on.
 * Each record carries a title, description, publisher, licence, last-modified
 * timestamp and a landing page, which is everything a card needs.
 *
 * What this is *not*: it is a data-publication feed, not a newswire. Items are
 * described as dataset updates rather than dressed up as articles, because
 * inventing a headline over a catalogue entry is the same fabrication as
 * inventing the article.
 */
const DCAT_URL =
  "https://opendata-nzta.opendata.arcgis.com/api/feed/dcat-us/1.1.json";

/**
 * The catalogue changes a few times a week at most, so six hours is already
 * far more often than the data behind it moves. One process therefore makes
 * at most four upstream requests a day however much traffic it serves, which
 * keeps this cheap on a Lambda and polite to the source.
 */
const TTL_MS = 6 * 60 * 60 * 1000;

/** An unreachable source must never hold a page open. */
const TIMEOUT_MS = 12_000;

const LIMIT = 3;

/** Icon names the frontend already ships; no new artwork, no remote images. */
export type UpdateIcon = "trends" | "risk" | "map" | "reports";

export interface RoadSafetyUpdate {
  id: string;
  title: string;
  summary: string;
  category: string;
  icon: UpdateIcon;
  /** ISO timestamp, from the source's own last-modified field. */
  publishedAt: string;
  source: string;
  sourceUrl: string;
}

export class UpdatesUnavailableError extends Error {
  constructor(cause: string) {
    super(`Road-safety updates could not be retrieved: ${cause}`);
    this.name = "UpdatesUnavailableError";
  }
}

interface DcatDataset {
  identifier?: string;
  title?: string;
  description?: string;
  modified?: string;
  issued?: string;
  landingPage?: string;
  keyword?: string[];
  publisher?: { name?: string };
}

/**
 * Which datasets belong on a road-safety page.
 *
 * The portal also publishes charging stations, road user charges and freight
 * volumes. They are real and current, and they are not road safety — filling
 * the section with them would meet the letter of "official source" and miss
 * the point of the section.
 */
const RELEVANT = [
  "crash",
  "safety",
  "speed limit",
  "road event",
  "fatal",
  "serious injur",
  "road death",
  "pavement condition",
];

const EXCLUDED = ["charging station", "road user charges", "covid", "employment"];

/** Category and icon follow what the dataset is about, in priority order. */
const CATEGORIES: { match: string[]; category: string; icon: UpdateIcon }[] = [
  { match: ["crash"], category: "Crash data", icon: "trends" },
  { match: ["speed"], category: "Speed safety", icon: "risk" },
  { match: ["event", "condition", "pavement"], category: "Road conditions", icon: "map" },
  { match: ["survey", "research", "attitude"], category: "Road safety research", icon: "reports" },
];

function classify(haystack: string): { category: string; icon: UpdateIcon } {
  const found = CATEGORIES.find((entry) =>
    entry.match.some((term) => haystack.includes(term)),
  );
  return found ?? { category: "Road safety", icon: "risk" };
}

/**
 * Descriptions arrive as CMS HTML — tags, entities and hard-wrapped
 * whitespace. The card needs a sentence, so the markup is stripped rather
 * than rendered: nothing from an external source reaches the page as HTML.
 */
function toSummary(html: string, limit = 190): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    // Stripping an inline tag leaves the space that surrounded it, so
    // "<b>New Zealand</b>." becomes "New Zealand ." without this.
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();

  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 80 ? lastSpace : limit).trimEnd()}…`;
}

/**
 * The ArcGIS item a catalogue entry belongs to. The identifier carries the
 * item id plus a sublayer, so stripping the sublayer groups the layers of one
 * dataset together.
 */
function itemIdOf(entry: DcatDataset): string {
  const match = /[?&]id=([0-9a-f]+)/i.exec(entry.identifier ?? "");
  return match ? match[1] : (entry.identifier ?? entry.landingPage ?? "");
}

function normalise(datasets: DcatDataset[]): RoadSafetyUpdate[] {
  return datasets
    .filter((entry) => {
      const haystack = `${entry.title ?? ""} ${entry.description ?? ""} ${(entry.keyword ?? []).join(" ")}`.toLowerCase();
      if (EXCLUDED.some((term) => haystack.includes(term))) return false;
      return RELEVANT.some((term) => haystack.includes(term));
    })
    .filter((entry) => Boolean(entry.title && entry.landingPage && entry.modified))
    .sort((a, b) => (b.modified ?? "").localeCompare(a.modified ?? ""))
    // One dataset can publish several layers — "Road Events" and "Road Area
    // Events" are sublayers 0 and 1 of one item, with the same description
    // and the same minute on the clock. Three cards saying the same thing is
    // worse than two cards and a different one, so only the first layer of
    // any item is kept.
    .filter((entry, index, all) => {
      const item = itemIdOf(entry);
      return all.findIndex((other) => itemIdOf(other) === item) === index;
    })
    .slice(0, LIMIT)
    .map((entry) => {
      const haystack = `${entry.title ?? ""} ${(entry.keyword ?? []).join(" ")}`.toLowerCase();
      const { category, icon } = classify(haystack);

      return {
        id: entry.identifier ?? (entry.landingPage as string),
        title: (entry.title as string).trim(),
        summary: toSummary(entry.description ?? ""),
        category,
        icon,
        publishedAt: entry.modified as string,
        // The portal publishes under the agency's former name; the agency it
        // is today is what a reader should see.
        source: entry.publisher?.name?.replace(/^Waka Kotahi$/, "NZ Transport Agency") ?? "NZ Transport Agency",
        sourceUrl: entry.landingPage as string,
      };
    });
}

/**
 * In-process cache. Deliberately not a database: three cards do not justify a
 * table, a migration and a connection to keep alive. A warm Lambda keeps this
 * between invocations; a cold one pays a single upstream request.
 */
let cache: { items: RoadSafetyUpdate[]; fetchedAt: number } | null = null;
let inFlight: Promise<RoadSafetyUpdate[]> | null = null;

async function fetchUpdates(): Promise<RoadSafetyUpdate[]> {
  const response = await fetch(DCAT_URL, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`${DCAT_URL} responded ${response.status}`);
  }

  const payload = (await response.json()) as { dataset?: DcatDataset[] };
  const items = normalise(payload.dataset ?? []);

  if (items.length === 0) {
    throw new Error("the catalogue returned no road-safety datasets");
  }

  return items;
}

/**
 * GET /api/updates
 *
 * Serves the cache when it is fresh. When the upstream source fails, the last
 * good result is served and flagged stale rather than the page breaking —
 * and if there has never been a good result, this throws so the route can
 * answer 503 and the section can say so plainly. It never falls back to
 * invented items.
 */
export async function getRoadSafetyUpdates(): Promise<
  ApiResponse<RoadSafetyUpdate[]>
> {
  const fresh = cache && Date.now() - cache.fetchedAt < TTL_MS;

  if (!fresh) {
    // Concurrent requests during a refresh share one upstream call.
    inFlight ??= fetchUpdates()
      .then((items) => {
        cache = { items, fetchedAt: Date.now() };
        return items;
      })
      .finally(() => {
        inFlight = null;
      });

    try {
      await inFlight;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`Road-safety updates refresh failed: ${reason}`);
      if (!cache) throw new UpdatesUnavailableError(reason);
    }
  }

  const held = cache as { items: RoadSafetyUpdate[]; fetchedAt: number };
  const stale = Date.now() - held.fetchedAt >= TTL_MS;

  return {
    data: held.items,
    meta: {
      source: "real",
      note: stale
        ? "Served from cache; the NZTA Open Data portal could not be reached on the last refresh."
        : "NZTA Open Data portal (DCAT-US 1.1 catalogue).",
      generatedAt: new Date(held.fetchedAt).toISOString(),
    },
  };
}

/** Test seam: lets a suite exercise the cache without waiting six hours. */
export function __resetUpdatesCache(): void {
  cache = null;
  inFlight = null;
}
