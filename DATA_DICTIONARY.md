# RoadSafe NZ — Data Dictionary

Covers the NZTA Crash Analysis System (CAS) dataset as downloaded from Waka Kotahi's open data portal: **705,609 rows × 72 raw columns**. All missing/unique counts below are measured directly from `data-pipeline/data/processed/cas_crash_data_clean.csv` (after the Null-string fix and reprojection — see [DECISIONS.md](DECISIONS.md)), not estimated.

**Important caveat**: descriptions here are inferred from column names, observed values, and how CAS is generally known to be structured — this has not been cross-checked against NZTA's own published CAS data dictionary (if/when we get access to it, this file should be reconciled against it). Treat "Meaning" as our working understanding, not an authoritative NZTA definition. Do not add a column to this file, or to any model, without it actually existing in the dataset we've inspected.

## How to read the tables

- **Missing %** is measured after the Phase 2 cleaning fixes (disguised `"Null"` strings converted to real `NaN`).
- **Unique** is the count of distinct non-null values.
- Columns are grouped by what they describe, not alphabetically, so related fields sit together.

---

## Identifiers & location

| Column | Type | Missing % | Unique | Meaning |
|---|---|---|---|---|
| `OBJECTID` | int | 0.0 | 705,609 | Unique crash record ID. Verified no duplicates (0 duplicate values). |
| `X`, `Y` | float | 0.0 | ~412k / ~439k | Crash coordinates in NZTM2000 (EPSG:2193, meters). Source for the derived `longitude`/`latitude`. |
| `longitude`, `latitude` *(derived)* | float | 0.0 | ~537k | WGS84 lon/lat, reprojected from `X`/`Y` via `pyproj` in `clean_data.py`. |
| `region` | str | 0.4 | 16 | NZ regional council area (e.g. "Auckland Region", "Otago Region"). |
| `tlaId`, `tlaName` | float / str | 0.0 | 67 | Territorial Local Authority (district/city council) ID and name. |
| `areaUnitID`, `meshblockId` | float | 0.0 | 1,873 / 39,584 | Stats NZ statistical area / meshblock identifiers for the crash location. |
| `crashLocation1`, `crashLocation2` | str | 0.0 / 0.3 | 35,917 / 51,568 | Free-text road name(s) at the crash site — `crashLocation1` is the primary road, `crashLocation2` the intersecting road where relevant. High cardinality; likely too sparse/noisy to use directly as a categorical feature without grouping. |
| `crashSHDescription` | str | 0.0 | 3 (`Yes`/`No`/`Unknown`) | Whether the crash occurred on a State Highway. |
| `urban` | str | 0.0 | 2 (`Open`/`Urban`) | Urban vs. open-road classification of the crash location. |

## Time

