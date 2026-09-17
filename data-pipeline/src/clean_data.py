"""
Clean the raw NZTA Crash Analysis System (CAS) dataset.

Steps:
1. Load the raw CSV (downloaded and pinned by download_data.py).
2. Replace the literal string "Null" (CAS's own missing-value marker) with
   real NaN in the columns that use it, so pandas/scikit-learn treat it as
   missing instead of a category.
3. Resolve the object-struck block: record whether it was filled at all
   (`object_involved`), then treat its blanks as 0. See OBJECT_COLUMNS.
4. Treat a blank `pedestrian` count as 0 (the field is never 0 when filled).
5. Reproject crash coordinates from NZTM2000 (EPSG:2193, metres) to WGS84
   lon/lat (EPSG:4326) for web mapping, and blank any that are not a real
   location (`location_valid`).
6. Drop columns that carry no information: advisorySpeed (96% missing) and
   the two columns that are empty in every row.
7. Create the `is_severe` target: True for Serious or Fatal crashes.

Note on OBJECTID: it is an ArcGIS row number, not a crash identifier. Two
exports of identical data a week apart numbered the same crashes
differently, so it must never be used to join or deduplicate across
snapshots.

Run from data-pipeline/:
    python src/clean_data.py
"""

from pathlib import Path

import pandas as pd
from pyproj import Transformer

RAW_PATH = Path(__file__).resolve().parent.parent / "data" / "raw" / "cas_crash_data.csv"
PROCESSED_PATH = Path(__file__).resolve().parent.parent / "data" / "processed" / "cas_crash_data_clean.csv"

# CAS marks missing values as the literal text "Null" in these object columns
# (not to be confused with a real NaN, which is why df.isna() misses them
# until we do this replacement). Found by scanning every object column in the
# raw data for the literal string "Null" rather than trusting a partial list —
# streetLight (33.3% of rows) and crashDirectionDescription (37.1%) turned out
# to have the same bug as weatherA/weatherB/roadSurface/flatHill.
NULL_STRING_COLUMNS = [
    "weatherA", "weatherB", "roadSurface", "flatHill",
    "crashDirectionDescription", "directionRoleDescription",
    "roadLane", "streetLight",
]

# Counts of each thing struck. These columns are blank together, on exactly
# the same 57% of rows, and never partially. NZTA's CAS user guide notes that
# filtering on any object "will only see crashes where an object was
# involved", i.e. the block is only recorded for object-involved crashes.
# The data agrees: where the block is filled, 95.9% of rows record a strike,
# and it is filled more often for fatal and open-road crashes, where hitting
# trees, poles and fences is common. So a blank means "nothing struck", not
# "not recorded". `vehicle` and `train` share the block's missingness exactly
# and are handled with it.
OBJECT_COLUMNS = [
    "bridge", "cliffBank", "debris", "ditch", "fence", "guardRail",
    "houseOrBuilding", "kerb", "objectThrownOrDropped", "otherObject",
    "overBank", "parkedVehicle", "phoneBoxEtc", "postOrPole", "roadworks",
    "slipOrFlood", "strayAnimal", "trafficIsland", "trafficSign", "tree",
    "waterRiver", "vehicle", "train",
]

# Empty in every row of every snapshot seen so far. Dropped, but checked
# first: if NZTA starts populating them, the pipeline should stop and say so
# rather than silently discard new information.
EMPTY_COLUMNS = ["intersection", "crashRoadSideRoad"]

SEVERE_CATEGORIES = {"Fatal Crash", "Serious Crash"}

# Mainland NZ plus the Chatham Islands, whose longitudes wrap past 180°.
LAT_RANGE = (-53.0, -28.0)
LON_RANGES = ((165.0, 180.0), (-180.0, -175.0))

# One 2024 Chatham Islands crash (Waitangi Wharf) reprojects to exactly
# (-47.5, 179.0), open ocean ~450km from the islands, while a 2020 crash on
# the same road has real Chatham coordinates. The exact round value marks a
# placeholder rather than a location.
PLACEHOLDER_POINTS = [(-47.5, 179.0)]


