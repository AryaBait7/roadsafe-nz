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

## 15. Tailwind v4 composes transforms — and collapses them to `none`

**What**: the landing wordmark was supposed to emerge from the vanishing point,
growing from `scale(0.35)` to full size. It faded in instead, with no scale at
all. Measuring the element showed `--tw-scale-x: 100%` and
`--tw-translate-y: 0px` set correctly, yet `transform` computing to `none`.

**Why**: v4 composes `scale-*` and `translate-*` into one `transform` via
custom properties, and at identity values it collapses the whole declaration to
`none`. A CSS transition out of `none` has **no interpolable start value**, so
the browser silently animates the properties it *can* (opacity, filter) and
skips the transform. That is why blur ramped 12px → 0 correctly while the
scale never moved.

**Where**: `frontend/src/features/landing/HeroIntro.tsx` — the `h1` now sets
`transform` inline as two explicit endpoints.

**Concepts to learn**: interpolable vs non-interpolable CSS values; why
`transform: none` and `transform: scale(1)` behave differently in transitions;
how utility frameworks compose shorthand properties.

**Interview questions**
- Why might a CSS transition animate opacity but silently ignore transform?
- What is the difference between `transform: none` and an identity transform?
- How would you debug an animation that "does nothing" with no console error?

---

## 16. A gradient's repeat period must divide the distance you scroll it

**What**: the road's lane dashes jumped once per animation cycle. The travel
animation shifts every marking layer by exactly one 160px pitch, but the dash
gradient was serialising to a **44px** period — and 160 / 44 is not an integer,
so each loop restarted out of phase.

**Where**: `frontend/src/features/landing/RoadScene.tsx`

**Why it matters**: the shorthand `transparent 44px 160px` was being collapsed
by the browser, dropping the final stop. Writing all four stops explicitly
(`0px, 44px, 44px, 160px`) restored the 160px period. Verified by reading
`backgroundImage` back from `getComputedStyle` and comparing the largest stop
against `--marking-pitch`.

**Interview questions**
- Why must a scrolling texture's shift distance be a whole multiple of its period?
- How would you assert a CSS animation loops seamlessly, rather than eyeballing it?

---

## 17. Timing probes cannot catch geometry bugs

**What**: the road intro passed every automated check — phase transitions,
the speed ramp (0.42s → 1.5s → 4s → 7s → 9s), play/pause state, seamless
marking periods — while the road still rendered as a solid yellow wedge with
no visible surface.

**Why**: every probe measured *time and periodicity*. None measured *space*.
Measuring the element boxes exposed the real fault instantly: the road plane's
projected box was `y 318-496` while its container occupied `y 496-918` — the
surface was projecting entirely outside the region it was meant to fill,
because the rotation was pivoting on the plane's top edge instead of its bottom.

**Concepts to learn**: CSS 3D `perspective`, `perspective-origin` and
`transform-origin`; how a pivot edge changes where a rotated plane lands;
`getBoundingClientRect` on transformed elements.

**Interview questions**
- Your tests all pass and the feature still looks wrong. What class of assertion was missing?
- How do you verify a visual result programmatically rather than by eye?
- What does `transform-origin` change about a `rotateX` on a ground plane?

---

## 18. Hydration mismatches: the server has no browser

**What**: the landing intro is skipped for visitors who have already seen it
(`sessionStorage`) or who ask for reduced motion (`matchMedia`). Resolving that
in a lazy `useState` initialiser caused React to report *"Hydration failed
because the server rendered text didn't match the client."*

**Why**: neither API exists during server rendering. The server always rendered
the pre-intro state — `transform: translateY(2rem) scale(0.35); opacity: 0` —
while a returning client rendered the finished state on its very first pass.
Same component, two different first renders, so the trees could not reconcile.

**The trade-off that caused it**: an earlier version set the phase inside
`useEffect`, which ran *after* paint and showed one frame of the intro to
people who had opted out of motion. Moving the decision into the initialiser
removed the flash but introduced a correctness bug. The resolution keeps both:
render the server-identical state, then correct it in `useLayoutEffect`, which
commits **before** the browser paints.

