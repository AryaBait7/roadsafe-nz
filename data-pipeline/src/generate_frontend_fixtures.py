"""
Generate the frontend's development data source from the real CAS dataset.

The features CSV is 299MB / 705,609 rows. Neither a browser nor the future
Express API will ever see raw rows — both will deal in aggregates. So this
script pre-computes exactly the aggregates the API will later serve, and the
frontend reads them as JSON. The *shape* of these files is the API contract.

Everything written here is derived from real CAS data. Fixtures that are not
real (the ML ones, until a model exists) are authored separately and marked
`"source": "placeholder"` so the UI can badge them.

Design notes
------------
Filtering: rather than one pre-filtered file per view, we emit a single
aggregate "cube" at the grain the dashboard filters on. The frontend groups
that cube in memory. This is exactly the GROUP BY the SQL layer will do in
Stage 19 — which is the point: the frontend logic maps 1:1 onto the query
that replaces it.

Payload: the cube is written column-oriented (a `columns` header plus rows of
values) rather than as a list of objects. Repeating 14 key names across
~29k rows roughly triples the file size for no benefit.

Run from data-pipeline/:
    python src/generate_frontend_fixtures.py
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

FEATURES_PATH = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "processed"
    / "cas_crash_data_features.csv"
)
OUTPUT_DIR = (
    Path(__file__).resolve().parent.parent.parent
    / "frontend"
    / "src"
    / "data"
    / "fixtures"
)

# Only the columns the frontend actually needs — reading all 82 wastes memory.
USED_COLUMNS = [
    "crashYear",
    "crashSeverity",
    "region",
    "tlaName",
    "urban",
    "crashSHDescription",
    "speed_limit_binned",
    "light",
    "holiday",
    "fatalCount",
    "seriousInjuryCount",
    "minorInjuryCount",
    "is_severe",
    "adverse_weather",
    "is_unsealed_road",
    "is_hill_road",
    "is_uncontrolled_intersection",
    "longitude",
    "latitude",
]

UNKNOWN = "Unknown"

SEVERITY_ORDER = [
    "Fatal Crash",
    "Serious Crash",
    "Minor Crash",
    "Non-Injury Crash",
]

# CAS stores speed limits as numbers; feature engineering bucketed them.
# Relabelled here for display — the bucket boundaries are unchanged.
SPEED_ENVIRONMENT_LABELS = {
    "low_<=50": "50 km/h or less",
    "medium_51-80": "51-80 km/h",
    "high_81-100": "81-100 km/h",
    "very_high_>100": "Over 100 km/h",
}
SPEED_ENVIRONMENT_ORDER = [*SPEED_ENVIRONMENT_LABELS.values(), UNKNOWN]

# Map grid resolution in degrees. 0.05 deg is roughly 5.5km of latitude —
# fine enough to show real spatial structure, coarse enough to keep the
# payload small. Individual crash coordinates are never published.
GRID_DEGREES = 0.05

# A crash year is treated as incomplete if it has far fewer crashes than the
# year before it. The dataset carries no export date, so completeness has to
# be inferred; the UI uses this to exclude the year from trend lines.
PARTIAL_YEAR_THRESHOLD = 0.75


def load_features() -> pd.DataFrame:
    return pd.read_csv(FEATURES_PATH, usecols=USED_COLUMNS, low_memory=False)


def derive_dimensions(df: pd.DataFrame) -> pd.DataFrame:
    """Add the display dimensions the UI filters on.

    `roadType` does not exist in CAS as a single column. It is composed from
    two real ones — whether the crash was on a state highway
    (`crashSHDescription`) and whether the location is urban or open road
    (`urban`) — because neither alone is a useful road classification.
    """
    highway = df["crashSHDescription"].map({"Yes": "State highway", "No": "Local road"})
    environment = df["urban"].map({"Urban": "urban", "Open": "open road"})

    df["roadType"] = (highway + " - " + environment).fillna(UNKNOWN)
    df["speedEnvironment"] = (
        df["speed_limit_binned"].map(SPEED_ENVIRONMENT_LABELS).fillna(UNKNOWN)
    )
    df["region"] = df["region"].fillna(UNKNOWN)
    df["tlaName"] = df["tlaName"].fillna(UNKNOWN)
    df["light"] = df["light"].fillna(UNKNOWN)
    # `holiday` is null whenever the crash was not in a holiday period, which
    # is the majority — that absence is meaningful, not missing.
    df["holiday"] = df["holiday"].fillna("Not a holiday period")

    for column in ["fatalCount", "seriousInjuryCount", "minorInjuryCount"]:
        df[column] = df[column].fillna(0)

    return df


def build_cube(df: pd.DataFrame) -> dict:
    """Aggregate to the grain the dashboard filters on.

    Every dashboard number except the map and hotspots is a GROUP BY over
    this cube. Condition flags are carried as counts so "conditions present"
    can be computed for any filter combination.
    """
    dimensions = [
        "crashYear",
        "region",
        "roadType",
        "speedEnvironment",
        "crashSeverity",
        "light",
        "holiday",
    ]

    grouped = df.groupby(dimensions, dropna=False, observed=True).agg(
        crashCount=("crashSeverity", "size"),
        peopleKilled=("fatalCount", "sum"),
        seriousInjuries=("seriousInjuryCount", "sum"),
        minorInjuries=("minorInjuryCount", "sum"),
        adverseWeather=("adverse_weather", "sum"),
        unsealedRoad=("is_unsealed_road", "sum"),
        hillRoad=("is_hill_road", "sum"),
        noTrafficControl=("is_uncontrolled_intersection", "sum"),
    )
    grouped = grouped.reset_index()

    columns = dimensions + [
        "crashCount",
        "peopleKilled",
        "seriousInjuries",
        "minorInjuries",
        "adverseWeather",
        "unsealedRoad",
        "hillRoad",
        "noTrafficControl",
    ]

    rows = [
        [
            int(row.crashYear),
            row.region,
            row.roadType,
            row.speedEnvironment,
            row.crashSeverity,
            row.light,
            row.holiday,
            int(row.crashCount),
            int(row.peopleKilled),
            int(row.seriousInjuries),
            int(row.minorInjuries),
            int(row.adverseWeather),
            int(row.unsealedRoad),
            int(row.hillRoad),
            int(row.noTrafficControl),
        ]
        for row in grouped.itertuples(index=False)
    ]

    return {"columns": columns, "rows": rows}


def build_hotspots(df: pd.DataFrame) -> dict:
    """Crash concentrations per territorial authority.

    TLA metadata (name, region, centroid) is separated from the counts so the
    centroid is not repeated across every year/severity combination.
    """
    areas = (
        df.groupby("tlaName", observed=True)
        .agg(
            region=("region", lambda values: values.mode().iat[0]),
            latitude=("latitude", "mean"),
            longitude=("longitude", "mean"),
        )
        .reset_index()
        .sort_values("tlaName")
        .reset_index(drop=True)
    )

    area_index = {name: i for i, name in enumerate(areas["tlaName"])}

    counts = (
        df.groupby(["tlaName", "crashYear", "crashSeverity"], observed=True)
        .size()
        .reset_index(name="crashCount")
    )

    return {
        "areas": [
            {
                "id": str(row.tlaName),
                "name": str(row.tlaName),
                "region": str(row.region),
                "latitude": round(float(row.latitude), 5),
                "longitude": round(float(row.longitude), 5),
            }
            for row in areas.itertuples(index=False)
        ],
        "columns": ["areaIndex", "crashYear", "crashSeverity", "crashCount"],
        "rows": [
            [
                area_index[row.tlaName],
                int(row.crashYear),
                row.crashSeverity,
                int(row.crashCount),
            ]
            for row in counts.itertuples(index=False)
        ],
    }


def build_map_cells(df: pd.DataFrame) -> dict:
    """Crash density on a fixed geographic grid.

    Coordinates are snapped to a grid rather than published per crash: the
    browser cannot render 705,609 markers, and aggregated cells avoid
    publishing the precise location of individual incidents.

    Geometry is split out as cell metadata and the counts reference it by
    index. A cell sits in exactly one region, so carrying region here costs
    6,103 entries instead of the 61,008 it would cost as a row dimension —
    and it is what lets the map honour the region filter. Not repeating the
    coordinates on every row makes the file smaller despite the addition.
    """
    cells = df.assign(
        cellLat=(df["latitude"] / GRID_DEGREES).round() * GRID_DEGREES,
        cellLon=(df["longitude"] / GRID_DEGREES).round() * GRID_DEGREES,
    )

    # A 0.05 degree cell can straddle a boundary; the modal region is the
    # honest assignment and is only used for filtering, never for reporting
    # a region's totals (those come from the cube).
    cell_region = (
        cells.groupby(["cellLat", "cellLon"], observed=True)["region"]
        .agg(lambda values: values.mode().iat[0])
        .reset_index()
        .sort_values(["cellLat", "cellLon"])
        .reset_index(drop=True)
    )

    regions = sorted(cell_region["region"].unique())
    region_index = {name: i for i, name in enumerate(regions)}
    cell_index = {
        (row.cellLat, row.cellLon): i
        for i, row in enumerate(cell_region.itertuples(index=False))
    }

    grouped = (
        cells.groupby(["cellLat", "cellLon", "crashYear"], observed=True)
        .agg(crashCount=("crashSeverity", "size"), severeCount=("is_severe", "sum"))
        .reset_index()
    )

    return {
        "gridDegrees": GRID_DEGREES,
        # [latitude, longitude, regionIndex] per cell.
        "cells": [
            [round(float(row.cellLat), 4), round(float(row.cellLon), 4),
             region_index[row.region]]
            for row in cell_region.itertuples(index=False)
        ],
        "regions": regions,
        "columns": ["cellIndex", "crashYear", "crashCount", "severeCount"],
        "rows": [
            [
                cell_index[(row.cellLat, row.cellLon)],
                int(row.crashYear),
                int(row.crashCount),
                int(row.severeCount),
            ]
            for row in grouped.itertuples(index=False)
        ],
    }


def build_filter_options(df: pd.DataFrame) -> dict:
    yearly = df.groupby("crashYear", observed=True).size().sort_index()
    latest_year = int(yearly.index[-1])
    previous_year = int(yearly.index[-2])
    latest_is_partial = bool(
        yearly.iloc[-1] < yearly.iloc[-2] * PARTIAL_YEAR_THRESHOLD
    )

    regions = sorted(value for value in df["region"].unique() if value != UNKNOWN)
    road_types = sorted(value for value in df["roadType"].unique() if value != UNKNOWN)
    speed_environments = [
        value for value in SPEED_ENVIRONMENT_ORDER if value in set(df["speedEnvironment"])
    ]

    return {
        "regions": regions,
        "roadTypes": road_types,
        "speedEnvironments": speed_environments,
        "severities": SEVERITY_ORDER,
        "lightConditions": sorted(df["light"].unique()),
        "yearMin": int(yearly.index[0]),
        "yearMax": latest_year,
        "latestYearIsPartial": latest_is_partial,
        "partialYearNote": (
            f"{latest_year} is incomplete: it records {int(yearly.iloc[-1]):,} crashes "
            f"against {int(yearly.iloc[-2]):,} in {previous_year}. Excluded from trend "
            "lines by default so the series does not appear to fall."
            if latest_is_partial
            else None
        ),
    }


def envelope(data: object, note: str) -> dict:
    return {
        "data": data,
        "meta": {
            "source": "real",
            "note": note,
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
    }


def write_fixture(name: str, payload: dict) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / f"{name}.json"

    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))

    size_mb = path.stat().st_size / 1_000_000
    print(f"  {name}.json  {size_mb:>6.2f} MB")


def main() -> None:
    print(f"Reading {FEATURES_PATH.name} ...")
    df = derive_dimensions(load_features())
    print(f"Loaded {len(df):,} crashes, {df['crashYear'].min()}-{df['crashYear'].max()}")

    source = (
        "Aggregated from the NZTA Crash Analysis System (CAS) dataset, "
        f"{len(df):,} crash records."
    )

    print("\nWriting fixtures:")
    cube = build_cube(df)
    write_fixture("crash-cube", envelope(cube, source))
    print(f"    ({len(cube['rows']):,} aggregate rows)")

    hotspots = build_hotspots(df)
    write_fixture("hotspots", envelope(hotspots, source))
    print(f"    ({len(hotspots['areas'])} areas, {len(hotspots['rows']):,} rows)")

    cells = build_map_cells(df)
    write_fixture("map-cells", envelope(cells, source))
    print(f"    ({len(cells['rows']):,} grid cells x years)")

    write_fixture("filter-options", envelope(build_filter_options(df), source))

    print("\nDone.")


if __name__ == "__main__":
    main()
