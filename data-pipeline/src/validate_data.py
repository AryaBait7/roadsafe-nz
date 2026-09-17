"""
Data-quality checks run between pipeline steps.

Each check states an expectation the rest of the project relies on. A failed
check stops the pipeline: publishing figures from data that broke one of
these assumptions would be worse than publishing nothing.

Also computes a content fingerprint. NZTA's exports reorder rows and
renumber OBJECTID between downloads even when the data is identical, so a
file hash says "different" when nothing changed. The fingerprint is a sum of
per-row hashes with OBJECTID excluded: it ignores row order and changes only
when the crashes themselves change.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from clean_data import (
    EMPTY_COLUMNS,
    LAT_RANGE,
    LON_RANGES,
    OBJECT_COLUMNS,
    SEVERE_CATEGORIES,
)

SEVERITIES = {"Fatal Crash", "Serious Crash", "Minor Crash", "Non-Injury Crash"}

# Unmappable crashes are expected to be rare. A jump means something changed
# upstream (a projection, a new placeholder) and needs a look, not a map
# quietly missing thousands of crashes.
MAX_INVALID_LOCATIONS = 50


@dataclass
class Report:
    stage: str
    failures: list[str] = field(default_factory=list)
    passed: list[str] = field(default_factory=list)

    def check(self, ok: bool, message: str) -> None:
        (self.passed if ok else self.failures).append(message)

    def raise_if_failed(self) -> None:
        for message in self.passed:
            print(f"  ok    {message}")
        for message in self.failures:
            print(f"  FAIL  {message}")
        if self.failures:
            raise SystemExit(f"{self.stage}: {len(self.failures)} check(s) failed")


def fingerprint(df: pd.DataFrame) -> str:
    rows = pd.util.hash_pandas_object(
        df.drop(columns=["OBJECTID"], errors="ignore").astype(str), index=False
    )
    return f"{int(rows.sum()) & (2**64 - 1):016x}"


def validate_raw(df: pd.DataFrame, expected_rows: int) -> Report:
    report = Report("raw")
    report.check(len(df) == expected_rows, f"row count {len(df):,} matches the manifest")
    report.check(df["OBJECTID"].is_unique, "OBJECTID is unique within the snapshot")
    report.check(
        set(df["crashSeverity"].dropna().unique()) <= SEVERITIES,
        "crashSeverity uses only the four known levels",
    )
    report.check(df["crashSeverity"].notna().all(), "every crash has a severity")
    report.check(df["crashYear"].notna().all(), "every crash has a year")
    return report


def validate_clean(df: pd.DataFrame, expected_rows: int) -> Report:
    report = Report("clean")
    report.check(len(df) == expected_rows, f"no rows lost in cleaning ({len(df):,})")

    leftover = [
        c for c in df.select_dtypes(include=["object", "str"]).columns
        if (df[c] == "Null").any()
    ]
    report.check(not leftover, f'no literal "Null" strings remain {leftover or ""}')

    report.check(
        not any(c in df.columns for c in [*EMPTY_COLUMNS, "advisorySpeed"]),
        "empty and unusable columns are dropped",
    )
    report.check(df[OBJECT_COLUMNS].notna().all().all(), "object-struck block has no blanks")
    report.check(df["pedestrian"].notna().all(), "pedestrian has no blanks")
    report.check(
        (df["is_severe"] == df["crashSeverity"].isin(SEVERE_CATEGORIES)).all(),
        "is_severe agrees with crashSeverity",
    )

    valid = df[df["location_valid"]]
    lat_ok = valid["latitude"].between(*LAT_RANGE)
    lon_ok = valid["longitude"].between(*LON_RANGES[0]) | valid["longitude"].between(*LON_RANGES[1])
    report.check(bool((lat_ok & lon_ok).all()), "every valid location falls within New Zealand")

    invalid = df[~df["location_valid"]]
    report.check(
        invalid[["latitude", "longitude"]].isna().all().all(),
        "invalid locations have blank coordinates",
    )
    report.check(
        len(invalid) <= MAX_INVALID_LOCATIONS,
        f"{len(invalid)} crash(es) without a usable location (limit {MAX_INVALID_LOCATIONS})",
    )
    return report


def validate_features(df: pd.DataFrame, expected_rows: int) -> Report:
    report = Report("features")
    report.check(len(df) == expected_rows, f"no rows lost in feature engineering ({len(df):,})")
    report.check(df["road_hazard_score"].between(0, 5).all(), "road_hazard_score is within 0–5")
    report.check(df["total_vehicles_involved"].ge(0).all(), "total_vehicles_involved is non-negative")
    binned = df["speed_limit_binned"].notna()
    report.check(
        (binned == df["speedLimit"].notna()).all(),
        "every known speed limit has a band, and only those",
    )
    return report
