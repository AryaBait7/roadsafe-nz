# RoadSafe NZ — Learning Guide

Built first, studied after. Each entry records what was used, where it lives,
why it was chosen, and what to be able to explain in an interview.

Work through this after the application is complete. Entries are added as
features are built.

---

## 1. Data quality: missing values that don't look missing

**What**: CAS writes the literal text `"Null"` into 8 columns instead of leaving
them empty. Pandas reads that as a valid category, so `df.isna()` misses it
entirely and every groupby silently gains a fake `"Null"` bucket.

**Where**: `data-pipeline/src/clean_data.py`, `NULL_STRING_COLUMNS`

**Why it matters**: we originally found 4 affected columns by eye. Scanning
*every* text column for the literal string found 4 more — including
`streetLight`, whose true missing rate is 50.5%, not the 17.3% first measured,
and `crashDirectionDescription` at 37.1% of all rows.

**Concepts to learn**: sentinel values vs. true nulls; why `isna()` is not
enough; verifying a fix is *complete* rather than just applied.

**Interview questions**
- How do you detect missing data that isn't encoded as null?
- You fixed a data-quality bug in three columns. How do you know there isn't a fourth?
- What breaks downstream if a sentinel string reaches a one-hot encoder?

---

## 2. Missingness mechanisms (MCAR / MAR / MNAR)

**What**: 28 roadside-object columns are missing for the *same* 57.3% of rows.
The obvious explanation — CAS started recording them in a later year — was
tested and proved false: `bridge` is populated across the full 2006–2026 range.
The likely truth is that null means "this object was not struck", i.e. zero.

**Where**: `data-pipeline/notebooks/02_eda.ipynb` section 1; [DECISIONS.md](DECISIONS.md) #5

**Why it matters**: if you assume MCAR and impute the mean, you inject fake
signal into a column that should be 0.

**Concepts to learn**: MCAR vs MAR vs MNAR; when imputation is safe; treating a
systematic missingness pattern as a clue rather than noise.

**Interview questions**
- Define MCAR, MAR and MNAR with an example of each.
- A block of columns is missing for exactly the same rows. What do you check first?
- When is dropping rows worse than imputing, and vice versa?

---

## 3. Coordinate reference systems

**What**: CAS ships coordinates as NZTM2000 (EPSG:2193) — metres on a
projection fitted to New Zealand. Every web map expects WGS84 (EPSG:4326),
degrees of latitude/longitude. We reproject once, during cleaning, with `pyproj`.

**Where**: `data-pipeline/src/clean_data.py`, `reproject_coordinates()`

**Why it matters**: mixing two CRSs without converting produces points in the
ocean and meaningless distances. Doing it once in the pipeline means PostGIS,
the API and the map all receive the same thing.

**Concepts to learn**: projected vs. geographic CRS; EPSG codes; why NZ has its
own projection; `always_xy` and lon/lat ordering traps.

**Interview questions**
- Why can't you plot NZTM coordinates directly on Leaflet?
- When would you keep a projected CRS instead of converting to lat/lon?
- Our longitudes run −176.76 to 179.0. Is that corrupt data? (No — Chatham Islands cross the antimeridian.)

---

## 4. Class imbalance and choosing a target

**What**: `is_severe` (fatal or serious) is **6.72% of crashes**. That number
was measured before committing to the target, not assumed.

**Where**: `data-pipeline/src/clean_data.py`, `add_target()`; [DECISIONS.md](DECISIONS.md) #1

**Why it matters**: a model that always predicts "not severe" scores 93.3%
accuracy and is useless. This is why the plan specifies precision, recall, F1,
ROC-AUC and PR-AUC instead of accuracy.

**Concepts to learn**: accuracy paradox; precision/recall trade-off; why PR-AUC
beats ROC-AUC on imbalanced data; class weighting vs. resampling.

**Interview questions**
- Your model is 93% accurate. Why might that be worthless?
- When do you prefer PR-AUC over ROC-AUC?
- How would you pick the decision threshold for a road-safety model?

---

## 5. Temporal leakage and chronological splits

**What**: severe-crash rate sat at ~6.0–6.7% through 2021, then rose to ~8% for
2022–2025. Because the underlying process changed, train/test is split by time
rather than randomly.

**Where**: [DECISIONS.md](DECISIONS.md) #8; evidence in `02_eda.ipynb` section 5

**Concepts to learn**: data leakage; non-stationarity; why shuffling time series
inflates validation scores; backtesting.

**Interview questions**
- Why is a random split wrong when the data has a time trend?
- Give three examples of data leakage.
- How would you validate a model that will be deployed on future data?

---

## 6. Leakage from target-derived columns

**What**: `fatalCount` and `seriousInjuryCount` *define* `crashSeverity`, which
defines `is_severe`. They are excluded from the feature set and used only for
descriptive statistics.

**Where**: [DATA_DICTIONARY.md](DATA_DICTIONARY.md), "Fields to exclude from modeling"

**Interview questions**
- What is target leakage and how do you spot it before training?
- Your model hits 0.99 AUC on the first try. What do you check?

---

## 7. Correlation vs. causation in the product's language

**What**: CAS has no crash-cause column, so the UI says "conditions recorded
present", never "contributing factors" or "causes".

**Where**: `src/services/analyticsService.ts`; [DECISIONS.md](DECISIONS.md) #15

**Why it matters**: the data actively punishes sloppy language here. Crashes in
**fine weather are more often severe** (7.15%) than in rain (5.46%), and
"adverse weather" shows a **5.93% severe rate against a 6.72% baseline** —
below average. Bad weather likely suppresses speed. Calling weather a
"contributing factor to severity" would state the opposite of what the data shows.

