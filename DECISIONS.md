# RoadSafe NZ — Architectural & Analytical Decisions

Record of significant decisions and the reasoning behind them, so the "why" survives even after the code changes.

---

## 1. Binary severity target (`is_severe`), not the 4-category `crashSeverity`

**Decision**: Model `is_severe` (True = Fatal or Serious Crash, False = Minor or Non-Injury Crash) rather than the original 4-class `crashSeverity`.

**Why**: The business question is about identifying *higher-risk* patterns, which is naturally a binary framing, and it matches the roadmap's stated hypothesis. Verified real class balance before committing: 6.72% severe / 93.28% not — a genuine, expected minority-class problem, not something invented to fit the plan.

**Status**: Confirmed, not revisited — no evidence yet that 4-class prediction would serve the business question better, and the imbalance is manageable with standard techniques (class weighting, PR-AUC evaluation) rather than needing a different target.

---

## 2. Fix disguised `"Null"` strings before doing anything else

**Decision**: 8 columns have the literal text `"Null"` as a value, not a true missing value — converted to real `NaN` in `clean_data.py` before any other processing: `weatherA`, `weatherB`, `roadSurface`, `flatHill` (found first), plus `crashDirectionDescription`, `directionRoleDescription`, `roadLane`, `streetLight` (found during the Phase 2 EDA pass, see #9 below).

**Why**: `df.isna()` silently misses these — they'd be treated as an extra valid category ("Null") in any groupby, encoding, or missing-value report, which would corrupt EDA findings and one-hot encodings downstream.

**How to apply**: Any new column pulled from the raw CAS export should be checked for this pattern before being trusted — see #9 for why "check the columns we already know about" isn't sufficient.

---

## 3. Reproject coordinates from NZTM2000 to WGS84 immediately after load

**Decision**: Add `longitude`/`latitude` (EPSG:4326) columns via `pyproj`, computed from the raw `X`/`Y` (EPSG:2193) columns, as part of `clean_data.py` rather than deferring to the PostGIS or frontend stage.

**Why**: NZTM2000 is meters on a NZ-specific projection; every downstream consumer (Leaflet/Mapbox for the frontend, PostGIS geometry columns, any future geospatial analysis) expects lon/lat. Doing it once in the cleaning step avoids every downstream layer needing its own conversion logic.

---

## 4. Drop `advisorySpeed`

**Decision**: Dropped in `clean_data.py`.

**Why**: 96% missing — not usable as a feature, and not worth an imputation strategy for a field this sparse.

---

## 5. Rejected the "mid-history schema change" theory for the 57.3%-missing roadside-object columns — decision on how to fill them is still open

**Context**: 28 columns (`bridge`, `fence`, `tree`, `vehicle`, etc.) are all missing for the exact same 57.3% of rows. Initial hypothesis (documented in the EDA notebook before testing) was that CAS started recording these only from some year onward.

**Finding**: Tested against `crashYear` — `bridge` is populated from 2006 through 2026, the full range. The schema-change theory is wrong.

**Working theory (not yet fully confirmed)**: NaN in these columns likely means "this object was not involved in the crash," functionally equivalent to 0, rather than "not recorded." This would match `feature_engineering.py`'s existing note that the generic `vehicle` column (also 57.3%-missing) looks like it's only populated when relevant.

**Open decision**: Before these columns reach modeling, decide whether to `fillna(0)` (if the NaN-means-zero theory holds) versus leaving them as true missing values with an imputation flag. **Not yet resolved** — needs either NZTA documentation or a closer look at a sample of populated vs. missing rows before Phase 4/6 work touches these columns.

**How to apply**: Don't treat this block of columns as "just missing data" in any future imputation step without revisiting this decision first.

---

## 6. `intersection` and `crashRoadSideRoad` are dead columns

**Decision**: Identified as 100% empty (0 non-null values across all 705,609 rows) during the Phase 2 EDA pass. Not yet dropped from `clean_data.py` — flagged for the next edit to that script.

**Why**: A column with zero non-null values carries no information and shouldn't be carried through cleaning/feature engineering/modeling.

---

## 7. IQR is not used as an outlier-removal rule for count/categorical-like numeric columns

**Decision**: Ran the standard IQR test on `speedLimit`, `NumberOfLanes`, `fatalCount`, `seriousInjuryCount` during EDA, but did not act on the results as a drop list.

**Why**: `NumberOfLanes` is mode-dominated (mostly 2), collapsing its IQR window to (2.0, 2.0) and flagging 24.2% of otherwise normal rows as "outliers." `fatalCount`/`seriousInjuryCount` are zero-inflated by nature (most crashes have 0 fatalities), so IQR flags any real fatality/injury as an outlier. `speedLimit` legitimately includes low values like 2–10 km/h for carparks/shared zones. None of these represent data quality problems.

**How to apply**: Don't apply an automatic IQR-based row filter to this dataset's count columns. If outlier handling is needed later (e.g. for a specific model sensitive to extreme values), revisit per-column rather than applying a blanket rule.

---

## 8. Preference for a chronological train/test split over random split

**Decision**: Not yet implemented (Phase 6 work), but reconfirmed as the intended approach based on Phase 2 findings.

**Why**: EDA shows severe rate shifted from ~6.0–6.7% (2006–2021) to ~7.8–8.0% (2022–2025) — a real trend, not noise (2026 excluded from this comparison as a partial year). A random split would let the model implicitly learn from future years to predict the past, which doesn't reflect how the model would actually be used (predicting on new, upcoming crashes), and could overstate performance if the recent-years shift is informative.

---

## 9. Verify a hardcoded "known-affected columns" list by re-scanning the whole dataset, not just by extending it when a new case turns up

**Context**: `clean_data.py`'s original `NULL_STRING_COLUMNS` list (`weatherA`, `weatherB`, `roadSurface`, `flatHill`) was built by noticing the disguised-`"Null"`-string bug in those 4 columns during initial cleaning. Running the Phase 2 EDA notebook, and specifically scanning **every** object column in the raw data for the literal string `"Null"` (`(df[c] == "Null").sum()` per column) rather than trusting that list, turned up 4 more affected columns: `crashDirectionDescription` (37.1% of all 705,609 rows), `streetLight` (33.3%, on top of its already-known real-NaN missingness), `directionRoleDescription` (0.6%), `roadLane` (0.1%).

**Impact of not catching this sooner**: `streetLight`'s true missing rate is 50.5%, not the 17.3% that showed up before the fix — the disguised-Null rows were being silently counted as a valid "Null" category. `crashDirectionDescription` at 37.1% is large enough to have skewed any groupby or encoding that used it.

**Decision**: Fixed the list in `clean_data.py` (now 8 columns) and re-ran the full pipeline (`clean_data.py` → `feature_engineering.py` → `02_eda.ipynb`) against the correction before writing up any findings, so nothing downstream is documented against stale numbers.

**How to apply**: When a data quality bug is found in one or a few columns, treat it as a signal to scan the *entire* dataset for the same pattern, not just patch the specific columns noticed by chance. This generalizes past this dataset — the same logic applies to encoding bugs, unit mismatches, or any other value-level data quality issue found later in the project.

---

## 10. Build the frontend first, before the database, ML and API

**Decision** (2026-09-12): the original 12-phase order (data → SQL → ML → API → frontend) is replaced by a frontend-first order. The full product interface is built against pre-aggregated real data, then the data/SQL/ML/API/AWS phases are worked through and progressively connected behind it.

**Why**: user's call — having the complete interface and UX in place first, then learning each underlying technology systematically with a concrete target to connect to.

**What did NOT change**: the target architecture. Still CAS → Python ETL → S3 → PostgreSQL/PostGIS on RDS → Python analytics/ML → Node/Express REST API → Next.js frontend → AWS. Specifically ruled out as shortcuts: swapping PostgreSQL for Supabase, querying a database directly from Next.js, coupling components to CSV files, putting analytics or ML in React.

**How to apply**: any frontend work must keep the UI → service layer → data source seam intact, so replacing the temporary data source with the REST API is a change to the service modules only.

---

## 11. Frontend consumes pre-aggregated fixtures, never the CSV directly

**Decision**: components call typed service methods (`dashboardService.getSummary()`); services read small JSON fixtures generated from the real dataset by a Python script. No component parses a CSV, and no CSV is imported into the frontend.

**Why**: `cas_crash_data_features.csv` is 285MB / 705,609 rows. It cannot be shipped to a browser or parsed per request. More importantly, the future Express API will not serve 705k raw rows either — it will return exactly these aggregates. So the fixture *shape is the API contract*, and building against it now means Stage 22 swaps the service body from `loadFixture(...)` to `apiGet(...)` and nothing else changes.

**How to apply**: if a new panel needs data, add a fixture + a service method with the future endpoint documented on it — never reach for the CSV from the frontend.

---

## 12. Every API response is enveloped with a real/placeholder provenance flag

**Decision**: all responses are `{ data, meta: { source: "real" | "placeholder", note? } }`. Panels backed by `placeholder` render a visible badge.

**Why**: the project rule that mock numbers must never be presentable as NZTA findings needs a mechanism, not just discipline. The ML panels have no model behind them until Stage 19, so they will carry placeholder data for a long time — long enough to forget. Making provenance part of the type system means the UI cannot silently show fake statistics.

---

## 13. "Crashes by time of day" is built as "crashes by light condition"

**Decision**: the dashboard's time-of-day panel reports the `light` column (Bright sun / Overcast / Twilight / Dark / Unknown) instead.

**Why**: verified programmatically that CAS as published has **no** time-of-day, month, day-of-week or timestamp column — across all 82 columns the only time fields are `crashYear` (integer), `crashFinancialYear` (string) and `holiday` (94.5% null, names a holiday period). A 24-hour chart would have to be fabricated. `light` is the closest real signal about conditions at the moment of the crash.

**Knock-on effects**: the date-range filter operates at year granularity only, and trend charts are annual — a day/month picker would imply precision the data does not have.

---

## 14. Leaflet + OpenStreetMap rather than Mapbox

**Decision**: `react-leaflet` for the Map Explorer.

**Why**: Mapbox requires an API access token. That means secrets handling in the frontend before there is any need for it, and it conflicts with the project's no-hard-coded-credentials rule. Leaflet with OpenStreetMap tiles needs no token or account. If the map later needs something only Mapbox offers, revisit then — with Secrets Manager already in the stack.

---

## 15. "Contributing factors" reframed as "conditions present"

**Decision**: the contributing-factors panel reports conditions *recorded as present* at crashes (weather, road surface, light, traffic control), not causes.

**Why**: CAS as we have it has no cause or contributing-factor column. Labelling condition co-occurrence as a "contributing factor" would assert causation the data cannot support — the fine-weather severity finding (see PROJECT_PROGRESS.md) is a concrete example of why that inference is dangerous here.

**Confirmed by the data** (2026-09-16): with a baseline severe rate of 6.72%, "adverse weather" crashes are severe only **5.93%** of the time — *below* average. Describing weather as a factor contributing to severity would state the opposite of what the dataset shows.

---

## 16. One aggregate cube rather than one fixture per view

**Decision**: the frontend's development data source is a single pre-aggregated table (`crash-cube.json`, 47,554 rows) at the grain (year, region, roadType, speedEnvironment, severity, light, holiday), plus separate fixtures for map cells and hotspots. Services group it in memory.

**Why**: the alternative — a pre-computed file per chart — cannot support filtering, because every filter combination would need its own file. The cube supports all of them. More importantly its dimensions/measures split is exactly a star schema, so `services/dev/crashCube.ts` maps one-to-one onto the SQL that replaces it at Stage 19: filters become `WHERE`, chart grouping becomes `GROUP BY`. The throwaway code teaches the real query.

**Alternative considered**: shipping the 299MB CSV and parsing client-side. Rejected — impossible in a browser, and the real API will serve aggregates too, so building against raw rows would design the frontend against a contract that will never exist.

---

## 17. Keeping `holiday` in the cube despite the size cost

**Decision**: `holiday` stays as a 7th dimension, taking the cube from 29,324 rows (3.9MB) to 47,554 rows (6.2MB).

**Why**: it is the **only** seasonality signal CAS offers — there is no month, weekday or date column. It also earns its place: Labour Weekend runs an 8.85% severe rate and Christmas–New Year 8.24%, against 6.65% outside holiday periods. 6.2MB read once per server process behind a cached promise is an acceptable price for the only temporal dimension available besides year.

---

## 18. Column-oriented fixture payloads

**Decision**: fixtures are stored as a `columns` header plus rows of bare values, decoded into objects on load, rather than as arrays of JSON objects.

**Why**: repeating 15 key names across 47,554 rows roughly triples file size for no benefit. The decode is ten lines and runs once — `loadCube()` caches the *promise*, not the value, so concurrent first requests share a single parse rather than each decoding 47k rows.

---

## 19. Map data is published as a grid, never as individual crash coordinates

**Decision**: `map-cells.json` snaps crashes to a 0.05° grid (~5.5km), giving 6,103 cells; individual crash lat/lon never reaches the browser.

**Why**: two reasons. Technically, 705,609 markers cannot be rendered or transferred. Ethically, these are real incidents in which real people were killed or injured — publishing exact coordinates invites identification of specific events at specific addresses, and the product's questions ("where are the higher-risk areas") are all answerable at grid resolution. The aggregate answers the question without the exposure.

**How to apply**: if a future feature seems to need individual crash points, treat that as a prompt to re-examine the question before lowering the resolution.

---

## 20. ML endpoints return null, not sample metrics

**Decision**: `mlService.getModelMetrics()` and `getFeatureImportance()` return `data: null` with `meta.source: "placeholder"` until a model exists (Stage 20). The ML Insights page will render an explicit "awaiting model" state.

**Why**: the obvious alternative is plausible-looking placeholder numbers so the page looks finished. But a reader cannot distinguish a placeholder precision of 0.81 from a measured one, and a screenshot of that page in a portfolio would be a false claim about a model that does not exist. Returning null makes the absence structural rather than a matter of remembering to add a caveat.

---

## 21. Build order restated: complete frontend first (27 stages)

**Decision**: stages 1–16 build every page against real-data fixtures; stages 17–27 build the pipeline, database, ML, API and AWS underneath; learning follows.

**Why**: a finished, navigable product is the portfolio artefact, and the service layer (#16, ARCHITECTURE.md) lets the backend be swapped in without touching pages. The target architecture is unchanged.

---

## 22. Filter state lives in the URL

**Decision**: all global filters, and hotspot selection (`?area=`), are query parameters parsed by `lib/filters.ts`.

**Why**: views become shareable and bookmarkable, back/forward works, and Server Components read filters directly. Cost: filtered routes render dynamically, and the sidebar reads `useSearchParams` inside Suspense because layouts receive no `searchParams`.

---

## 23. Landing intro is a real CSS 3D scene and replays on every visit

**Decision**: guardrails, lane markings and the sign sit at real depths in a `preserve-3d` world moved by one rAF camera. The intro plays on every visit to `/`, is skippable, and has a reduced-motion final state.

**Why**: a scrolled texture cannot contain objects that pass the camera. One transform write per frame stays on the compositor. The earlier `sessionStorage` suppression silently removed the opening when users returned home. No third-party video was used, so no copyrighted footage.

---

## 24. Fixed log-decade map bins, not quantiles

**Decision**: density bins are 1–10 / 11–100 / 101–1,000 / 1,001+ crashes.

**Why**: quantile bins are recomputed per filter, so the same colour would mean different counts on different views. Fixed bins keep colour comparable across filters and years.

---

## 25. Dark basemap via a CSS filter on OSM tiles

**Decision**: OpenStreetMap tiles darkened by a filter scoped to `.leaflet-tile-pane` (`.map-dark`).

**Why**: CARTO dark tiles returned HTTP 200 with an "API KEY REQUIRED" watermark baked into each image — the request check passed while the product was broken. This needs no key or account and leaves overlays unaffected.

---

## 26. No map plugin dependencies

**Decision**: no leaflet.heat, markercluster or icon packages; density is one GeoJSON layer on canvas, hotspots are circle markers.

**Why**: heatmaps blur counts into unreadable intensity, clustering hides an aggregate that already exists, and default marker icons break under bundlers. Fewer dependencies, honest encodings.

---

## 27. KPI deltas: only with a year range, coloured by good/bad

**Decision**: "vs previous period" appears only when a year range is selected, comparing an equal-length preceding period; a fall in crashes is green.

**Why**: without a range there is no honest comparison period. Colour follows meaning, not arrow direction. Approved deviation from the reference design, alongside keeping the validated sequential ramp instead of a rainbow legend.

---

## 28. Dashboard chart forms

**Decision**: severity as a donut with values in the legend; road type and region as hand-built bars; no hero image in the analytics workspace; every chart has a table view.

**Why**: four severity segments of very different sizes suit a donut; categories to compare suit bars. The table twin is required because the Minor severity colour is below 3:1 contrast.

---

## 29. Hotspot encoding: sqrt radius, distribution-based bins

**Decision**: circle area is proportional to crash count (radius ∝ √count); severe-rate bins <7 / 7–10 / 10–12 / 12%+ come from the spread across areas.

**Why**: linear radius exaggerates large areas by the square. Binning around the national 6.7% would put 40 of 68 areas in one bucket.

---

## 30. Risk factors measured against baseline; missing data excluded structurally

**Decision**: diverging bars of lift vs the baseline severe rate; `isMissingData` on the data excludes "Unknown" buckets; `MIN_SAMPLE` of 5,000 gates thin categories; excluded rows are listed, not hidden.

**Why**: "Unknown speed limit" would otherwise be the country's top risk factor and "Unknown light" its most protective one — recording artefacts, not findings.

---

## 31. ML Insights is honest before a model exists

**Decision**: the page shows only real facts (class balance, arithmetic baselines, the chronological split with real counts, features, leakage exclusions) and "—" for every metric.

**Why**: extends #20. The page is useful now and cannot be mistaken for a trained model.

---

## 32. Reports are generated from live data, client-side

**Decision**: the summary is written from current aggregates; five CSV exports are built in the browser from rendered rows (formula-injection guard, UTF-8 BOM); PDF is the browser print dialog; future reports are listed without downloads.

**Why**: exports always match the screen, and no fake documents exist. Server-side generation waits for the API.

---

## 33. Animated content always reaches its final state

**Decision**: the server renders final values; `CountUp` and `Reveal` arm a fallback timer at mount.

**Why**: an IntersectionObserver that never fires (hidden tab, print, odd viewport) left statistics at 0 and sections invisible. Animation is an enhancement, never a dependency.

---

## 34. The data dictionary is measured, and its prose has one source

**Decision**: `generate_data_dictionary.py` profiles the CSV for types, missing %, distinct counts and examples. It parses descriptions from DATA_DICTIONARY.md and reports undocumented or stale entries. Search on the page is local state, not URL state.

**Why**: typing figures in by hand invites drift, and that already happened: the markdown said 28 roadside-object columns when 21 exist. Parsing the markdown avoids keeping two copies of the prose. Search terms are ephemeral and not worth a shareable URL. Keeping them local also keeps the page static, unlike the filter state in #22.

---

## 35. Responsive intro: an overhead gantry, not a smaller world

**Decision**: below 1280px the sign moves from the roadside to an overhead gantry over the road. The switch uses CSS custom properties, and the stage is lightly scaled on phones.

**Why**: modelling the projection showed a roadside board 255 units out leaves a 375px screen by 4.4s. Keeping it in frame by scaling alone would need a scale of about 0.3, which shrinks the road and leaves an empty band below it. Gantry signs are real on NZ motorways, so the scene stays believable. CSS variables avoid a JavaScript breakpoint and a hydration-sensitive re-render.

---

## 36. Phone layouts get their own structure where tables fail

**Decision**: the data dictionary renders collapsible grouped cards below `lg` and the table above it. Maps are capped at 60svh on phones. Filters get a labelled entry point in the mobile top bar.

**Why**: a seven-column table on a phone either scrolls sideways, which hides the description people came for, or crushes every column. A tall map captures the swipes meant to scroll the page. A hamburger alone does not tell anyone the filters are behind it.

---

## 37. Motion explains change and never gates content

**Decision**: animation is used only for state changes (filter pending, bar widths) and a transform-only page entrance. Opacity is never animated from zero. JavaScript animation honours reduced motion explicitly.

**Why**: this extends #33. A frozen or skipped animation, as in a background tab, print or the preview pane, must leave the page usable. Moving bars show *how* a filter changed the values, which a redraw from zero hides. The global CSS reduced-motion rule looks complete but does not touch rAF-based chart libraries.
