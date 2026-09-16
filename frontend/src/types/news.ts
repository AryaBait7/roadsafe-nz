/**
 * Road-safety updates shown on the landing page.
 *
 * The section is data-driven from day one: supplying real items later is a
 * matter of passing an array, with no layout change. Until then the section
 * renders clearly-marked placeholders rather than invented articles.
 */
export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  /** e.g. "Analysis", "Dataset update", "Newsletter". */
  category: string;
  /** ISO date, formatted for display at render time. */
  publishedAt: string;
  href: string;
  /** Optional cover image; the card falls back to a plain block without one. */
  imageUrl?: string;
}