**Concepts to learn**: confounding variables; selection effects; Simpson's
paradox; framing analytical findings honestly.

**Interview questions**
- Fine-weather crashes are more severe than wet-weather ones. Explain.
- What confounder would you control for, and how?
- How do you present a counterintuitive finding without overclaiming?

---

## 8. Pre-aggregation and the OLAP cube pattern

**What**: instead of shipping 705,609 rows, the pipeline pre-computes one
aggregate table (47,554 rows) at the grain the dashboard filters on. The
frontend groups that in memory.

**Where**: `data-pipeline/src/generate_frontend_fixtures.py`, `build_cube()`;
`frontend/src/services/dev/crashCube.ts`

**Why it matters**: the cube's dimensions/measures split is exactly how a star
schema and a SQL `GROUP BY` work, so the TypeScript translates directly into
the query that replaces it at Stage 19.

**Concepts to learn**: facts vs. dimensions; grain; star schema; roll-up;
cardinality (adding `holiday` took 29,324 rows to 47,554); columnar storage.

**Interview questions**
- What does "grain" mean, and how do you choose it?
- Why did adding one dimension grow the table by 62%?
- When do you pre-aggregate instead of querying raw rows?

---

## 9. Designing an API contract before the API exists

**What**: TypeScript interfaces define every planned endpoint's response. The
fixture files match those shapes exactly, so Stage 23 swaps `loadFixture()` for
`apiGet()` and nothing above the service layer changes.

**Where**: `frontend/src/types/api.ts`, `frontend/src/services/http.ts`

**Concepts to learn**: contract-first / schema-first design; dependency
inversion; the adapter pattern; programming to an interface.

**Interview questions**
- How do you build a frontend before the backend exists without creating rework?
- What is dependency inversion, in terms of a real file in this project?
- How would you keep frontend and backend types in sync at scale? (shared package, OpenAPI codegen)

---

## 10. Data provenance as a type

**What**: every response is `{ data, meta: { source: "real" | "placeholder" } }`.
Placeholder data renders behind a visible badge. `mlService` returns `null`
rather than fabricated metrics.

**Where**: `frontend/src/types/api.ts`, `frontend/src/services/mlService.ts`

**Why it matters**: the rule "never present mock data as real statistics" needs
a mechanism, not good intentions — the ML panels stay placeholder until Stage 20.

**Interview questions**
- How do you stop placeholder data reaching production-looking UI?
- Why return null instead of representative sample metrics?

---

## 11. Next.js App Router and Server Components

**What**: pages are Server Components that call services directly and pass
plain data to client components. Only genuinely interactive pieces (the sidebar
drawer) are `"use client"`.

**Where**: `frontend/src/app/(dashboard)/layout.tsx`, `components/layout/Sidebar.tsx`

**Concepts to learn**: server vs. client components; route groups `(dashboard)`;
why `_folder` is excluded from routing; `layout.tsx` nesting; the
server/client boundary and what may cross it (serialisable data only).

**Interview questions**
- What can't you do in a Server Component, and why?
- What does a route group change about the URL? (nothing — it's organisational)
- Why is keeping data fetching on the server better for secrets and payload size?

---

## 12. Tailwind CSS v4 design tokens

**What**: v4 is CSS-first. Tokens live in an `@theme` block in `globals.css`;
there is no `tailwind.config.ts`. Declaring `--color-navy-900` generates the
matching utilities.

**Where**: `frontend/src/app/globals.css`

**Concepts to learn**: design tokens; the v3 → v4 migration; utility-first CSS;
why `tailwind-merge` exists (later class must win a conflict).

**Interview questions**
- How do you keep a colour palette consistent across a large app?
- What problem does `tailwind-merge` solve that `clsx` doesn't?

---

## 13. Accessibility fundamentals

**What**: semantic landmarks, `:focus-visible` rings, `aria-current="page"` on
the active nav item, `role="dialog"` + `aria-modal` on the mobile drawer,
Escape-to-close, `sr-only` labels on icon buttons, and a global
`prefers-reduced-motion` block.

**Where**: `globals.css`, `components/layout/Sidebar.tsx`

**Concepts to learn**: WCAG contrast; why `:focus-visible` beats `:focus`;
accessible names; focus management in dialogs; reduced motion.

**Interview questions**
- Why `:focus-visible` rather than removing outlines?
- What makes an icon-only button accessible?
- How do you respect users who get motion sickness from animation?

---

## 14. Reading the linter instead of silencing it

**What**: ESLint flagged `useEffect(() => setDrawerOpen(false), [pathname])` as
a cascading-render risk. It was correct — the effect was redundant because the
nav links already close the drawer. Deleted, not suppressed.

**Where**: `components/layout/Sidebar.tsx`

**Concepts to learn**: "you might not need an effect"; derived state; when an
effect is genuinely required (external system sync).

**Interview questions**
- When is `useEffect` the wrong tool?
- What is a cascading render and why does it hurt?

---

## 15. Verifying work instead of assuming it

**What**: after building the service layer, a temporary route exercised every
service and re-totalled the results: 705,609 crashes, 41,263 serious, 6,182
fatal, 6,911 killed, 280,236 injured — each reconciled against figures measured
independently from the CSV. Severity, map and hotspot sums each re-total to
705,609 by separate paths. The route was then deleted.

**Why it matters**: `tsc` proves types line up; it says nothing about whether
the arithmetic is right. Type-correct code can be silently wrong.

**Interview questions**
- How do you know an aggregation pipeline is correct?
- What's the difference between type safety and correctness?
- What would you add to catch a regression here automatically? (a test asserting the totals)