**Where**: `frontend/src/features/landing/useIntroSequence.ts`

**How it was found**: not by reading the code. The Next.js dev overlay reported
"1 Issue", and the component stack pointed at `<HeroIntro> → <RoadScene
phase="done">`. Confirmed independently by fetching the page HTML and diffing
the server-rendered `style` attribute against the live hydrated DOM.

**Concepts to learn**: SSR vs hydration; why `typeof window === "undefined"`
guards do not fix mismatches (they cause them); `useLayoutEffect` vs
`useEffect` timing; `useSyncExternalStore` for external browser state;
`suppressHydrationWarning` and why it is usually the wrong answer.

**Interview questions**
- Why does reading `localStorage` during render break SSR?
- What is the difference between `useEffect` and `useLayoutEffect`, and when does that difference matter visually?
- A hydration error is "recoverable". Why fix it anyway?
- How would you render genuinely per-user content without a mismatch?

---

## 19. Your instrumentation can be wrong: hidden documents freeze transitions

**What**: the landing intro appeared broken for a long stretch of development.
`getComputedStyle` reported the wordmark stuck at `scale(0.35)`, `opacity: 0`,
`blur(12px)`, while the element's own inline style read
`transform: translateY(0px) scale(1); opacity: 1`. An inline style with no
competing `!important` rule cannot lose the cascade — the readings were
impossible, and chasing them produced four wrong diagnoses in a row.

**Why**: the browser pane was hidden (`document.visibilityState === "hidden"`).
A hidden document's animation timeline does not advance, so in-flight CSS
transitions freeze at their **start** values. `getComputedStyle` and
`getBoundingClientRect` both report the frozen transitioned value, not the
declared one, so they agreed with each other and were both wrong.
`document.getAnimations()` made it obvious once inspected: six `CSSTransition`
objects, all `playState: "running"` with `currentTime: 0`, including properties
never animated deliberately (`column-rule-width`, `row-rule-width`) — artifacts
of `transition-all`.

Setting `transition-duration: 0s` did not rescue the measurement either: that
governs only *newly created* transitions, while the frozen six already existed.

**How it was finally settled**: a screenshot. It renders through the paint
path rather than the DOM-query path, and showed the hero perfectly correct all
along.

**Where**: `frontend/src/features/landing/HeroIntro.tsx` (no fix was needed)

**Concepts to learn**: the Page Visibility API; how hidden documents throttle
timers and suspend animation timelines; the difference between a declared
style, a computed style and a transitioned value; `document.getAnimations()`;
why `transition-all` creates transitions on properties you never intended.

**Interview questions**
- Why can `getComputedStyle` disagree with an element's inline style?
- What happens to CSS transitions and `requestAnimationFrame` in a background tab?
- Your metrics say a feature is broken but users say it works. How do you decide which to trust?
- What is the risk of `transition: all` beyond performance?

---

## 20. The URL as application state

**What**: the global filters (year range, region, road type, speed environment,
severity) live in the query string, not in React state.

**Where**: `frontend/src/lib/filters.ts`, `components/layout/FilterPanel.tsx`

**Why**: three separate payoffs from one decision. A filtered view becomes
shareable and survives refresh. Server Components can read `searchParams`
directly and fetch already-filtered data, with no client round-trip. And the
query string is *already* the shape the REST API will take —
`/api/crashes/trends?yearFrom=2020&region=Waikato+Region` — so Stage 23 swaps
the service body and nothing above it changes.

**The parsing rule that matters**: malformed values are dropped, not coerced.
A hand-edited `?yearFrom=banana` degrades to "no filter" rather than year 0 or
a crash. A reversed range (`from` after `to`) is swapped rather than silently
matching nothing.

**Concepts to learn**: URL as single source of truth; idempotent/shareable
state; why `useState` for filters breaks the back button; query-string
serialisation.

