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
