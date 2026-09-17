# RoadSafe NZ — Architecture

How the system is put together, what talks to what, and where the seams are.
Reflects the implementation as of Stage 16 (2026-09-17).

## Target architecture

```
NZTA Crash Analysis System (CAS)   — public open data, 705,609 crashes, 2006–2026
            |
   Python ETL (pandas)             — clean, reproject, engineer features
            |
        AWS S3                     — raw + processed dataset storage
            |
 PostgreSQL + PostGIS on AWS RDS   — queryable crash + geometry tables
            |
 Python analytics + ML             — scikit-learn / XGBoost / SHAP
            |
 Node.js + Express REST API        — the only thing the frontend talks to
            |
 Next.js + TypeScript frontend     — this is what users see
            |
        AWS                        — hosting, IAM, Secrets Manager, CloudWatch
```

Built in reverse: the complete frontend first, then the layers beneath it are
filled in and connected. The target shape does not change because of that
order — see [DECISIONS.md](DECISIONS.md) #10 and #21.

## Current state vs. target

| Layer | Target | Today |
|---|---|---|
| Data source | PostgreSQL/PostGIS via Express | Pre-aggregated JSON fixtures on disk, generated from the real CAS data |
| Aggregation | SQL `GROUP BY` in the database | In-memory group-by over a cube (`services/dev/crashCube.ts`) |
| Transport | HTTP to Express | Direct function call from Server Components |
| ML metrics | Trained model + SHAP | Return `null` with `meta.source: "placeholder"` |
| ML training-data facts | Served by the API | Real, computed from the cube (`getTrainingDataProfile`) |
| Exports | Server-side report generation | CSV built in the browser from rendered rows; print-to-PDF |
| Hosting | AWS | `next dev` on `localhost:3100` only — nothing deployed |

Everything above the service layer is the same in both columns. That is the
whole design goal.

## The layering rule

```
  Page (Server Component)           reads searchParams, calls services
        |
  Feature / chart components        receive plain serialisable data
        |
  Service                           dashboardService / crashService /
        |                           analyticsService / mlService
  Data source                       fixtures today, Express API later
```

Rules that keep the seam intact:

- Components never read files, parse CSV, or know where data came from.
- Services return the exact shape the API will return, wrapped in `ApiResponse<T>`.
- Aggregation lives below the service boundary, never in a component.
- Swapping the data source means editing service bodies only.
- Only serialisable values cross into Client Components — functions cannot
  (see LEARNING_GUIDE #29).

### Why not read the CSV in the frontend?

`cas_crash_data_features.csv` is 299MB / 705,609 rows. A browser cannot parse
it, and the Express API will never serve raw rows either — it will serve
aggregates. So the frontend is built against aggregates from day one, and the
fixture shape *is* the API contract.

## Service inventory

| Service | Method | Future endpoint |
|---|---|---|
| dashboardService | `getSummary`, `getSummaryComparison`, `getFilterOptions` | `/api/dashboard/summary` |
| crashService | `getTrends`, `getSeverityBreakdown`, `getSeverityTrends`, `getLightConditions`, `getRoadTypes`, `getRegionBreakdown`, `getHolidayBreakdown`, `getMapPoints`, `getMapGridDegrees` | `/api/crashes/*`, `/api/map/crashes` |
| analyticsService | `getContributingFactors`, `getSeverityLift`, `getBaselineSevereRate`, `getHotspots`, `getHotspotDetail` | `/api/crashes/factors`, `/api/risk-factors`, `/api/hotspots[/{id}]` |
| datasetService | `getDataDictionary` | `/api/dataset/dictionary` |
| mlService | `getModelMetrics`, `getFeatureImportance` (null until Stage 20), `getTrainingDataProfile` (real) | `/api/ml/*` |

`getSummaryComparison` returns the selected period and the equivalent
preceding period, only when a year range is chosen. `getSeverityLift`
measures each condition against the baseline and flags "Unknown" buckets with
`isMissingData`.

## Data flow, end to end (today)

```
cas_crash_data.csv (191MB, gitignored)
   |  clean_data.py                 fix disguised "Null" (8 cols), NZTM2000 -> WGS84, is_severe
cas_crash_data_clean.csv (269MB, gitignored)
   |  feature_engineering.py        vehicle counts, condition flags, hazard score, speed bins
cas_crash_data_features.csv (299MB, gitignored)
   |  generate_frontend_fixtures.py     (+ generate_data_dictionary.py, which also reads DATA_DICTIONARY.md)
frontend/src/data/fixtures/*.json (~7.4MB, committed)
   |  loadFixture() + services/dev/crashCube.ts
services
   |
Server Components -> HTML (+ client components for charts, maps, filters)
```

The app runs from a fresh clone without the 191MB download; regenerating
fixtures requires it.

## The fixtures

| File | Size | Shape | Powers |
|---|---|---|---|
| `crash-cube.json` | 6.2MB | 47,554 rows, 7 dimensions + 8 measures, column-oriented | Dashboard, trends, risk factors, reports, ML profile |
| `map-cells.json` | 1.1MB | 6,103 cells `[lat, lon, regionIndex]` + 61,008 rows `[cellIndex, year, crashes, severe]` | Map Explorer, dashboard map |
| `hotspots.json` | 0.2MB | 68 areas + rows `[areaIndex, year, severity, crashes]` | Hotspots ranking and detail |
| `filter-options.json` | 1KB | Dimension values, year range, partial-year flag | Global filters |
| `data-dictionary.json` | 25KB | 82 profiled columns: measured type, missing %, distinct, example; described in markdown | Data Dictionary |

### The cube

```
dimensions: crashYear, region, roadType, speedEnvironment,
            crashSeverity, light, holiday
measures:   crashCount, peopleKilled, seriousInjuries, minorInjuries,
            adverseWeather, unsealedRoad, hillRoad, noTrafficControl
```

Filters become a `WHERE` clause; chart grouping becomes `GROUP BY`. The
TypeScript in `crashCube.ts` maps one-to-one onto the SQL that will replace
it. Decoded once; the parse *promise* is cached so concurrent first requests
share it.

### Map cells

Region is cell metadata rather than a row dimension — a cell sits in exactly
one (modal) region, so it costs 6,103 entries, not 61,008. Rows reference cells
by index instead of repeating coordinates, which is what lets the map honour
the region filter while the file shrank from 1.48MB to 1.08MB. Year and region
filters apply to the map; road type, speed environment and severity do not at
this grain, and the page says so.

### Derived dimensions

`roadType` is composed from `crashSHDescription` × `urban` into four
categories. `speedEnvironment` relabels the speed-limit bands.

## Dataset constraints that shaped the UI

- **No time of day, month or weekday** — only `crashYear`. The time-of-day
  panel reports light condition; date filters are year-granularity;
  seasonality comes from the `holiday` dimension.
- **No crash cause** — "contributing factors" are conditions recorded present,
  reported as associations.
- **Partial final year** — 2026 (14,573 crashes) is detected by the generator,
  dropped from trend lines, kept in tables, and held out of the ML split.
- **"Unknown" buckets distort rates** — unknown speed limit is 22.9% severe,
  unknown light 0.3%. They are flagged as missing data and never charted as
  findings.

## Frontend structure

```
src/
  app/
    page.tsx                    public landing (outside the group, no sidebar)
    (dashboard)/layout.tsx      sidebar shell; fetches filter options once
    (dashboard)/<8 pages>       dashboard, crash-trends, map-explorer, hotspots,
                                risk-factors, ml-insights, reports, data-dictionary
    globals.css                 Tailwind v4 @theme tokens, .map-dark, keyframes
  components/
    ui/          Card, Button, Badge, Select, Skeleton, CountUp
    layout/      Sidebar, FilterPanel, FilterSummary, PageHeader, NavIcon, nav-items
    states/      LoadingSkeleton, EmptyState, ErrorState
    charts/      ChartPanel (chart/table toggle), DataTable, BarList, Donut,
                 TrendChart (Recharts), DivergingBars
    maps/        CrashMap + loader (density grid), HotspotMap + loader (circles)
  features/
    landing/     HeroIntro, RoadScene, useIntroSequence, LandingNav,
                 LandingSections, Reveal, NewsSection, NewsCard
    dashboard/   KpiRow, ModelPreview
    reports/     CsvExportButton, PrintButton
    data-dictionary/ DictionaryExplorer (search + filters, local state)
  services/      the data boundary (+ dev/crashCube.ts, fixtures.ts, http.ts)
  types/         api.ts (contracts), filters.ts, news.ts
  lib/           filters (URL state), chart-theme (validated palettes),
                 formatters, cn
```

## Key runtime mechanisms

**Filter state lives in the URL.** Pages parse `searchParams` with
`parseFilters()`; the sidebar panel reads them client-side with
`useSearchParams` (layouts do not receive `searchParams`). The form holds a
pending draft and remounts via `key` when the URL changes. Hotspot selection
uses the same pattern (`?area=`). Pages that read `searchParams` render
dynamically. The landing page, ML Insights and Data Dictionary do not read filters, so they stay static.

**Maps.** Leaflet touches `window` at import, so each map loads through a thin
client loader using `next/dynamic` with `ssr: false` (not allowed in Server
Components). Tiles are OpenStreetMap's, darkened by a CSS filter scoped to the
tile pane (`.map-dark`) — third-party dark basemaps require keys and serve
watermarked tiles without one. The density grid is one `GeoJSON` layer on the
canvas renderer. Both maps use a `ResizeObserver` → `invalidateSize()` so
Leaflet never draws against a stale container size. Map wrappers are `isolate`d so Leaflet's z-indices cannot paint over the mobile drawer, and their height is capped at 60svh below `lg` so a phone user can still scroll past them.

**Landing intro.** A real CSS 3D scene (`preserve-3d`) with a single
`requestAnimationFrame`-driven camera: one transform write per frame for the
looping road world and one for the sign, which rides cumulative distance so it
is approached once. A phase machine drives the ~6.6s sequence; it plays on
every visit to `/`, is skippable and replayable, and reduced-motion users get
the final state before first paint. Below 1280px the sign becomes an overhead gantry (CSS variables on `.road-sign-layout`) and the stage is scaled 0.64/0.82 on phones and small tablets, so the sign stays on screen through the end of the intro. Motion blur is a flat layer outside the 3D
context because `filter` would flatten it.

**Loading and failure.** `app/(dashboard)/loading.tsx` is the Suspense fallback for a page's first render. `error.tsx` catches page and service failures inside the shell; its retry refreshes server data before resetting. `app/not-found.tsx` and `app/global-error.tsx` cover unknown routes and root-layout failures. Every filtered page renders an explanatory empty state when nothing matches.

**Motion.** Filter navigation runs in a React transition, which drives the "Updating…" state. Bar widths transition in place because rows are keyed by label. `app/(dashboard)/template.tsx` gives a transform-only entrance per page. JavaScript-driven animation (Recharts) checks `usePrefersReducedMotion`; CSS animation is covered by the global reduced-motion rule.

**Progressive enhancement.** The server renders final values; `CountUp` and
`Reveal` animate afterwards and arm fallback timers at mount so content never
depends on an `IntersectionObserver` firing.

**Exports.** CSV is built in the browser from the rows the page rendered
(formula-injection guard, UTF-8 BOM). Print styles hide navigation so
"Print or save as PDF" outputs the summary alone.

## Visual system

Tailwind v4, CSS-first: tokens in `@theme`, no `tailwind.config.ts`.

- Landing: cinematic, dark navy, safety-yellow accent.
- Analytics: compact light workspace, 208px dark navy sidebar, 12-column grids,
  tight card padding (the dashboard is ~1,117px tall at 1440×900).
- Chart colour is validated, not chosen — all values and their validation
  reports live in `lib/chart-theme.ts`: severity set, single-series blue,
  light and dark sequential ramps, diverging pair. Safety yellow (1.56:1 on
  white) is never used as a chart mark.
- Text greys: `surface-500` is the lightest allowed on light surfaces (≥4.7:1); `surface-400` is for borders, icons and text on navy only.
- Every chart has a table-view twin; this is required, not optional, because
  one severity colour sits below 3:1.

## Testing

Vitest (`npm test`). Service tests run the real services against the committed fixtures and assert reconciled CAS totals, so they double as the contract tests for the Stage 23 API swap: the same assertions should pass against `apiGet`. Component tests use React Testing Library in jsdom. Async Server Components are not unit-testable in Vitest; pages were verified in the browser.

## Performance notes

- Static routes (landing, ML Insights, Data Dictionary) are prerendered. Filtered routes render per request, taking 90–250ms warm; the first request parses the cube (about 0.6s extra).
- Recharts loads only where charts render, and Leaflet only when a map mounts.
- Map cells cross the server/client boundary packed as tuples (`lib/mapPack.ts`), which cut raw HTML by 69–76% on map pages.

## Known limitations

- `requestAnimationFrame` does not run in the development preview pane, so the
  intro and count-up *motion* have only been verified mathematically and by
  final state, not watched. Needs a real-browser check.
- `prefers-reduced-motion` is implemented but was not browser-emulated.
- `loadFixture` reads `src/data/fixtures` via `process.cwd()`. Fine for
  `next dev` / `next start`; a `standalone` build would not include it. Goes
  away at Stage 23.
- Nothing is deployed; the only URL is `http://localhost:3100`.