**Interview questions**
- Why is filter state in the URL better than in a React store?
- How do you stop a malformed URL from breaking a page?
- What changes in your frontend when the data source becomes a real API? (ideally: only the service layer)

---

## 21. Resetting state with `key` instead of an effect

**What**: the filter form holds a *pending* draft so that changing a dropdown
does not navigate on every keystroke. When the URL changes (Reset, removing a
chip, browser back), that draft must resync.

**The wrong way** — and the one the linter flags — is `useEffect(() =>
setDraft(current), [current])`, which causes a cascading render.

**The right way**: pass `key={searchParams.toString()}` to the form. React
unmounts and remounts it, so the draft re-initialises naturally with no effect
at all.

**Where**: `frontend/src/components/layout/FilterPanel.tsx`

**Concepts to learn**: `key` as an identity hint, not just a list optimisation;
derived vs. synchronised state; "you might not need an effect".

**Interview questions**
- How do you reset a component's internal state when a prop changes?
- Why is remounting sometimes cheaper than syncing?

---

## 22. Static vs dynamic rendering, and how a single hook changes it

**What**: before Stage 3 the build reported every analytics route as
`○ (Static)`. After the pages began reading `searchParams`, the same routes
report `ƒ (Dynamic) — server-rendered on demand`.

**Why it matters**: that is correct and intended here — a filtered page cannot
be prerendered, because the filter values are only known per request. But it is
a real trade-off to understand rather than stumble into: static pages are
cached and near-free to serve; dynamic pages run the server on every request.

**Related trap**: `useSearchParams()` in a client component opts the whole
route out of static rendering unless it is wrapped in `<Suspense>`. The sidebar
does exactly that so the shell can still be prerendered around the dynamic part.

**Where**: `frontend/src/components/layout/Sidebar.tsx`, the eight pages under
`app/(dashboard)/`

**Interview questions**
- What makes a Next.js route dynamic rather than static?
- Why does `useSearchParams` require a Suspense boundary?
- When would you deliberately keep a page static and filter on the client instead?

---

## 23. Chart colour is computed, not chosen

**What**: every chart hex in this project was run through a palette validator
before use, against the actual surface the chart renders on (`#ffffff`).

**Where**: `frontend/src/lib/chart-theme.ts` carries the full report and the
rejected alternatives.

**The six checks a categorical palette must pass**: fixed hue order · lightness
band (OKLCH L 0.43–0.77 on light) · chroma floor (C ≥ 0.10) · CVD separation
(ΔE ≥ 8 in OKLab ×100 under simulated protanopia and deuteranopia) ·
normal-vision floor (ΔE ≥ 15) · contrast ≥ 3:1 vs surface.

**What it caught that eyes would not:**
- `#8ca0b3` had chroma **0.036** against a 0.10 floor. It looks like a colour;
  measured, it reads as grey and does no identity work.
- The whole good→warning→serious→critical status scale is **structurally
  unusable** for a 4-level severity encoding: yellow and orange are inherent
  neighbours and measure ΔE 8–9 normal vision, **2–3 under protanopia**, in
  every re-stepping attempted. No amount of nudging fixes it.
- Three sequential ramps failed only on the light end (1.23–1.79:1 vs a 2:1
  floor) — the pale tint vanishes into a white card.

**The rule about WARNs**: a sub-3:1 contrast WARN is *not* dismissable. It
obligates a relief channel — visible labels or a table view. That is why every
chart here has a Table toggle; it is a compliance mechanism, not a nicety.

**Concepts to learn**: OKLCH vs HSL; chroma as "how much colour is actually
there"; Delta E; colour-vision-deficiency simulation; WCAG contrast; why
perceptual colour spaces exist.

**Interview questions**
- How do you know a chart palette is colourblind-safe?
- What is chroma, and why can a colour be "too grey" to encode identity?
- Why validate against the surface colour rather than in the abstract?
- A palette check warns on contrast. Is that ignorable?

