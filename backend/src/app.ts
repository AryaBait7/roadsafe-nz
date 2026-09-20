import compression from "compression";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";

import { FixtureMissingError, fixtureStatus } from "./data/fixtures";
import { InvalidFilterError, parseFilters } from "./filters";
import type { CrashFilters } from "./types";
import {
  getBaselineSevereRate,
  getAdjustedAssociations,
  getContributingFactors,
  getHotspotDetail,
  getHotspots,
  getSeverityLift,
  getUnattributedCrashCount,
} from "./services/analyticsService";
import {
  getHolidayBreakdown,
  getLightConditions,
  getMapGridDegrees,
  getMapPoints,
  getRegionBreakdown,
  getRoadTypes,
  getSeverityBreakdown,
  getSeverityTrends,
  getTrends,
  getUnmappedCrashCount,
} from "./services/crashService";
import {
  getFilterOptions,
  getSummary,
  getSummaryComparison,
} from "./services/dashboardService";
import { getDataDictionary } from "./services/datasetService";
import {
  getRoadSafetyUpdates,
  UpdatesUnavailableError,
} from "./services/updatesService";
import {
  getFeatureImportance,
  getModelMetrics,
  getScenarios,
  getShapSummary,
  getTrainingDataProfile,
} from "./services/mlService";

/**
 * The REST API the frontend will call from Stage 23.
 *
 * Every route returns the `ApiResponse<T>` envelope the services already
 * produce — `{ data, meta }`, where `meta.source` says whether the figures
 * are real or a placeholder. That shape has been the contract since Stage 1,
 * so wiring the frontend to it changes service bodies only.
 *
 * Filters arrive as the same query keys the frontend puts in the URL and are
 * parsed with the same rules, so a filtered view is shareable across both.
 */
