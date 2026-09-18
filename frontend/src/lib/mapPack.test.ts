import { describe, expect, it } from "vitest";
import type { MapCrashPoint } from "@/types";
import { packPoints, unpackPoints } from "./mapPack";

/**
 * A grid shaped like the real one: thousands of cells, a handful of region
 * names repeated across them, and the Chatham Islands' negative longitudes.
 * The real grid arrives from the API now, so this builds its own rather than
 * requiring a running server for a pure-function test.
 */
function grid(cells: number): MapCrashPoint[] {
  const regions = [
    "Auckland Region",
    "Waikato Region",
    "Canterbury Region",
    "Manawatū-Whanganui Region",
    "Unknown",
  ];

  return Array.from({ length: cells }, (_, i) => ({
    latitude: Number((-46.5 + (i % 250) * 0.05).toFixed(4)),
    longitude: i % 97 === 0 ? -176.55 : Number((166.5 + (i % 200) * 0.05).toFixed(4)),
    region: regions[i % regions.length],
    crashCount: (i * 7) % 1_301,
    severeCount: (i * 3) % 91,
  }));
}

describe("map point packing", () => {
  it("round-trips every cell exactly", () => {
    const points = grid(6_103);
    expect(unpackPoints(packPoints(points))).toEqual(points);
  });

  it("keeps negative longitudes intact", () => {
    const chathams: MapCrashPoint[] = [
      { latitude: -43.95, longitude: -176.56, region: "Unknown", crashCount: 3, severeCount: 0 },
    ];
    expect(unpackPoints(packPoints(chathams))).toEqual(chathams);
  });

  it("is much smaller than the object form", () => {
    const points = grid(6_103);
    const objects = JSON.stringify(points).length;
    const packed = JSON.stringify(packPoints(points)).length;
    expect(packed).toBeLessThan(objects / 2.5);
  });

  it("stores each region name once", () => {
    const packed = packPoints(grid(1_000));
    expect(packed.regions).toHaveLength(5);
    expect(packed.cells).toHaveLength(1_000);
  });

  it("handles an empty grid", () => {
    expect(packPoints([])).toEqual({ regions: [], cells: [] });
    expect(unpackPoints({ regions: [], cells: [] })).toEqual([]);
  });
});