---

## 24. Two scales, two charts — never a second y-axis

**What**: the dashboard shows crash *volume* (~30–40k/yr) and *severe rate*
(~6–8%) as two side-by-side charts sharing an x-axis, rather than one chart
with two y-axes.

**Why**: a dual-axis chart's two scales are aligned arbitrarily, so the picture
invents a correlation that isn't in the data. It is the most common serious
charting mistake. The same reasoning killed plotting all four severity levels
on one line chart — Non-Injury at 485,478 against Fatal at 6,182 flattens the
two series a road-safety reader actually cares about into the baseline.

**Also here**: a donut was rejected for severity because Fatal is 0.88% — a
sliver too small to label, and a label must never be clipped into its mark.

**Interview questions**
- Why are dual-axis charts considered misleading?
- You have two measures with wildly different magnitudes. Options?
- When is a pie or donut defensible, and when is it not?

---

## 25. When the probe is wrong, not the code

**What**: verifying that the trend chart excluded the partial year, a probe
counted `M`/`L` commands in the SVG path and reported **1 point**. The chart
was fine — Recharts renders `type="monotone"` as a **cubic Bézier**, so the
path is one `M` followed by `C` commands and contains no `L` at all. Counting
the right grammar gave 20 points, confirmed independently by the coordinate-pair
arithmetic ((58 − 1) / 3 + 1 = 20).

**Why it matters**: this was the fourth time in one build session that
instrumentation produced a false failure — after a stale console buffer, a
frozen hidden-tab transition, and a selector that missed `color-mix()` colours.
Each time the instinct to "fix" the code would have broken something working.

**The habit**: when a measurement says something impossible, suspect the
measurement first, and corroborate with a second independent method before
editing anything.

**Interview questions**
- How do you tell a real failure from a broken test?
- What would you check before acting on a surprising metric?

---

## 26. Choosing map bins: fixed beats quantile

**What**: the crash density map colours 6,103 grid cells using fixed
log-decade bins (1–10, 11–100, 101–1,000, 1,001+) rather than quantiles.

**Why not linear**: the distribution is extreme — median 11 crashes per cell,
max 25,172, and the **top 1% of cells hold 52.5% of all crashes**. Equal-width
breaks put essentially the whole country in the lightest bin.

**Why not quantiles** (the subtle one): quantile breaks are recomputed from
whatever data is currently displayed. Filter to one region and every surviving
cell can change colour without its value changing. That is the
**recolor-on-filter** anti-pattern — colour must follow the entity, not its
rank. Fixed bins mean a given colour always means the same count.

**Where**: `frontend/src/components/maps/CrashMap.tsx`

**Concepts to learn**: choropleth classification (equal interval, quantile,
Jenks natural breaks, log); skewed distributions; why a legend must stay stable
across views.

**Interview questions**
- Your map's colours change when the user filters. Why is that a bug?
- When is a quantile scale appropriate, and when is it misleading?
- How do you colour a heavily skewed distribution fairly?

---

## 27. Libraries that touch `window`, and rendering thousands of shapes

**What**: Leaflet reads `window` at module scope, so it cannot be imported
during server rendering. It loads via `next/dynamic` with `ssr: false` — and
that option is **not permitted inside a Server Component** in the App Router,
which is why a thin client-side loader component exists purely to perform the
dynamic import.

**The performance half**: 6,103 cells are rendered as a *single* `<GeoJSON>`
layer with Leaflet's canvas renderer, not 6,103 React components. Thousands of
components would each need reconciling on every pan and zoom.

**The payload half**: the map fixture originally repeated `latitude` and
`longitude` on all 61,008 rows. Splitting geometry into a 6,103-entry cell list
that rows reference by index took the file from **1.48MB to 1.08MB** *while
adding* a region dimension — a normalisation that paid for a new feature.

**Where**: `components/maps/CrashMapLoader.tsx`, `components/maps/CrashMap.tsx`,
`data-pipeline/src/generate_frontend_fixtures.py`