def load_raw(path: Path = RAW_PATH) -> pd.DataFrame:
    # utf-8-sig: the NZTA export starts with a byte-order mark.
    return pd.read_csv(path, encoding="utf-8-sig", low_memory=False)


def fix_null_strings(df: pd.DataFrame) -> pd.DataFrame:
    df[NULL_STRING_COLUMNS] = df[NULL_STRING_COLUMNS].replace("Null", pd.NA)
    return df


def resolve_object_block(df: pd.DataFrame) -> pd.DataFrame:
    missing = df[OBJECT_COLUMNS].isna()
    partial = missing.any(axis=1) & ~missing.all(axis=1)
    if partial.any():
        raise ValueError(
            f"{int(partial.sum())} rows have a partially filled object block; "
            "the all-or-nothing assumption behind filling blanks with 0 no longer holds."
        )

    df["object_involved"] = ~missing.all(axis=1)
    df[OBJECT_COLUMNS] = df[OBJECT_COLUMNS].fillna(0).astype(int)
    return df


def fill_pedestrian(df: pd.DataFrame) -> pd.DataFrame:
    if (df["pedestrian"] == 0).any():
        raise ValueError(
            "pedestrian now contains explicit zeros, so a blank may no longer "
            "mean 'no pedestrian'. Revisit before filling."
        )
    df["pedestrian"] = df["pedestrian"].fillna(0).astype(int)
    return df


def reproject_coordinates(df: pd.DataFrame) -> pd.DataFrame:
    transformer = Transformer.from_crs("EPSG:2193", "EPSG:4326", always_xy=True)
    lon, lat = transformer.transform(df["X"].values, df["Y"].values)
    df["longitude"] = lon
    df["latitude"] = lat
    return df


def flag_invalid_locations(df: pd.DataFrame) -> pd.DataFrame:
    """Blank coordinates that are not a real place, and say so in a column.

    The crash still counts everywhere else; it just cannot be put on a map.
    X/Y are left as NZTA published them, for traceability.
    """
    lat, lon = df["latitude"], df["longitude"]
    in_nz = lat.between(*LAT_RANGE) & (
        lon.between(*LON_RANGES[0]) | lon.between(*LON_RANGES[1])
    )
    placeholder = pd.Series(False, index=df.index)
    for p_lat, p_lon in PLACEHOLDER_POINTS:
        placeholder |= ((lat - p_lat).abs() < 1e-6) & ((lon - p_lon).abs() < 1e-6)

    df["location_valid"] = in_nz & ~placeholder
    df.loc[~df["location_valid"], ["latitude", "longitude"]] = float("nan")
    return df


def drop_unusable_columns(df: pd.DataFrame) -> pd.DataFrame:
    populated = [c for c in EMPTY_COLUMNS if df[c].notna().any()]
    if populated:
        raise ValueError(
            f"Expected-empty columns now contain data: {populated}. "
            "Review them before dropping."
        )
    return df.drop(columns=["advisorySpeed", *EMPTY_COLUMNS])


def add_target(df: pd.DataFrame) -> pd.DataFrame:
    df["is_severe"] = df["crashSeverity"].isin(SEVERE_CATEGORIES)
    return df


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = fix_null_strings(df)
    df = resolve_object_block(df)
    df = fill_pedestrian(df)
    df = reproject_coordinates(df)
    df = flag_invalid_locations(df)
    df = drop_unusable_columns(df)
    df = add_target(df)
    return df


def main() -> None:
    df = load_raw()
    print(f"Loaded raw data: {df.shape}")

    df = clean(df)
    print(f"Cleaned data: {df.shape}")
    print(f"object_involved: {df['object_involved'].mean():.1%} of crashes")
    print(f"invalid locations: {int((~df['location_valid']).sum())}")
    print("is_severe balance:")
    print(df["is_severe"].value_counts(normalize=True))

    PROCESSED_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(PROCESSED_PATH, index=False)
    print(f"Saved cleaned data to {PROCESSED_PATH}")


if __name__ == "__main__":
    main()
