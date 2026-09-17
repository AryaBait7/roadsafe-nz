import type { MapCrashPoint } from "@/types";

/**
 * Compact form of the density grid for the trip from a Server Component to
 * the client map.
 *
 * Props crossing that boundary are serialised into the page HTML. As objects,
 * 6,103 cells repeat five key names and a region name each: about 700KB of
 * HTML per map page. As tuples with a region lookup table, the same data is a
 * fraction of that. The service contract (`MapCrashPoint[]`) is unchanged;
 * only this internal handoff is packed.
 */
export interface PackedMapPoints {
  regions: string[];
  /** [latitude, longitude, regionIndex, crashCount, severeCount] */
  cells: [number, number, number, number, number][];
}

export function packPoints(points: MapCrashPoint[]): PackedMapPoints {
  const regions: string[] = [];
  const index = new Map<string, number>();

  const cells = points.map((p): PackedMapPoints["cells"][number] => {
    let i = index.get(p.region);
    if (i === undefined) {
      i = regions.push(p.region) - 1;
      index.set(p.region, i);
    }
    return [p.latitude, p.longitude, i, p.crashCount, p.severeCount];
  });

  return { regions, cells };
}

export function unpackPoints(packed: PackedMapPoints): MapCrashPoint[] {
  return packed.cells.map(
    ([latitude, longitude, region, crashCount, severeCount]) => ({
      latitude,
      longitude,
      region: packed.regions[region],
      crashCount,
      severeCount,
    }),
  );
}
