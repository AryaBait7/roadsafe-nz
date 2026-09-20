import { apiGet } from "./http";
import type { ApiResponse, NewsItem } from "@/types";

/**
 * Road-safety updates from an official source, by way of our own API.
 *
 * The browser never talks to the government portal: the API fetches it, keeps
 * the result cached and hands back one normalised shape. That keeps the number
 * of upstream requests to a handful a day however much traffic the site sees,
 * and means a change of source is a change in one backend file.
 *
 * Returns null rather than throwing. The updates are the one part of the page
 * that depends on a third party, and a government portal having a bad morning
 * must not take the landing page down with it — the section renders its own
 * unavailable state instead.
 */
export async function getRoadSafetyUpdates(): Promise<NewsItem[] | null> {
  try {
    const response: ApiResponse<NewsItem[]> =
      await apiGet<NewsItem[]>("/api/updates");
    return response.data;
  } catch (error) {
    console.error("Road-safety updates unavailable:", error);
    return null;
  }
}
