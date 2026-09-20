/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { NewsSection } from "./NewsSection";
import type { NewsItem } from "@/types";

/**
 * The updates section, in both of the states it can be in.
 *
 * The failure state is the one worth a test: it is the path nobody sees
 * during development, it only happens when a third party is down, and the
 * temptation when it happens is to fill the space with something invented.
 * These assertions pin the promise that it does not.
 */
const item = (over: Partial<NewsItem> = {}): NewsItem => ({
  id: "1",
  title: "Crash Analysis System (CAS) data",
  summary: "Crash data reported to NZTA by the NZ Police.",
  category: "Crash data",
  icon: "trends",
  publishedAt: "2026-09-14T21:34:00.000Z",
  source: "NZ Transport Agency",
  sourceUrl: "https://opendata-nzta.opendata.arcgis.com/datasets/NZTA::cas",
  ...over,
});

// jsdom ships neither matchMedia nor IntersectionObserver, and `Reveal` uses
// both: it asks whether the visitor wants reduced motion, then watches for
// the section scrolling into view. Answering "no" and supplying an observer
// that never fires exercises the same path a real first paint does — which is
// the point, since the content must be reachable without the observer.
beforeAll(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList,
  );
});

afterEach(cleanup);

describe("NewsSection", () => {
  it("links each update to the agency's own page, in a new tab", () => {
    render(<NewsSection items={[item()]} />);

    const link = screen.getByRole("link", { name: /Crash Analysis System/ });
    expect(link.getAttribute("href")).toBe(
      "https://opendata-nzta.opendata.arcgis.com/datasets/NZTA::cas",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("NZ Transport Agency")).toBeTruthy();
  });

  it("shows at most three", () => {
    render(
      <NewsSection
        items={[1, 2, 3, 4, 5].map((n) => item({ id: String(n), title: `Update ${n}` }))}
      />,
    );

    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("says so when the source is unreachable, and invents nothing", () => {
    render(<NewsSection items={null} />);

    expect(screen.getByText(/temporarily unavailable/i)).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    // No skeletons, no sample headlines, no fake image blocks.
    expect(screen.queryByText(/placeholder/i)).toBeNull();
    expect(screen.queryByText(/^image$/i)).toBeNull();
  });
});
