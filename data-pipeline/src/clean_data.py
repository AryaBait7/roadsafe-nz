"""
Clean the raw NZTA Crash Analysis System (CAS) dataset.

Steps:
1. Load the raw CSV.
2. Replace the literal string "Null" (CAS's own missing-value marker) with
   real NaN in the columns that use it, so pandas/scikit-learn treat it as
   missing instead of a category.
3. Reproject crash coordinates from NZTM2000 (EPSG:2193, meters) to
   WGS84 lon/lat (EPSG:4326) for web mapping (Leaflet/Mapbox expect lon/lat).
4. Drop advisorySpeed (96% missing - not usable as a feature).
5. Create the `is_severe` target: True for Serious or Fatal crashes.

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
# until we do this replacement). flatHill has the same disguised-Null bug as
# weatherA/weatherB/roadSurface, so it's included here too.
NULL_STRING_COLUMNS = ["weatherA", "weatherB", "roadSurface", "flatHill"]

SEVERE_CATEGORIES = {"Fatal Crash", "Serious Crash"}


def load_raw(path: Path = RAW_PATH) -> pd.DataFrame:
    return pd.read_csv(path)


def fix_null_strings(df: pd.DataFrame) -> pd.DataFrame:
    df[NULL_STRING_COLUMNS] = df[NULL_STRING_COLUMNS].replace("Null", pd.NA)
    return df


def reproject_coordinates(df: pd.DataFrame) -> pd.DataFrame:
    transformer = Transformer.from_crs("EPSG:2193", "EPSG:4326", always_xy=True)
    lon, lat = transformer.transform(df["X"].values, df["Y"].values)
    df["longitude"] = lon
    df["latitude"] = lat
    return df


def drop_unusable_columns(df: pd.DataFrame) -> pd.DataFrame:
    return df.drop(columns=["advisorySpeed"])


def add_target(df: pd.DataFrame) -> pd.DataFrame:
    df["is_severe"] = df["crashSeverity"].isin(SEVERE_CATEGORIES)
    return df


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = fix_null_strings(df)
    df = reproject_coordinates(df)
    df = drop_unusable_columns(df)
    df = add_target(df)
    return df


def main() -> None:
    df = load_raw()
    print(f"Loaded raw data: {df.shape}")

    df = clean(df)
    print(f"Cleaned data: {df.shape}")
    print("is_severe balance:")
    print(df["is_severe"].value_counts(normalize=True))

    PROCESSED_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(PROCESSED_PATH, index=False)
    print(f"Saved cleaned data to {PROCESSED_PATH}")


if __name__ == "__main__":
    main()
