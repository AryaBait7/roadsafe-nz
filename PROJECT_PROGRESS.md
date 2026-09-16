# RoadSafe NZ — Project Progress

Living log of what's done, what's in progress, and what's next. Updated as phases complete.

## Current phase

**UI refinement pass complete** (road intro rebuild, compact dashboard, landing page). Next up: Stage 7 (Hotspots).

### UI refinement (2026-09-16)

Seven requested changes, all against the existing components — no rebuild.

**Road intro rebuilt as a real 3D scene.** The old version scrolled a gradient texture across a tilted plane, which cannot produce guardrail posts that pass the camera or a sign you approach, because a texture contains no objects. Now every element sits at a real depth in a `preserve-3d` world with one rAF-driven camera; perspective does the rest at one transform write per frame. Measured: the sign grows 49.7px → 297.1px (6.0×, monotonic). The intro also plays on **every** visit to `/` — it was previously suppressed by a `sessionStorage` flag, so returning home silently lost the opening.

**Dashboard reworked to the reference.** 12-column grid at 5/3/4, map holding the left five columns across both lower rows. Density came from padding, gaps and control heights, not type size: **1,117px tall at 1440×900**, so all but ~200px is in the first screen. Severity became a donut (values in the legend, so the 0.9% Fatal slice never needs an in-arc label). KPI cards became five equal peers with real period-over-period deltas, coloured by whether the movement is *good* — fewer crashes is green.

**Landing page**: count-up statistics, polished explore cards, and a data-driven news section rendering labelled placeholders until real items are supplied.

**Three bugs found that all passed automated checks:**

| Bug | Why checks missed it |
|---|---|
| Dark basemap served watermarked tiles | CARTO returns HTTP 200 with "API KEY REQUIRED" stamped on unkeyed tiles, so `tilesLoaded: 6` was true and meaningless. Replaced with OSM tiles darkened by a CSS filter on the tile pane |
| Map rendered no cells inside the flex card | Leaflet cached a stale container size measured before flex resolved, drawing cells outside the viewport. Tiles still loaded fine. Fixed with explicit height + `ResizeObserver` → `invalidateSize` |
| Counters and reveals could strand at zero/invisible | Both depended on an `IntersectionObserver` that might never fire. Fallback timers now armed at mount, independent of the observer |

**Known limitation**: `requestAnimationFrame` does not fire in the preview pane, so the road animation and the count-up motion could not be observed here. The projection maths and final values are verified; the motion itself needs checking in a real browser.

> **Build order changed 2026-09-12, restated 2026-09-16.** Build the complete application first, then study it via [LEARNING_GUIDE.md](LEARNING_GUIDE.md). The target architecture is unchanged — see [DECISIONS.md](DECISIONS.md) #10 and [ARCHITECTURE.md](ARCHITECTURE.md). Data work already completed (below) still stands.

## Stages

| # | Stage | Status |
|---|---|---|
| 1 | Audit + stabilise frontend architecture | ✅ Complete |
| 2 | Cinematic landing page | ✅ Complete |
| 3 | App shell: sidebar, header, routing, global filters | ✅ Complete |
| 4 | Dashboard | ✅ Complete (hotspots map backfilled in Stage 6) |
| 5 | Crash Trends | ✅ Complete |
| 6 | Map Explorer | ✅ Complete |
| 7 | Hotspots | 🔲 |
| 8 | Risk Factors | 🔲 |
| 9 | ML Insights | 🔲 |
| 10 | Reports | 🔲 |
| 11 | Data Dictionary | 🔲 |
| 12 | Responsive/mobile | 🟡 Shell is responsive; per-page work pending |
| 13 | Animation + UX polish | 🔲 |
| 14 | Loading/error/empty states | 🟡 Primitives built; per-page wiring pending |
| 15 | Consistency + accessibility pass | 🔲 |
| 16 | Frontend testing + performance | 🔲 |
| 17–21 | Data pipeline, PostGIS, analytics, ML, explainability | 🟡 Pipeline + EDA + features done (see below) |
| 22 | Node/Express REST API | 🔲 |
| 23 | Connect frontend to real API | 🔲 |
| 24–27 | AWS, CI/CD, testing, portfolio docs | 🔲 |

### Stage 1 part B — data layer (done 2026-09-16)

The service layer previously pointed at fixture files that did not exist, so every data-backed page would have thrown. Built the real data source:

