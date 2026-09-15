import { loadFixture } from "./fixtures";
import { isSevere, queryCube, rate, sum, totalCrashes } from "./dev/crashCube";
import type {
  ApiResponse,
  ConditionFactor,
  CrashFilters,
  Hotspot,
} from "@/types";

/**
 * Conditions recorded as present at crashes — deliberately not "causes".
 *
 * CAS has no contributing-factor or cause column. What it has is the state of
 * the road and environment when the crash was recorded. Reporting these as
 * causes would assert something the data cannot support: fine weather shows a
 * *higher* severe rate than rain in this dataset, which is a correlation with
 * speed, not evidence that clear skies are dangerous.
 *
 * Later: apiGet<ConditionFactor[]>("/api/crashes/factors", filters)
 */
export async function getContributingFactors(
  filters: CrashFilters = {},
): Promise<ApiResponse<ConditionFactor[]>> {
  const { rows, meta } = await queryCube(filters);

  const severeRows = rows.filter(isSevere);

  const factors: ConditionFactor[] = [
    {
      factor: "Adverse weather",
      category: "Weather",
      crashCount: sum(rows, (row) => row.adverseWeather),
      severeCount: sum(severeRows, (row) => row.adverseWeather),
      severeRate: 0,
    },
    {
      factor: "Dark or twilight",
      category: "Light",
      crashCount: sum(rows, (row) =>
        row.light === "Dark" || row.light === "Twilight" ? row.crashCount : 0,
      ),
      severeCount: sum(severeRows, (row) =>
        row.light === "Dark" || row.light === "Twilight" ? row.crashCount : 0,
      ),
      severeRate: 0,
    },
    {
      factor: "No traffic control",
      category: "Traffic control",
      crashCount: sum(rows, (row) => row.noTrafficControl),
      severeCount: sum(severeRows, (row) => row.noTrafficControl),
      severeRate: 0,
    },
    {
      factor: "Hill road",
      category: "Road geometry",
      crashCount: sum(rows, (row) => row.hillRoad),
      severeCount: sum(severeRows, (row) => row.hillRoad),
      severeRate: 0,
    },
    {
      factor: "Unsealed road",
      category: "Road surface",
      crashCount: sum(rows, (row) => row.unsealedRoad),
      severeCount: sum(severeRows, (row) => row.unsealedRoad),
      severeRate: 0,
    },
  ];

  const data = factors
    .map((factor) => ({
      ...factor,
      severeRate: rate(factor.severeCount, factor.crashCount),
    }))
    .filter((factor) => factor.crashCount > 0)
    .sort((a, b) => b.crashCount - a.crashCount);

  return { data, meta };
}

/**
 * Baseline severe rate for the same filter set, so a condition's rate can be
 * read as better or worse than average rather than in isolation.
 */
export async function getBaselineSevereRate(
  filters: CrashFilters = {},
): Promise<number> {
  const { rows } = await queryCube(filters);
  const total = totalCrashes(rows);
  return rate(sum(rows, (row) => (isSevere(row) ? row.crashCount : 0)), total);
}

interface HotspotFixture {
  areas: {
    id: string;
    name: string;
    region: string;
    latitude: number;
    longitude: number;
  }[];
  columns: string[];
  rows: (string | number)[][];
}

/**
 * Crash concentrations by territorial authority.
 *
 * Counts are per (area, year, severity) so region, year and severity filters
 * all apply. Road type and speed environment are not carried at this grain
 * and are ignored — the PostGIS query will support them.
 */
export async function getHotspots(
  filters: CrashFilters = {},
): Promise<ApiResponse<Hotspot[]>> {
  const { data, meta } = await loadFixture<ApiResponse<HotspotFixture>>(
    "hotspots",
  );
  const at = Object.fromEntries(data.columns.map((name, i) => [name, i]));

  const totals = new Map<number, { crashCount: number; severeCount: number }>();

  for (const row of data.rows) {
    const year = row[at.crashYear] as number;
    const severity = row[at.crashSeverity] as string;

    if (filters.yearFrom !== undefined && year < filters.yearFrom) continue;
    if (filters.yearTo !== undefined && year > filters.yearTo) continue;
    if (filters.severity && severity !== filters.severity) continue;

    const index = row[at.areaIndex] as number;
    const count = row[at.crashCount] as number;
    const severe =
      severity === "Fatal Crash" || severity === "Serious Crash" ? count : 0;

    const running = totals.get(index);
    if (running) {
      running.crashCount += count;
      running.severeCount += severe;
    } else {
      totals.set(index, { crashCount: count, severeCount: severe });
    }
  }

  const hotspots = [...totals]
    .map(([index, counts]) => {
      const area = data.areas[index];

      return {
        id: area.id,
        name: area.name,
        region: area.region,
        latitude: area.latitude,
        longitude: area.longitude,
        crashCount: counts.crashCount,
        severeCount: counts.severeCount,
        severeRate: rate(counts.severeCount, counts.crashCount),
      };
    })
    .filter((hotspot) => !filters.region || hotspot.region === filters.region)
    .sort((a, b) => b.crashCount - a.crashCount);

  return { data: hotspots, meta };
}
