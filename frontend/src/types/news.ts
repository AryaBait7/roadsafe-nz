/**
 * A road-safety update from an official New Zealand source.
 *
 * Shaped by the API, which normalises whatever the upstream source publishes
 * into this one structure — see `backend/src/services/updatesService.ts` for
 * which source was chosen and why. Nothing here is authored by this project:
 * every field is the source's own, and `sourceUrl` points back to it.
 */
export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  /** e.g. "Crash data", "Speed safety", "Road conditions". */
  category: string;
  /** Which of the site's existing icons represents this category. */
  icon: "trends" | "risk" | "map" | "reports";
  /** ISO date, formatted for display at render time. */
  publishedAt: string;
  /** The publishing agency, shown on the card. */
  source: string;
  /** The official page this came from. "Read more" goes here. */
  sourceUrl: string;
}
