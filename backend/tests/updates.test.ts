import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetUpdatesCache,
  getRoadSafetyUpdates,
} from "../src/services/updatesService";

/**
 * The updates service, with the network faked.
 *
 * These tests never reach NZTA: a suite that depends on a third party is a
 * suite that fails when that third party is having a bad day, which tells you
 * nothing about this code. What is worth asserting is the behaviour we wrote
 * — the filtering, the de-duplication, and the promise that a dead source
 * degrades rather than breaks.
 */
const dataset = (over: Record<string, unknown> = {}) => ({
  identifier: "https://www.arcgis.com/home/item.html?id=aaaa1111&sublayer=0",
  title: "Crash Analysis System (CAS) data",
  description: "<p>Crash data for <b>New Zealand</b>.</p>",
  modified: "2026-09-14T21:34:00.000Z",
  landingPage: "https://opendata-nzta.opendata.arcgis.com/datasets/NZTA::cas",
  keyword: ["crashes", "safety"],
  publisher: { name: "Waka Kotahi" },
  ...over,
});

const respondWith = (body: unknown, ok = true, status = 200) =>
  vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as Response);

beforeEach(() => {
  __resetUpdatesCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("road safety updates", () => {
  it("normalises a catalogue entry into what a card needs", async () => {
    vi.stubGlobal("fetch", respondWith({ dataset: [dataset()] }));

    const { data, meta } = await getRoadSafetyUpdates();

    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      title: "Crash Analysis System (CAS) data",
      category: "Crash data",
      icon: "trends",
      publishedAt: "2026-09-14T21:34:00.000Z",
      source: "NZ Transport Agency",
      sourceUrl: "https://opendata-nzta.opendata.arcgis.com/datasets/NZTA::cas",
    });
    // HTML from the source never reaches the page as markup.
    expect(data[0].summary).toBe("Crash data for New Zealand.");
    expect(meta.source).toBe("real");
  });

  it("keeps only road-safety datasets", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith({
        dataset: [
          dataset(),
          dataset({
            identifier: "https://www.arcgis.com/home/item.html?id=bbbb2222",
            title: "EV Roam charging stations",
            description: "<p>Charging station locations.</p>",
            keyword: ["EV"],
            landingPage: "https://example.govt.nz/ev",
          }),
        ],
      }),
    );

    const { data } = await getRoadSafetyUpdates();

    expect(data.map((item) => item.title)).toEqual([
      "Crash Analysis System (CAS) data",
    ]);
  });

  it("shows one card per dataset, not one per layer", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith({
        dataset: [
          dataset({
            identifier: "https://www.arcgis.com/home/item.html?id=cccc3333&sublayer=0",
            title: "Road Events",
            modified: "2026-09-19T06:15:16.000Z",
            landingPage: "https://example.govt.nz/road-events",
          }),
          dataset({
            identifier: "https://www.arcgis.com/home/item.html?id=cccc3333&sublayer=1",
            title: "Road Area Events",
            modified: "2026-09-19T06:15:15.000Z",
            landingPage: "https://example.govt.nz/road-area-events",
          }),
          dataset(),
        ],
      }),
    );

    const { data } = await getRoadSafetyUpdates();

    expect(data.map((item) => item.title)).toEqual([
      "Road Events",
      "Crash Analysis System (CAS) data",
    ]);
  });

  it("serves the newest three, newest first", async () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      dataset({
        identifier: `https://www.arcgis.com/home/item.html?id=dddd444${i}`,
        title: `Crash dataset ${i}`,
        modified: `2026-0${i + 1}-01T00:00:00.000Z`,
        landingPage: `https://example.govt.nz/${i}`,
      }),
    );
    vi.stubGlobal("fetch", respondWith({ dataset: many }));

    const { data } = await getRoadSafetyUpdates();

    expect(data).toHaveLength(3);
    expect(data.map((item) => item.title)).toEqual([
      "Crash dataset 5",
      "Crash dataset 4",
      "Crash dataset 3",
    ]);
  });

  it("caches, so a burst of traffic is one upstream request", async () => {
    const fetcher = respondWith({ dataset: [dataset()] });
    vi.stubGlobal("fetch", fetcher);

    await Promise.all([
      getRoadSafetyUpdates(),
      getRoadSafetyUpdates(),
      getRoadSafetyUpdates(),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("throws only when the source fails and nothing was ever cached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(getRoadSafetyUpdates()).rejects.toThrow(
      /could not be retrieved/,
    );
  });

  it("serves the last good result when the source goes down", async () => {
    vi.stubGlobal("fetch", respondWith({ dataset: [dataset()] }));
    await getRoadSafetyUpdates();

    // Age the cache past its TTL, then take the source away.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 7 * 60 * 60 * 1000);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("502")));

    const { data, meta } = await getRoadSafetyUpdates();

    expect(data).toHaveLength(1);
    expect(meta.note).toMatch(/cache/i);
    vi.useRealTimers();
  });
});