- **`data-pipeline/src/generate_frontend_fixtures.py`** turns the 299MB features CSV into 7.8MB of committed JSON: `crash-cube.json` (47,554 aggregate rows, 7 dimensions × 8 measures), `map-cells.json` (6,103 grid cells × year), `hotspots.json` (68 territorial authorities), `filter-options.json`.
- **`src/services/dev/crashCube.ts`** — in-memory query engine over the cube, caching the parse promise. Deliberately mirrors the SQL that replaces it at Stage 19.
- **All four services rewritten** against real data. `mlService` returns `null` + `placeholder` rather than invented metrics ([DECISIONS.md](DECISIONS.md) #20).
- Added `getHolidayBreakdown()` — the only seasonality dimension CAS supports.

**Verified by execution, not assumption.** A temporary route exercised every service and re-totalled the output; it was deleted afterwards. All reconciliations passed against figures measured independently from the CSV:

| Check | Result |
|---|---|
| Total crashes | 705,609 ✅ |
| Serious / Fatal | 41,263 / 6,182 ✅ |
| People killed / injured | 6,911 / 280,236 ✅ |
| Severity sum re-totals | 705,609 ✅ |
| Map cell sum re-totals | 705,609 ✅ |
| Hotspot sum re-totals | 705,609 ✅ |
| Filtering (Waikato 2020–2024) | 19,383 crashes ✅ |
| Partial-year detection | 2026 auto-flagged ✅ |

**Findings that will shape the UI:**
- **Local road – open road is the most dangerous category**: 12.15% severe rate, higher than state highway – open road (8.84%) and more than double local road – urban (5.03%).
- **Unsealed roads**: 12.95% severe vs the 6.72% baseline.
- **Adverse weather is *below* baseline** at 5.93%. Consistent with the earlier fine-weather finding — the language on the Risk Factors page must not imply weather worsens severity.
- **Holiday periods are genuinely worse**: Labour Weekend 8.85%, Christmas–NY 8.24%, vs 6.65% outside holidays.
- **Data-quality flag**: crashes with `light = "Unknown"` show a 0.32% severe rate (32 of 9,861) — far too low to be real, so "Unknown" is likely a recording artifact rather than a category. Should be excluded from rate comparisons.

Also written this stage: [ARCHITECTURE.md](ARCHITECTURE.md) and [LEARNING_GUIDE.md](LEARNING_GUIDE.md) (15 topics with interview questions).

### Stage 6 — Map Explorer (done 2026-09-16)

Leaflet + OpenStreetMap, no new dependencies. Also backfills the dashboard's hotspots panel, which was deferred from Stage 4.

**The fixture got smaller while gaining a capability.** The region filter did nothing on the map because `map-cells.json` had no region dimension. But a cell sits in exactly one region, so region is *cell metadata*, not a row dimension — 6,103 entries rather than 61,008. Restructuring rows to reference a cell index instead of repeating `lat`/`lon` on every row took the file from **1.48MB to 1.08MB** *and* added region filtering. Re-verified after the restructure: 705,609 / 47,445 still reconcile exactly, all 6,103 cell indices in range.

**Colour bins are fixed log decades, deliberately not quantiles.** The distribution is extreme — median 11 crashes per cell, max 25,172, top 1% of cells holding 52.5% of all crashes — so linear breaks put the whole country in one bin. Quantiles fix that but **recompute on every filter change**, repainting cells whose value never moved; that is the recolor-on-filter anti-pattern. Fixed bins (1–10 / 11–100 / 101–1,000 / 1,001+) keep colour meaning stable and map onto the four validated ramp steps.

Measured spread, which confirms the choice: 48.5% / 39.7% / 10.0% / 1.9% of cells, with the top bin holding 444,854 crashes.

**Performance:** all 6,103 cells go into a *single* `<GeoJSON>` layer with Leaflet's canvas renderer, not 6,103 React components — reconciling thousands of components per pan would make the map unusable.

**Other decisions:**
- **No `leaflet.heat` or `leaflet.markercluster`.** The grid *is* a binned density surface and the TLA aggregation *is* the cluster view, so the spec's heatmap/cluster intent is met without two more dependencies.
- **Antimeridian:** 24 Chatham Islands cells sit at ≈ −176.7°, which would otherwise stretch the viewport across the globe from a mainland at +166 to +179. They are unwrapped to ≈ +183 so the range is contiguous and the default view fits the mainland.
- **Popups are built as DOM nodes with `textContent`**, not HTML strings — labels are data, and string-concatenated `innerHTML` is the wrong habit even for your own data.
- **The map states which filters it cannot honour.** Road type, speed environment and severity are not carried at cell grain; rather than silently ignoring them, the page says so.

**Verified:** 20/20 OSM tiles load; canvas renderer active; cells render as proper graduated squares when zoomed (confirmed over Nelson/Tasman); clicking a cell opens a popup reading "Nelson Region · Crashes: 306 · Serious or fatal: 21 · Severe rate: 6.9% · Cell centre: −41.25, 173.25"; dashboard map mounts at 378px with no horizontal overflow.

**Known, accepted:** on the "Serious & fatal" view the 1,001+ bin is empty (no cell has that many severe crashes). The legend still shows it, because a legend that reshuffles per view would make the two views incomparable — which is the same reason quantile bins were rejected.

**Data-quality note:** one cell sits at `[-47.5, 179.0]` with region "Unknown" — open ocean southeast of the mainland, near the Bounty Islands, where no roads exist. Almost certainly a bad coordinate in CAS. One cell of 6,103, left in rather than silently filtered.

### Stage 5 — Crash Trends (done 2026-09-16)

Two new service methods, both plain cube group-bys: `getRegionBreakdown()` and `getSeverityTrends()`. `TrendChart` gained a `color` prop.

**What the spec asked for that the data cannot support**, stated on the page rather than silently omitted:
- **Month and weekday/time exploration** — impossible. CAS has no month, day or timestamp column. Seasonality comes from the `holiday` dimension instead, and it is a real signal: Labour Weekend 8.8% severe and Christmas–New Year 8.2%, against a 6.6% baseline outside holiday periods.

**Form decisions:**
- **Region comparison is a ranked bar list, not a multi-line chart.** 16 regions is double the eight-slot categorical ceiling, and all-pairs chart forms cap at three series — sixteen lines would be a straight anti-pattern.
- **Severity over time is four small multiples**, each on its own scale. The rendered y-axes make the case concretely: Fatal tops out at 380, Serious 2,600, Minor 10,000, Non-Injury 30,000. On one shared axis the two levels that matter would sit on the baseline.
- **The holiday chart excludes "Not a holiday period."** At 666,835 of 705,609 crashes it would flatten the four real periods to slivers; it is stated as the baseline in the panel description and kept in the table.

**Real findings surfaced:**
- **West Coast has the highest severe rate in the country at 11.0%** on only 6,426 crashes, while **Auckland has the lowest at 4.5%** on 235,352. Consistent with the earlier local-road/open-road result — rural open roads are where crashes turn serious.
- Northland 9.3%, Tasman 9.5% and Canterbury 8.7% also run well above the 6.7% national rate.

**Verified:** trend x-axis runs 2007–2025 with the partial 2026 excluded from every line but kept in every table; tooltip reads correctly ("2016 Crashes : 37,250"); all six chart strokes match their assigned colours (`#2e6fd9` ×2, then `#a31621` / `#d9534f` / `#e8a33d` / `#2e6fd9`) and the legend swatches match the lines exactly; 17 region rows; build and lint clean.

**Bug caught by lint, not by eye**: `TrendChart` accepted a `color` prop but never applied it, so all four severity charts were drawing in the same blue while their legend swatches showed the correct distinct colours — which would have looked deliberate. The `no-unused-vars` warning was the only thing that flagged it.

### Stage 4 — Dashboard (done 2026-09-16, map outstanding)

**Colour was computed, not chosen.** Every chart hex was validated with the dataviz skill's `validate_palette.js` against the real card surface (`#ffffff`). Three candidate palettes failed first:

| Candidate | Why it failed |
|---|---|
| Existing brand severity tokens | `#8ca0b3` chroma 0.036 vs a 0.10 floor — it read as grey and stopped carrying identity |
| Reference status scale (good→critical) | yellow↔orange ΔE 8–9 normal vision, 2–3 under protanopia. **Structurally unfixable** — a 4-step status ramp has amber and orange as inherent neighbours |
| Sequential ramp, first three attempts | light end 1.23–1.79:1 vs a 2:1 floor |

The passing set: severity `#a31621 / #d9534f / #e8a33d / #2e6fd9` (all six checks PASS) and a 4-step sequential ramp `#86b6ef → #104281` for the map. Notably my original tokens were already 3/4 correct — the validator found precisely the one that wasn't. Full provenance is in `src/lib/chart-theme.ts`.

One WARN is outstanding by design: Minor at 2.16:1. That is **not dismissable** — it obligates a relief channel, so every chart ships visible value labels *and* a table view. Removing either makes the palette non-compliant.

**Form decisions, and what was rejected:**
- **KPI row** of stat tiles, not a grouped bar chart. Total crashes is the single hero figure. **No delta indicators** — there is no user-chosen comparison period, and inventing one would fabricate a statistic. Proportional figures, since `tabular-nums` makes large standalone numbers look loose.
- **Trends as small multiples.** The spec asked for four severity series on one line chart, but Non-Injury (485,478) against Fatal (6,182) flattens the two series that matter, and rescuing that with a second y-axis is the single worst charting mistake. Two measures of different scale became two charts sharing an x-axis.
- **Severity as a horizontal stacked bar, not a donut.** Fatal is 0.88% — an unlabelable sliver in a donut.
- **Nominal bars in one hue.** Colouring bars by their own value would re-encode what length already shows.
- **Bars hand-built in HTML**, Recharts reserved for the trend chart. The mandated 2px *surface gap* between stacked segments is exact in CSS, and the guidance forbids faking it with a stroke.
- **ML panel renders an honest "awaiting model" state** — no invented feature importances.

**Verified in the browser:**

| Check | Result |
|---|---|
| Figures | Hero 705,609; 41,263 / 6,182 / 6,911 / 280,236, each tile stating its period |
| Panel data | Severity sums to 705,609; conditions, light and road-type rows match the Stage 1 smoke test |
| Trend charts render | 2 SVGs at 882×200, one line path each, real axes and gridlines |
| Partial year | Chart plots **20** points (1 M + 19 C, cross-checked via 58 coord pairs); table keeps **21** rows through 2026 |
| Table toggle | Label flips, `aria-expanded` updates, real `<table>` with caption and correct rows |
| Overflow | None at 1440px |
| Console | Fresh tab: no errors |
| Build / lint | Clean (after fixing Recharts 3's changed `Tooltip` formatter signature) |

**Outstanding**: the NZ hotspots map. Leaflet needs a `dynamic()` import with `ssr: false` (it touches `window` at module scope), cell binning onto the validated sequential ramp, and a scale legend. Deferred to Stage 6, where the full Map Explorer is built.

### Stage 3 — App shell and global filters (done 2026-09-16)

**The architectural decision: filter state lives in the URL, not React state.** A filtered view is shareable and survives refresh, Server Components read `searchParams` and fetch already-filtered data with no client round-trip, and the query string is already the shape the REST API will take — so Stage 23 changes the service bodies and nothing above them.

A Next.js constraint shaped the split: **layouts do not receive `searchParams`, only pages do.** So the filter *panel* (in the sidebar, inside the layout) reads the URL client-side via `useSearchParams`, while each *page* parses `searchParams` server-side. `parseFilters()` makes that one line per page.

Built:
- **`src/lib/filters.ts`** — parse, serialise, describe and remove-one-filter helpers. Pure, so it runs on both sides of the boundary. Malformed values are dropped rather than coerced (`?yearFrom=banana` becomes "no filter", not year 0) and a reversed year range is swapped rather than silently matching nothing.
- **`FilterPanel.tsx`** — holds a *pending* draft so changing a dropdown doesn't navigate on every interaction; Apply pushes the query string, Reset clears it. Draft resync on URL change uses `key={searchParams.toString()}` to remount rather than a `setState` in an effect.
- **`FilterSummary.tsx`** — Server Component showing active-filter chips (each a link removing just that filter, with the year chip clearing both ends) plus a live match count. This is what stops the filters looking decorative.
- **`NavIcon.tsx`** — eight hand-rolled inline SVGs rather than an icon dependency.
- **`(dashboard)/layout.tsx`** — now async, fetches filter options once for all pages.
- All 8 pages accept `searchParams` and render the shared summary.

**Verified in the browser, both directions:**

| Check | Result |
|---|---|
| URL → UI | `?region=Waikato+Region&yearFrom=2020&yearTo=2024` → selects show 2020 / 2024 / Waikato |
| Option counts from real fixture | 22 years, 17 regions, 5 road types, 6 speed environments, 5 severities |
| UI → URL | Changing Road type enabled Apply (disabled→enabled); click pushed the new query string |
| Filtering is real | 705,609 → **19,383** (Waikato 2020–2024) → **4,582** (+ local road, open road) |
| Cross-checked | 19,383 matches the figure the Stage 1 smoke test computed independently from the cube |
| Reset | Cleared all params, count restored to 705,609 |
| Chips | Remove-one links correct; year chip clears both ends; Clear all present |
| Nav | 8 links, all with icons, `aria-current="page"` on the active item |
| Mobile 375px | Drawer opens with 8 links + 6 selects + Apply, no horizontal overflow |
| Build / lint | Clean |

**Expected side effect**: the analytics routes moved from `○ (Static)` to `ƒ (Dynamic)` in the build output. Correct — a page whose content depends on the request's query string cannot be prerendered. The sidebar wraps `useSearchParams` in `<Suspense>` so the shell around it still prerenders.

### Stage 2 — Cinematic landing page (done 2026-09-16)

Built in `frontend/src/features/landing/`:

- **`RoadScene.tsx`** — the moving road, drawn entirely in CSS. No video or photograph. A plane rotated under `perspective` produces a true vanishing point, so lane markings foreshorten and accelerate on their own rather than being scaled. Depth layers (posts → hills → mountains → sky) each move at their own rate.
- **`useIntroSequence.ts`** — the 6.2s phase machine (`travel → slowing → title → reveal → done`), with Skip, Replay, once-per-session suppression via `sessionStorage`, and a reduced-motion bypass.
- **`HeroIntro.tsx`** — wordmark emerging from the vanishing point, tagline, CTA, scroll hint. All hero text is in the DOM from first render; only its *appearance* animates, so crawlers and screen readers get the full hero regardless of phase.
- **`LandingNav.tsx`** — transparent over the hero, solid on scroll.
- **`LandingSections.tsx` / `Reveal.tsx`** — "What is RoadSafe NZ", five feature cards, closing CTA and footer, with IntersectionObserver reveals. A Server Component, so it ships no JS of its own.
- **`app/page.tsx`** — pulls headline figures through `dashboardService`, so the landing page shows **real CAS aggregates** (705,609 / 41,263 / 6,182 / 2006–2026), not marketing copy.

**Four genuine bugs found and fixed** (all written up in [LEARNING_GUIDE.md](LEARNING_GUIDE.md) 15–19):

| Bug | Cause |
|---|---|
| Wordmark faded instead of travelling forward | Tailwind v4 collapses identity `scale`/`translate` to `transform: none`, which has no interpolable start value |
| Lane dashes jumped once per loop | Gradient serialised to a 44px period while the animation shifted by 160px |
| Road rendered as a solid wedge | The plane projected to `y 318–496` while its container occupied `496–918` — rotation pivoted on the top edge instead of the bottom |
| Hydration mismatch | The skip decision read `matchMedia`/`sessionStorage` in a lazy `useState` initialiser; the server has neither |

**Verified by measurement**: road geometry inside its wrapper and reaching the screen bottom; all three marking layers seamless (period 160 = pitch 160); transform ramp interpolating `scale(0.35) → scale(1)`; speed ramp 0.42s → 1.5s → 4s → 7s → 9s with play/pause correct per phase; zero hydration errors; session-replay suppression working; mobile 375px with **no horizontal overflow**; build and lint clean.

**Known limitation**: `prefers-reduced-motion` is implemented (pre-paint bypass via `useLayoutEffect`) but **not browser-verified** — the tooling here cannot emulate that media feature. Worth confirming manually before the portfolio demo.

**Process note worth keeping**: a long stretch of this stage was spent chasing a wordmark that instrumentation reported as broken and that was in fact rendering correctly. The browser pane was hidden, which freezes CSS transitions at their start values, so `getComputedStyle` and `getBoundingClientRect` both reported stale figures and agreed with each other while being wrong. A screenshot settled it. Lesson recorded as LEARNING_GUIDE #19.

### Earlier — Website Foundation (done 2026-09-12)

Scaffolded in `frontend/`: **Next.js 16.3.5, React 19.2.8, Tailwind CSS v4, TypeScript 5**. Added Recharts 3.10, react-leaflet 5.0 + Leaflet 1.9, clsx, tailwind-merge — no peer conflicts.

- **Design tokens** in `src/app/globals.css` using Tailwind v4's CSS-first `@theme` (navy chrome, safety-yellow accent, restrained blue, neutral surfaces, an ordinal severity ramp). Global `:focus-visible` ring and a `prefers-reduced-motion` block.
- **Type contracts** (`src/types/api.ts`) for every planned endpoint. Each response is enveloped as `{ data, meta }` where `meta.source` is `"real"` or `"placeholder"`.
- **Service layer** (`src/services/`) — `dashboardService`, `crashService`, `analyticsService`, `mlService`. Each method documents the endpoint that will replace it. `fixtures.ts` is the temporary source; `http.ts` is the pre-built swap point.
- **UI primitives**: Card, Button, Badge (incl. `PlaceholderBadge` and `SeverityBadge`), Select, Skeleton.
- **State primitives** built early so all nine pages inherit them: `ChartSkeleton`/`KpiSkeleton`/`TableSkeleton`, `EmptyState`, `ErrorState`.
- **Layout shell**: dark navy sidebar with the 8 nav links + filter panel; collapses to a top bar + drawer below `lg`. Drawer closes on Escape, overlay click, and navigation.
- 8 dashboard routes under an `app/(dashboard)/` route group, each with page metadata; temporary landing page at `/` pending Stage 2.

Verified in-browser: routing and per-page titles work, active nav state correct, mobile drawer opens/closes, **no horizontal overflow at 375px or 1440px**, no console errors. `tsc --noEmit` and `eslint` both clean.

One lint finding fixed rather than suppressed: a `useEffect` that called `setState` on pathname change was redundant (nav links already close the drawer) and was removed.

## Data phases (completed before the order change)

## Completed

### Phase 1 — Dataset & Problem Definition
- Downloaded the NZTA Crash Analysis System (CAS) open dataset from Waka Kotahi's open data portal.
- Raw file: `data-pipeline/data/raw/cas_crash_data.csv` — **705,609 rows × 72 columns**, ~191MB. Gitignored (over GitHub's 100MB limit, and a dataset this size doesn't belong in git history regardless).
- Core business question defined: where, when, and under what road/environmental conditions do serious crashes occur in NZ, and can historical data surface higher-risk patterns.

### Phase 2 — Data Cleaning & EDA
Cleaning (`data-pipeline/src/clean_data.py`):
- Fixed CAS's disguised missing-value marker: the literal string `"Null"` was being read as a real category by pandas in 8 columns — `weatherA`, `weatherB`, `roadSurface`, `flatHill`, plus 4 more found during the EDA pass below (`crashDirectionDescription`, `directionRoleDescription`, `roadLane`, `streetLight`) — converted to actual `NaN`.
- Reprojected crash coordinates from NZTM2000 (EPSG:2193, meters) to WGS84 lon/lat (EPSG:4326) via `pyproj`, for future web mapping (Leaflet/Mapbox expect lon/lat).
- Dropped `advisorySpeed` (96% missing, unusable).
- Created the binary target `is_severe` (True = Fatal or Serious Crash) from the 4-category `crashSeverity` field.
- Output: `data-pipeline/data/processed/cas_crash_data_clean.csv` (705,609 rows × 74 columns — +2 from `longitude`/`latitude`, −1 from dropping `advisorySpeed`, +1 from `is_severe`).

Formal EDA (`data-pipeline/notebooks/02_eda.ipynb`, executed 2026-09-07):
- **Found a real bug in `clean_data.py` while running EDA**: scanning every raw object column for the literal `"Null"` string (rather than trusting the original 4-column list) turned up 4 more affected columns — `crashDirectionDescription` (37.1% of all rows!), `streetLight` (33.3% on top of its already-known missingness), `directionRoleDescription` (0.6%), `roadLane` (0.1%). Fixed in `clean_data.py`, and the whole pipeline (clean → feature engineering → EDA) was re-run against the correction — the numbers below are post-fix. `streetLight`'s true missing rate turned out to be 50.5%, not the 17.3% first measured.
- **Missing values**: `intersection` and `crashRoadSideRoad` are 100% empty (0 non-null rows) — dead columns. `temporarySpeedLimit` (97.9%), `weatherB` (96.7%), `pedestrian` (96.6%), `holiday` (94.5%) are heavily sparse. A block of 28 roadside-object columns (`bridge`, `fence`, `tree`, `vehicle`, etc.) are all missing for the same 57.3% of rows.
- Tested and **rejected** the hypothesis that the 57.3%-missing block was a mid-history CAS schema change: `bridge` is populated across the full crashYear range (2006–2026), not just a subset. The more likely explanation is that NaN in these columns means "object not involved," not "not recorded" — a fill-with-0 decision, not a drop-or-impute-as-missing one. See [DECISIONS.md](DECISIONS.md).
- **Duplicates**: 0 fully duplicated rows, 0 duplicate `OBJECTID` values — no dedup step needed.
- **Outliers**: IQR flags 24.2% of `NumberOfLanes` and single-digit-to-low-double-digit percentages of `fatalCount`/`seriousInjuryCount` as "outliers," but this is an artifact of IQR on heavily mode-dominated count columns, not real anomalies. Not treated as a data quality problem.
- **Severity distribution**: `is_severe` = 6.72% True / 93.28% False — confirms the expected class imbalance.
- **Trend over time**: severe rate held ~6.0–6.7% from 2006–2021, then rose to 7.8–8.0% for 2022–2025 (2026 is a partial year at 8.7%, not yet comparable). Supports using a chronological train/test split for modeling rather than a random split.
- **Weather vs. severity** (counterintuitive): Fine weather has a *higher* severe rate (7.15%) than Light rain (5.46%) or Heavy rain (5.70%) — plausible explanation is that adverse weather suppresses speed/crash energy even if it doesn't reduce crash count.
- **Road surface vs. severity**: Sealed 6.6%, Unsealed 12.9% (n=14,333), End of seal 15.6% (n=179, small sample) — confirms the `is_unsealed_road` feature is well-motivated.

### Phase 3 — Feature Engineering
`data-pipeline/src/feature_engineering.py`, run on the cleaned data:
- `total_vehicles_involved` — sum of 12 vehicle-type columns (excludes the legacy `vehicle` field and `train`, which is grouped with roadside objects in this schema, not vehicle types).
- `adverse_weather` — flag from `weatherA` (Heavy rain / Light rain / Mist or Fog / Snow / Hail or Sleet) or `weatherB` being present (Frost / Strong wind).
- `is_unsealed_road`, `is_hill_road`, `is_low_light`, `is_uncontrolled_intersection` — road/environment condition flags.
- `road_hazard_score` — composite sum of the 5 hazard flags above.
- `speed_limit_binned` — speed limit bucketed into low/medium/high/very-high.
- Output: `data-pipeline/data/processed/cas_crash_data_features.csv`.

Not yet added from the original roadmap wording: night/weekend/season time-based features (only `is_low_light` exists as a time-adjacent proxy so far).

## Not started

Data/backend stages (now scheduled after the frontend): PostgreSQL/PostGIS, analytics layer, ML (baseline → logistic regression → random forest → XGBoost), SHAP explainability, Node/Express API, wiring the frontend services to that API, AWS deployment, CI/CD & monitoring, portfolio polish.

## Problems encountered

- CAS uses the literal string `"Null"` instead of a true empty value in several columns — caught only by inspecting `df[col].unique()`, not by `df.isna()`. See `clean_data.py` comment.
- Coordinates are in NZTM2000, not lon/lat — required an explicit `pyproj` reprojection step before any web mapping or PostGIS work.
- Initial theory about why ~57% of rows are missing the roadside-object columns (mid-history schema change) was wrong — verified against `crashYear` before acting on it, per the "don't assume MCAR" rule in the EDA notebook.
- The disguised-`"Null"`-string cleaning step only covered 4 of the 8 affected columns until this EDA pass caught the other 4 (see above) — a reminder to scan systematically (`(df[col] == "Null").sum()` across every object column) rather than extending a hardcoded list by inspection alone.

## Next steps

1. **Stage 1.5** — write `data-pipeline/src/generate_frontend_fixtures.py` to turn the 285MB features CSV into the small JSON aggregates the services expect (dashboard summary, trends, severity, light conditions, road types, condition factors, hotspots, map points, filter options).
2. **Stage 2** — cinematic landing page.
3. Still open from the data work: drop the two 100%-empty columns (`intersection`, `crashRoadSideRoad`) from `clean_data.py`, and resolve how to treat the 57.3%-missing roadside-object block (fill 0 vs. true missing) before modelling.
