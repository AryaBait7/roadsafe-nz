import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Temporary development data source.
 *
 * Reads pre-aggregated JSON generated from the real CAS dataset by
 * `data-pipeline/src/generate_frontend_fixtures.py`. Read at runtime rather
 * than imported at build time so the fixture set can be regenerated without
 * a rebuild, and so a missing fixture fails loudly with a fixable message
 * instead of breaking the build.
 *
 * Server-side only — services are consumed from Server Components. When the
 * Express API lands in Stage 22, service bodies call `apiGet` (see http.ts)
 * instead of this, and this file is deleted.
 *
 * `name` is always a literal from our own service modules, never user input.
 */
const FIXTURES_DIR = path.join(process.cwd(), "src", "data", "fixtures");

export class FixtureMissingError extends Error {
  constructor(name: string) {
    super(
      `Fixture "${name}.json" not found. Generate the fixture set by running ` +
        `"python src/generate_frontend_fixtures.py" from data-pipeline/.`,
    );
    this.name = "FixtureMissingError";
  }
}

export async function loadFixture<T>(name: string): Promise<T> {
  const file = path.join(FIXTURES_DIR, `${name}.json`);

  try {
    return JSON.parse(await fs.readFile(file, "utf-8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new FixtureMissingError(name);
    }
    throw error;
  }
}