**Concepts to learn**: SSR vs client-only libraries; code splitting; SVG vs
canvas rendering trade-offs; normalising a denormalised payload; why the
antimeridian breaks naive map bounds.

**Interview questions**
- A library crashes during SSR. What are your options?
- How would you render 100,000 points on a web map?
- Your JSON payload is too big. Where do you look first?

---

## 28. Never let content depend on an observer firing

**What**: two components on the landing page hid their own content until an
`IntersectionObserver` told them to show it — `CountUp` started at zero, and
`Reveal` started at `opacity: 0`. Both were written assuming the observer
would always fire.

**Why that is a bug, not a nicety**: if the observer never fires — an
unsupported browser, a suspended or backgrounded document — the page does not
merely skip an animation. The counter displays **"0 crashes analysed"** and the
revealed section stays **permanently invisible**. A wrong number and missing
content are far worse outcomes than a missing transition.

**The fix**: arm a fallback timer at mount, *independent of the observer*,
that puts the component into its final state. The first version armed that
timer inside the observer callback, which is useless precisely when the
observer is the thing that failed.

**The related rule**: the server renders the *final* value, so anyone without
JavaScript, and anyone who asked for reduced motion, reads the real figure with
no animation involved. The animation only ever degrades the presentation, never
the content.

**Where**: `frontend/src/components/ui/CountUp.tsx`,
`frontend/src/features/landing/Reveal.tsx`

**Concepts to learn**: progressive enhancement; graceful degradation;
`IntersectionObserver` support and when it does not fire; why timers are
throttled in background tabs while `requestAnimationFrame` stops entirely.

**Interview questions**
- Your scroll animation does not run. What should the user see?
- What is the difference between degrading the presentation and degrading the content?
- Why render the final value on the server and animate afterwards, rather than starting from zero?

---

## 29. Server and Client Component boundaries are serialisation boundaries

**What**: passing `format: formatNumber` — an ordinary function — from a
Server Component into a Client Component failed the build with *"Functions
cannot be passed directly to Client Components."*

**Why**: props crossing that boundary are serialised and sent over the wire.
A function has no serialised form. TypeScript accepted it happily; only the
framework caught it.

**The fix**: pass a serialisable *name* (`format: "number" | "plain"`) and keep
the formatter inside the client component.

**Where**: `frontend/src/components/ui/CountUp.tsx`

**Interview questions**
- What kinds of value can cross the server/client boundary in the App Router?
- How would you let a Server Component configure client-side behaviour?
- Why did TypeScript not catch this?

---

## 30. A CSS 3D scene with a requestAnimationFrame camera

**What**: the landing road is a `perspective` container holding a
`preserve-3d` world. Objects get fixed `translateZ` depths; each frame one
transform moves the whole world towards the camera, wrapping every 140 units
so the road loops. The sign is positioned by cumulative distance, so it is
approached once. `filter` on a 3D container flattens it, so motion blur is a
separate flat layer.

**Why it matters**: the browser does the projection maths; JavaScript writes
one transform per frame, which stays on the compositor.

**Interview questions**
- What does `perspective` do, and how does it differ from `transform: perspective()`?
- Why do `filter` and `overflow: hidden` break `preserve-3d`?
- Why use rAF rather than `setInterval` for animation?
- How do you respect `prefers-reduced-motion` without a flash of animation?

---

## 31. Checks that pass while the product is broken

**What**: CARTO dark tiles returned HTTP 200 — and each tile carried an
"API KEY REQUIRED" watermark. A Leaflet map inside a flex card rendered an
empty canvas because it measured its container before layout settled; fixed
with an explicit height and `ResizeObserver` → `invalidateSize()`.

**Why it matters**: status codes and a clean console are not evidence that
the user sees the right thing. A screenshot is.

**Interview questions**
- Give an example of a green check that hid a real failure.
- Why does Leaflet need `invalidateSize()`?
- What would automated visual regression testing add?

---