| Column | Type | Missing % | Unique | Meaning |
|---|---|---|---|---|
| `crashYear` | int | 0.0 | 21 | Calendar year of the crash (2006–2026 observed; 2026 is a partial year at the time of this dataset export). |
| `crashFinancialYear` | str | 0.0 | 22 | NZ financial year (e.g. "2019/2020") the crash falls in. |
| `holiday` | str | 94.5 | 4 (`Christmas New Year`, `Easter`, `Labour Weekend`, `Queens Birthday`) | Which public holiday period the crash occurred in, if any — non-null only for crashes actually inside one of those periods (94.5% missing is expected: most crashes aren't on a holiday). |

## Crash severity & casualty counts (target-adjacent — see leakage note)

| Column | Type | Missing % | Unique | Meaning |
|---|---|---|---|---|
| `crashSeverity` | str | 0.0 | 4 (`Fatal Crash`, `Serious Crash`, `Minor Crash`, `Non-Injury Crash`) | The original NZTA severity classification. Source of the derived binary target. |
| `is_severe` *(derived)* | bool | 0.0 | 2 | `True` if `crashSeverity` is Fatal or Serious. **6.72% True / 93.28% False** — confirmed real class imbalance, not assumed. This is the ML target. |
| `fatalCount` | float | 0.0 | 8 | Number of deaths in the crash. |
| `seriousInjuryCount` | float | 0.0 | 14 | Number of serious injuries. |
| `minorInjuryCount` | float | 0.0 | 22 | Number of minor injuries. |

**⚠️ Data leakage warning**: `fatalCount` and `seriousInjuryCount` directly determine `crashSeverity`/`is_severe` — they must **not** be used as model input features, since they encode the outcome itself. Keep for descriptive analytics only (e.g. total deaths per year), never in the feature set for the severity classifier.

## Road & environment conditions

| Column | Type | Missing % | Unique | Meaning |
|---|---|---|---|---|
| `weatherA` | str | 2.2 | 6 (`Fine`, `Light rain`, `Heavy rain`, `Mist or Fog`, `Snow`, `Hail or Sleet`) | Primary weather condition at crash time. |
| `weatherB` | str | 96.7 | 2 (`Frost`, `Strong wind`) | Secondary weather condition — only populated when a second condition applied, hence the high missing %. |
| `light` | str | 0.0 | 5 (`Bright sun`, `Overcast`, `Twilight`, `Dark`, `Unknown`) | Light condition at crash time. |
| `streetLight` | str | 50.5 | 2 (`On`, `Off`) | Whether street lighting was on. High missing % — likely only recorded for crashes in the dark, but not yet confirmed. |
| `roadSurface` | str | 0.2 | 3 (`Sealed`, `Unsealed`, `End of seal`) | Road surface type. Unsealed/End-of-seal show a materially higher severe rate than Sealed (12.9% / 15.6% vs. 6.6% — see PROJECT_PROGRESS.md). |
| `flatHill` | str | 1.4 | 2 (`Flat`, `Hill Road`) | Terrain classification. |
| `roadCharacter` | str | 0.0 | 9 (`Nil`, `Bridge`, `Motorway ramp`, `Overpass`, `Rail xing`, `Speed hump`, `Tram lines`, `Tunnel`, `Underpass`) | Special road feature at the crash location; `Nil` presumably means no special feature. |
| `roadLane` | str | 0.1 | 3 (`1-way`, `2-way`, `Off road`) | Lane/carriageway configuration. |
| `NumberOfLanes` | float | 0.3 | 10 | Number of lanes at the crash site. IQR flags ~24% as "outliers" but this is an artifact of the value being mode-dominated at 2 — not a real data quality issue (see DECISIONS.md #7). |
| `speedLimit` | float | 0.2 | 17 | Posted speed limit (km/h) at the crash location. Includes legitimate low values (2, 10 km/h) for carparks/shared zones. |
| `temporarySpeedLimit` | float | 97.9 | 10 | Temporary speed limit (e.g. roadworks) — non-null only when one was in effect. |
| `trafficControl` | str | 0.0 | 8 (`Nil`, `Give way`, `Stop`, `Traffic Signals`, `Pointsman`, `School Patrol/warden`, `Isolated Pedestrian signal (non-intersection)`, `Unknown`) | Traffic control device present at the crash location. `Nil` used as the `is_uncontrolled_intersection` flag basis. |
| `crashDirectionDescription` | str | 37.1 | 4 (`North`, `South`, `East`, `West`) | Compass direction associated with the crash — high missing % even after the Null-string fix, exact semantics (direction of travel? of impact?) not yet confirmed. |
| `directionRoleDescription` | str | 0.6 | 4 (`North`, `South`, `East`, `West`) | A second direction-related field; relationship to `crashDirectionDescription` not yet confirmed. |

## Vehicle involvement (counts per crash)

All of the following are counts of that vehicle type involved in the crash (0, 1, 2, …), essentially all with under 0.01% missing:

| Column | Meaning |
|---|---|
| `bicycle`, `bus`, `carStationWagon`, `moped`, `motorcycle`, `otherVehicleType`, `schoolBus`, `suv`, `taxi`, `truck`, `unknownVehicleType`, `vanOrUtility` | Count of that vehicle type involved. Summed into the derived `total_vehicles_involved` feature (excludes `vehicle` and `train`, see below). |
| `vehicle` | 57.3% missing. Appears to be a legacy/generic vehicle-count field from an older CAS schema, largely superseded by the specific vehicle-type columns above — excluded from `total_vehicles_involved` to avoid double-counting. |
| `pedestrian` | 96.6% missing — non-null only when a pedestrian was involved (values 1–7, never 0), unlike the vehicle columns which include explicit 0s. |
| `train` | 57.3% missing, values `{0, 1}` only. Grouped here in the raw schema with vehicle-type columns by name, but conceptually closer to a roadside hazard (level-crossing collision) than a "vehicle involved" — excluded from `total_vehicles_involved` (see feature_engineering.py). |

## Roadside objects struck (counts per crash)

This entire block of 28 columns is missing for the exact same 57.3% of rows (403,996 rows). Confirmed this is **not** a mid-history schema change (populated across the full 2006–2026 range) — working theory is NaN means "not struck," functionally 0, rather than "not recorded." **Not yet resolved** — see DECISIONS.md #5.

`bridge`, `cliffBank`, `debris`, `ditch`, `fence`, `guardRail`, `houseOrBuilding`, `kerb`, `objectThrownOrDropped`, `otherObject`, `overBank`, `parkedVehicle`, `phoneBoxEtc`, `postOrPole`, `roadworks`, `slipOrFlood`, `strayAnimal`, `trafficIsland`, `trafficSign`, `tree`, `waterRiver`

## Dead / unusable columns

| Column | Missing % | Status |
|---|---|---|
| `intersection` | 100.0 | Zero non-null values across all 705,609 rows. Not yet dropped from `clean_data.py` — flagged for the next edit. |
| `crashRoadSideRoad` | 100.0 | Same as above. |
| `advisorySpeed` | 96% (in raw data) | Already dropped in `clean_data.py` — not present in the processed files. |

## Derived features (Phase 3 — `feature_engineering.py`)

| Column | Type | Meaning |
|---|---|---|
| `total_vehicles_involved` | int | Sum of the 12 vehicle-type columns listed above. Range 0–17, mean 1.76. |
| `adverse_weather` | bool | `weatherA` in {Heavy rain, Light rain, Mist or Fog, Snow, Hail or Sleet}, OR `weatherB` is non-null (Frost/Strong wind). |
| `is_unsealed_road` | bool | `roadSurface` in {Unsealed, End of seal}. |
| `is_hill_road` | bool | `flatHill` == Hill Road. |
| `is_low_light` | bool | `light` in {Dark, Twilight}. |
| `is_uncontrolled_intersection` | bool | `trafficControl` == Nil. |
| `road_hazard_score` | int (0–5) | Sum of the 5 boolean flags above. Confirmed to track `is_severe` cleanly: 5.7% (score 0) up to 10.0% (score 5). |
| `speed_limit_binned` | categorical | `speedLimit` bucketed into `low_<=50`, `medium_51-80`, `high_81-100`, `very_high_>100`. |

## Candidate target variable

`is_severe` (binary) — confirmed real distribution 6.72% severe / 93.28% not. See DECISIONS.md #1 for why this was chosen over the 4-class `crashSeverity`.

## Fields to exclude from modeling (leakage risk)

- `fatalCount`, `seriousInjuryCount`, `minorInjuryCount` — directly determine the target.
- `crashSeverity` — the target's own source column.
- `OBJECTID` — identifier, no predictive meaning.
- High-cardinality free-text location fields (`crashLocation1`, `crashLocation2`) — not leakage, but need deliberate handling (grouping, or drop in favor of `region`/`tlaName`/lat-lon) rather than raw one-hot encoding of 35k+/51k+ categories.
