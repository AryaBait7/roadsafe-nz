# RoadSafe NZ — Project Progress

Living log of what's done, what's in progress, and what's next. Updated as phases complete.

## Current phase

**Frontend Stage 1 (Website Foundation) — complete.** Next up: Stage 1.5 (generate real-data fixtures), then Stage 2 (cinematic landing page).

> **Build order changed 2026-09-12.** The project is now frontend-first: the full interface is built against pre-aggregated real data, then the data/SQL/ML/API/AWS work is done and connected behind it. The target architecture is unchanged — see [DECISIONS.md](DECISIONS.md) #10. Data work already completed (Phases 1–3 below) still stands.

## Frontend stages

| Stage | Status |
|---|---|
| 1. Website foundation | ✅ Complete |
| 1.5 Real-data fixture generation | 🔲 Next |
| 2. Cinematic landing page | 🔲 |
| 3. Dashboard | 🔲 |
| 4–10. Trends, Map, Hotspots, Risk Factors, ML Insights, Reports, Data Dictionary | 🔲 |
| 11–12. Responsive/UX polish, loading & error states | 🔲 (primitives already built in Stage 1) |

### Stage 1 — Website Foundation (done 2026-09-12)

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