## 32. Missing-data buckets masquerading as findings

**What**: "Unknown speed limit" had a 22.9% severe rate — it would have been
the top risk factor. "Unknown light" at 0.3% would have been the most
protective. Both reflect how records were completed, not road conditions.
They are flagged `isMissingData`, excluded from the chart, and still listed.
Lift is shown against the baseline with diverging bars.

**Why it matters**: a rate means something only relative to a baseline, and
only for a real category with enough rows.

**Interview questions**
- Why compare against the baseline rate rather than show raw rates?
- Why might "Unknown" correlate with severity? (serious crashes get fuller investigations)
- How did you choose the minimum sample size, and what is the trade-off?
- Adverse weather sits *below* baseline — why isn't that evidence it is safe?

---

## 33. Bubble maps and distribution-based bins

**What**: circle radius ∝ √count so *area* is proportional to the value.
Colour bins for severe rate come from the spread across the 68 areas. The
national rate is 6.7% but the median area is 10.1%: Auckland's volume at a low
rate pulls the national figure down — an aggregation effect.

**Interview questions**
- Why square-root the radius?
- How can a national average be lower than most regions' rates?
- Median or mean for "typical area", and why?

---

## 34. Client-side exports and CSV injection

**What**: CSVs are built in the browser from the rendered rows. Cells starting
with `= + - @` are prefixed so spreadsheets don't evaluate them as formulas; a
UTF-8 BOM makes Excel read macrons (Māori place names) correctly. PDF is the
print dialog with print-only styles.

**Interview questions**
- What is CSV/formula injection and how do you prevent it?
- Why build exports client-side here, and when would you move them server-side?
- What does a BOM do?

---

## 35. Data profiling and documentation that cannot drift

**What**: the Data Dictionary page is generated. Types, missing % and examples are measured on every run, while descriptions are parsed from the markdown. The script fails loudly by printing columns that have no description, and descriptions whose column has disappeared. Integer counts that pandas stores as floats (because NaN forces float) are reported as Integer.

**Why it matters**: data documentation goes stale silently. Generating it from the data keeps it honest.

**Interview questions**
- Why does a column of whole numbers load as `float64` in pandas?
- What is the difference between "missing" and "not applicable"? Use `holiday` and `pedestrian` as examples.
- How would you keep a data dictionary in sync in a production pipeline? (profiling in CI, or data contracts / Great Expectations)
- Why choose the mode as the example value, and when is that a bad choice?

---

## 36. Stacking contexts, and a responsive layout found by using it

**What**: the overflow audit passed at every width, but opening the mobile drawer on the map page showed the map painted *over* it. `z-index` only competes within a stacking context. Leaflet's panes (z-index 400–1000) sat in the root context and beat the drawer's `z-50`. `isolation: isolate` on the map wrapper gives Leaflet its own context. Separately, the landing sign's exit time per viewport came from the projection maths (`x' = x · P / (P − z)`), because the preview pane cannot run the animation.

**Interview questions**
- What creates a stacking context? (position + z-index, opacity < 1, transform, filter, isolation)
- Why can an element with z-index 1000 appear under one with z-index 50?
- Why cap the map's height on phones rather than disable dragging?
- How would you test responsive layouts automatically? (Playwright at several viewports plus visual snapshots)

---

## 37. Transitions, reconciliation and pending UI

**What**: a CSS width transition only animates if React keeps the *same* DOM element between renders. That happens because list rows are keyed by a stable label, not by index. `useTransition` around `router.push` exposes an `isPending` flag while the server renders the next view. `useSyncExternalStore` reads a browser-only value (matchMedia) without a hydration mismatch.

**Interview questions**
- Why can keying list items by array index break animations and state?
- What does `useTransition` change about a navigation?
- Why doesn't `@media (prefers-reduced-motion)` stop a Recharts animation?
- When would you use `useSyncExternalStore` instead of `useState` + `useEffect`?

---

## 38. Verifying work instead of assuming it

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
