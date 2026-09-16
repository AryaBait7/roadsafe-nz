"""
Generate the Data Dictionary page's fixture by profiling the real dataset.

Types, missing percentages, distinct counts and example values are *measured*
from the features CSV every time this runs, so the page cannot drift from the
data. Descriptions and groupings are read from DATA_DICTIONARY.md, which stays
the single human-written source — this script never restates them.

Run from data-pipeline/:
    python src/generate_data_dictionary.py
"""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from generate_frontend_fixtures import (
    FEATURES_PATH,
    USED_COLUMNS,
    envelope,
    write_fixture,
)

DICTIONARY_MD = Path(__file__).resolve().parent.parent.parent / "DATA_DICTIONARY.md"

# Columns created by clean_data.py / feature_engineering.py, not shipped by CAS.
DERIVED = {
    "longitude",
    "latitude",
    "is_severe",
    "total_vehicles_involved",
    "adverse_weather",
    "is_unsealed_road",
    "is_hill_road",
    "is_low_light",
    "is_uncontrolled_intersection",
    "road_hazard_score",
    "speed_limit_binned",
}

# Mirrors CANDIDATE_FEATURES / LEAKAGE_EXCLUDED in frontend/src/services/mlService.ts.
# Plan only: no model has been trained, so "Candidate" is an intention, not a result.
ML_TARGET = {"is_severe"}
ML_CANDIDATES = {
    "speed_limit_binned",
    "crashSHDescription",
    "urban",
    "light",
    "is_low_light",
    "adverse_weather",
    "weatherA",
    "weatherB",
    "roadSurface",
    "is_unsealed_road",
    "flatHill",
    "is_hill_road",
    "trafficControl",
    "is_uncontrolled_intersection",
    "NumberOfLanes",
    "total_vehicles_involved",
    "region",
    "holiday",
}
ML_EXCLUDED = {
    "fatalCount",
    "seriousInjuryCount",
    "minorInjuryCount",
    "crashSeverity",
    "OBJECTID",
}

GROUP_ORDER = [
    "Identifiers & location",
    "Time",
    "Crash severity & casualty counts",
    "Road & environment conditions",
    "Vehicle involvement",
    "Roadside objects struck",
    "Dead / unusable columns",
    "Derived features",
]


def plain(text: str) -> str:
    """Strip the markdown this file uses so descriptions render as text."""
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = text.replace("**", "").replace("`", "").replace("⚠️", "")
    text = re.sub(r"\*\(derived\)\*", "", text)
    return re.sub(r"\s+", " ", text).strip()


def short_group(heading: str) -> str:
    for name in GROUP_ORDER:
        if heading.startswith(name.split(" (")[0]):
            return name
    return re.sub(r"\s*\(.*\)$", "", heading)


def parse_dictionary() -> dict[str, dict[str, str]]:
    """Map column name -> {group, description} from DATA_DICTIONARY.md tables."""
    entries: dict[str, dict[str, str]] = {}
    group = None
    header: list[str] = []
    in_roadside = False

    for line in DICTIONARY_MD.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            group = short_group(line[3:].strip())
            header = []
            in_roadside = group == "Roadside objects struck"
            continue
        if group is None:
            continue

        if line.startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if not header:
                header = [c.lower() for c in cells]
                continue
            if set(cells[0]) <= {"-", ":", " "}:
                continue
            names = re.findall(r"`([^`]+)`", cells[0])
            # The last descriptive column is "Meaning" or "Status".
            idx = next(
                (header.index(h) for h in ("meaning", "status") if h in header),
                len(cells) - 1,
            )
            for name in names:
                entries.setdefault(
                    name, {"group": group, "description": plain(cells[idx])}
                )
            continue

        header = [] if not line.strip() else header
        if in_roadside and line.startswith("`"):
            for name in re.findall(r"`([^`]+)`", line):
                entries.setdefault(
                    name,
                    {
                        "group": group,
                        "description": (
                            "Count of this object struck in the crash. Part of a "
                            "block missing for the same 57.3% of rows; whether "
                            "missing means 'not struck' is not yet resolved."
                        ),
                    },
                )
    return entries


def measured_type(series: pd.Series) -> str:
    if series.isna().all():
        return "Empty"
    if pd.api.types.is_bool_dtype(series):
        return "Boolean"
    if pd.api.types.is_integer_dtype(series):
        return "Integer"
    if pd.api.types.is_float_dtype(series):
        values = series.dropna()
        if len(values) and (values % 1 == 0).all():
            return "Integer"
        return "Decimal"
    return "Text"


def format_value(value: object, kind: str) -> str:
    if kind == "Integer":
        return str(int(value))
    if kind == "Decimal":
        return f"{float(value):.10g}"
    return str(value)


def profile(df: pd.DataFrame, docs: dict[str, dict[str, str]]) -> list[dict]:
    fields = []
    total = len(df)
    used = set(USED_COLUMNS)

    for name in df.columns:
        series = df[name]
        values = series.dropna()
        kind = measured_type(series)
        distinct = int(values.nunique())

        if values.empty:
            example = None
        elif distinct == len(values):
            # Every value unique (identifiers): the mode would be arbitrary.
            example = format_value(values.iloc[0], kind)
        else:
            example = format_value(values.mode().iloc[0], kind)

        if name in ML_TARGET:
            ml = "Target"
        elif name in ML_EXCLUDED:
            ml = "Excluded"
        elif name in ML_CANDIDATES:
            ml = "Candidate"
        else:
            ml = "No"

        doc = docs.get(name, {})
        fields.append(
            {
                "name": name,
                "group": doc.get("group", "Undocumented"),
                "description": doc.get("description"),
                "type": kind,
                "example": example,
                "missingPct": round(float(series.isna().sum()) / total * 100, 2),
                "distinct": distinct,
                "derived": name in DERIVED,
                "usedInDashboard": name in used,
                "ml": ml,
            }
        )

    order = {g: i for i, g in enumerate(GROUP_ORDER)}
    fields.sort(key=lambda f: order.get(f["group"], len(order)))
    return fields


def main() -> None:
    print(f"Reading {FEATURES_PATH.name} ...")
    df = pd.read_csv(FEATURES_PATH, low_memory=False)
    docs = parse_dictionary()

    fields = profile(df, docs)
    undocumented = [f["name"] for f in fields if f["description"] is None]
    stale = sorted(set(docs) - set(df.columns))
    if undocumented:
        print(f"  Not described in DATA_DICTIONARY.md: {', '.join(undocumented)}")
    if stale:
        print(f"  Described but absent from the CSV: {', '.join(stale)}")

    payload = {
        "rowCount": len(df),
        "columnCount": len(df.columns),
        "sourceFile": FEATURES_PATH.name,
        "fields": fields,
    }
    note = (
        f"Profiled from {FEATURES_PATH.name}: {len(df):,} rows, "
        f"{len(df.columns)} columns. Descriptions from DATA_DICTIONARY.md."
    )
    print("\nWriting fixture:")
    write_fixture("data-dictionary", envelope(payload, note))


if __name__ == "__main__":
    main()
