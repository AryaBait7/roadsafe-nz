# RoadSafe NZ — Architecture

How the system is put together, what talks to what, and where the seams are.

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

Built in reverse: the frontend exists now, the layers beneath it are filled in
progressively. Nothing about the target shape changes because of that order —
see [DECISIONS.md](DECISIONS.md) #10.

## Current state vs. target

| Layer | Target | Today |
|---|---|---|
| Data source | PostgreSQL/PostGIS via Express | Pre-aggregated JSON fixtures on disk |
| Aggregation | SQL `GROUP BY` in the database | In-memory group-by over a cube (`services/dev/`) |
| Transport | HTTP to Express | Direct function call |
| ML | Trained model + SHAP | Returns `null`, flagged `placeholder` |

The frontend above the service layer is identical in both columns. That is the
whole design goal.

## The layering rule

```
  Page (Server Component)
        |
  Feature component
        |
  Service          <- dashboardService / crashService / analyticsService / mlService
        |
  Data source      <- fixtures today, Express API later
```

Rules that keep the seam intact:

- Components never read files, parse CSV, or know where data came from.
- Services return the *exact* shape the API will return, wrapped in `ApiResponse<T>`.
- Aggregation lives below the service boundary, never in a component.
- Swapping the data source means editing service bodies only.

### Why not just read the CSV in the frontend?

`cas_crash_data_features.csv` is 299MB / 705,609 rows. A browser cannot parse
it, and the Express API will never serve raw rows either — it will serve
aggregates. So the frontend is built against aggregates from day one, and the
fixture shape *is* the API contract.

## Data flow, end to end (today)

```
cas_crash_data.csv (191MB, gitignored)
   |  clean_data.py          fix disguised "Null", NZTM2000 -> WGS84, add is_severe
cas_crash_data_clean.csv (269MB, gitignored)
   |  feature_engineering.py vehicle counts, condition flags, hazard score, speed bins
cas_crash_data_features.csv (299MB, gitignored)
   |  generate_frontend_fixtures.py
frontend/src/data/fixtures/*.json (~7.8MB, committed)
   |  loadFixture() + crashCube.ts
services
   |
Server Components -> HTML
```

Only the last two files are committed. The app runs from a fresh clone without
the 191MB download; regenerating fixtures requires it.

## The fixtures

| File | Size | Shape | Powers |
|---|---|---|---|
| `crash-cube.json` | 6.2MB | 47,554 rows, 7 dimensions + 8 measures | Everything except map & hotspots |
| `map-cells.json` | 1.5MB | 6,103 grid cells × year | Map Explorer, dashboard map |
| `hotspots.json` | 0.2MB | 68 areas + counts by year/severity | Hotspots |
| `filter-options.json` | 2KB | Dimension values + year range | Global filters |

### The cube

One aggregate table at the grain the dashboard filters on:

```
dimensions: crashYear, region, roadType, speedEnvironment,
            crashSeverity, light, holiday
measures:   crashCount, peopleKilled, seriousInjuries, minorInjuries,
            adverseWeather, unsealedRoad, hillRoad, noTrafficControl
```

Every dashboard number except the map and hotspots is a group-by over this.
Filters become a `WHERE` clause; chart grouping becomes `GROUP BY`. That is
deliberate — the TypeScript in `services/dev/crashCube.ts` maps one-to-one onto
the SQL that will replace it, so the migration is a translation, not a redesign.

Stored column-oriented (a `columns` header plus rows of bare values) because
repeating 15 key names across 47,554 rows roughly triples the file for nothing.
`crashCube.ts` decodes it once and caches the promise, so concurrent first
requests share a single parse.

### Derived dimensions

`roadType` does not exist in CAS. It is composed from two real columns —
`crashSHDescription` (state highway yes/no) and `urban` (urban/open) — into four
categories, because neither alone is a usable road classification.

## Dataset constraints that shaped the UI

Verified against the data, not assumed:

- **No time of day.** CAS has no time, date, month or weekday column — only
  `crashYear`. The "time of day" panel reports **light condition**; date filters
  are year-granularity; trends are annual.
- **No crash cause.** No contributing-factor column exists. The factors panel
  reports **conditions recorded present**, which is a correlation claim, not a
  causal one.
- **Partial final year.** 2026 holds 14,573 crashes against 29,017 in 2025. The
  generator detects this and flags it so trend lines can exclude it rather than
  appear to collapse.

## Provenance

Every response carries `meta.source: "real" | "placeholder"`. Anything
`placeholder` renders behind a visible badge. This is a type-system guarantee
rather than a discipline: the ML endpoints will return `placeholder` until a
model exists in Stage 20, which is long enough to forget.

`mlService` returns `null` rather than invented metrics — a reader cannot
distinguish a placeholder 0.81 precision from a measured one.

## Frontend structure

```
src/
  app/
    (dashboard)/        route group: sidebar shell + 8 analytics pages
    page.tsx            public landing (outside the group, no sidebar)
    globals.css         Tailwind v4 @theme design tokens
  components/
    ui/                 Card, Button, Badge, Select, Skeleton
    layout/             Sidebar, FilterPanel, PageHeader, nav-items
    states/             LoadingSkeleton, EmptyState, ErrorState
  services/             the data boundary
    dev/crashCube.ts    temporary in-memory query engine (deleted at Stage 23)
    fixtures.ts         temporary file reader (deleted at Stage 23)
    http.ts             the prepared API client
  types/                API contracts
  lib/                  cn(), formatters
```

Two route groups: `(dashboard)` wraps pages in the sidebar shell; the landing
page sits outside it and renders full-bleed.

Services are server-side only — they use `node:fs`. Pages are Server Components
that call services and pass plain data to client components. This keeps the
future API URL and any credentials off the client, and avoids shipping the cube
to the browser.

## Styling

Tailwind CSS v4, which is CSS-first: design tokens are declared in an `@theme`
block in `globals.css` rather than a `tailwind.config.ts`. Declaring
`--color-navy-900` generates `bg-navy-900`, `text-navy-900` and so on.

Palette: dark navy chrome, white/light-grey workspace, safety yellow as the one
high-emphasis accent, restrained blue for secondary, plus an ordinal severity
ramp used consistently wherever severity appears.

## Deployment note

`loadFixture` reads from `src/data/fixtures` at runtime via `process.cwd()`.
That works for `next dev` and `next start`, but a `standalone` build would not
copy `src/`. This disappears at Stage 23 when fixtures are replaced by HTTP
calls; if a standalone build is needed sooner, the fixtures must move to
`public/` or be imported statically.