export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // The map endpoint alone is ~600KB of JSON; gzip takes it to a fraction of
  // that, and these payloads are highly repetitive.
  app.use(compression());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(",") ?? "http://localhost:3100",
    }),
  );

  // Aggregates change only when the pipeline runs, so they are cacheable.
  // Short enough that a regenerated fixture appears quickly.
  app.use("/api", (_request, response, next) => {
    response.set("Cache-Control", "public, max-age=60");
    next();
  });

  const filtersFrom = (request: Request): CrashFilters =>
    parseFilters(request.query as Record<string, string | string[] | undefined>);

  /**
   * Routes are thin: parse the query, call the service, send the envelope.
   * Anything thrown lands in the error handler below, so no route repeats
   * try/catch.
   */
  const send =
    <T>(handler: (request: Request) => Promise<T>) =>
    (request: Request, response: Response, next: NextFunction) => {
      handler(request)
        .then((payload) => response.json(payload))
        .catch(next);
    };

  app.get("/health", send(async () => ({
    status: "ok",
    fixtures: await fixtureStatus(),
    uptimeSeconds: Math.round(process.uptime()),
  })));

  // --- Dashboard ---------------------------------------------------------
  app.get("/api/dashboard/summary", send((r) => getSummaryComparison(filtersFrom(r))));
  app.get("/api/dashboard/totals", send((r) => getSummary(filtersFrom(r))));
  app.get("/api/filters", send(() => getFilterOptions()));

  // --- Crashes -----------------------------------------------------------
  app.get("/api/crashes/trends", send((r) => getTrends(filtersFrom(r))));
  app.get("/api/crashes/severity", send((r) => getSeverityBreakdown(filtersFrom(r))));
  app.get("/api/crashes/severity-trends", send((r) => getSeverityTrends(filtersFrom(r))));
  app.get("/api/crashes/light", send((r) => getLightConditions(filtersFrom(r))));
  app.get("/api/crashes/road-types", send((r) => getRoadTypes(filtersFrom(r))));
  app.get("/api/crashes/regions", send((r) => getRegionBreakdown(filtersFrom(r))));
  app.get("/api/crashes/holidays", send((r) => getHolidayBreakdown(filtersFrom(r))));
  app.get("/api/crashes/factors", send((r) => getContributingFactors(filtersFrom(r))));

  // --- Map ---------------------------------------------------------------
  app.get(
    "/api/map/crashes",
    send(async (r) => {
      const filters = filtersFrom(r);
      const [points, gridDegrees, unmapped] = await Promise.all([
        getMapPoints(filters),
        getMapGridDegrees(),
        getUnmappedCrashCount(filters),
      ]);

      // Grid resolution and the unmapped count belong with the cells: the map
      // cannot draw or caption itself without them, and one request is one
      // round trip.
      return {
        data: { gridDegrees, unmappedCrashes: unmapped, cells: points.data },
        meta: points.meta,
      };
    }),
  );

  // --- Hotspots ----------------------------------------------------------
  app.get(
    "/api/hotspots",
    send(async (r) => {
      const filters = filtersFrom(r);
      const [hotspots, unattributed] = await Promise.all([
        getHotspots(filters),
        getUnattributedCrashCount(filters),
      ]);

      return {
        data: { areas: hotspots.data, unattributedCrashes: unattributed },
        meta: hotspots.meta,
      };
    }),
  );
  app.get(
    "/api/hotspots/:id",
    send(async (r) => getHotspotDetail(String(r.params.id), filtersFrom(r))),
  );

  // --- Risk factors ------------------------------------------------------
  app.get("/api/risk-factors", send((r) => getSeverityLift(filtersFrom(r))));
  app.get("/api/risk-factors/baseline", send(async (r) => ({
    data: { baseline: await getBaselineSevereRate(filtersFrom(r)) },
    meta: { source: "real" as const },
  })));
  app.get("/api/risk-factors/adjusted", send(() => getAdjustedAssociations()));

  // --- Model -------------------------------------------------------------
  app.get("/api/ml/metrics", send(() => getModelMetrics()));
  app.get("/api/ml/feature-importance", send(() => getFeatureImportance()));
  app.get("/api/ml/explain", send(() => getShapSummary()));
  app.get("/api/ml/scenarios", send(() => getScenarios()));
  app.get("/api/ml/training-data", send(() => getTrainingDataProfile()));

  // --- Dataset -----------------------------------------------------------
  app.get("/api/dataset/dictionary", send(() => getDataDictionary()));

  // --- Road safety updates ------------------------------------------------
  // The only route that reaches outside this process. It is cached upstream
  // of the handler, so a burst of traffic is one request to NZTA at most.
  app.get("/api/updates", send(() => getRoadSafetyUpdates()));

  app.use((request: Request, response: Response) => {
    response.status(404).json({
      error: { code: "not_found", message: `No route for ${request.method} ${request.path}` },
    });
  });

  app.use(
    (
      error: Error,
      _request: Request,
      response: Response,
      _next: NextFunction,
    ) => {
      // A missing fixture is an operator problem with a known fix, so its
      // message is safe and useful. Anything else is logged in full and
      // reported generically: internal paths and stack traces stay server-side.
      // The caller's query was wrong, not our data. 400 with the reason, so
      // a client can correct it rather than retry the same request.
      if (error instanceof InvalidFilterError) {
        response.status(400).json({
          error: { code: "invalid_filter", message: error.message },
        });
        return;
      }

      // The external source is down and nothing was ever cached. The page
      // says so; it does not invent items to fill the space.
      if (error instanceof UpdatesUnavailableError) {
        console.error(error.message);
        response.status(503).json({
          error: { code: "updates_unavailable", message: error.message },
        });
        return;
      }

      if (error instanceof FixtureMissingError) {
        console.error(error.message);
        response.status(503).json({
          error: { code: "data_unavailable", message: error.message },
        });
        return;
      }

      console.error(error);
      response.status(500).json({
        error: { code: "internal_error", message: "Something went wrong handling this request." },
      });
    },
  );

  return app;
}
