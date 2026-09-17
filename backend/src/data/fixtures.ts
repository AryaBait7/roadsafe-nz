import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * The API's data source.
 *
 * Reads the aggregates the Python pipeline produces. This is the same data
 * the frontend reads directly today; Stage 23 points the frontend at this API
 * instead, and Stage 18's PostGIS database eventually replaces the files —
 * only this module changes when it does.
 *
 * Fixtures are cached as *promises*, so concurrent requests during the first
 * read share one parse instead of each decoding the 6MB cube.
 */
const DEFAULT_DIR = path.resolve(
  process.cwd(),
  "..",
  "frontend",
  "src",
  "data",
  "fixtures",
);

export const FIXTURES_DIR = process.env.FIXTURES_DIR
  ? path.resolve(process.env.FIXTURES_DIR)
  : DEFAULT_DIR;

export class FixtureMissingError extends Error {
  constructor(name: string) {
    super(
      `Fixture "${name}.json" not found in ${FIXTURES_DIR}. Generate it by ` +
        `running "python src/run_pipeline.py" from data-pipeline/.`,
    );
    this.name = "FixtureMissingError";
  }
}

const cache = new Map<string, Promise<unknown>>();

export async function loadFixture<T>(name: string): Promise<T> {
  const cached = cache.get(name);
  if (cached) return cached as Promise<T>;

  const reading = fs
    .readFile(path.join(FIXTURES_DIR, `${name}.json`), "utf-8")
    .then((text) => JSON.parse(text) as T)
    .catch((error: NodeJS.ErrnoException) => {
      // Never cache a failure: a fixture generated after the server started
      // should be picked up on the next request.
      cache.delete(name);
      if (error.code === "ENOENT") throw new FixtureMissingError(name);
      throw error;
    });

  cache.set(name, reading);
  return reading;
}

/** Which fixtures are present — used by the health check. */
export async function fixtureStatus(): Promise<Record<string, boolean>> {
  const names = [
    "crash-cube",
    "map-cells",
    "hotspots",
    "filter-options",
    "data-dictionary",
    "adjusted-associations",
    "model-metrics",
    "feature-importance",
    "shap-summary",
    "scenarios",
  ];

  const entries = await Promise.all(
    names.map(async (name) => {
      try {
        await fs.access(path.join(FIXTURES_DIR, `${name}.json`));
        return [name, true] as const;
      } catch {
        return [name, false] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
}
