"""
Crude and adjusted associations between crash conditions and severity.

The Risk Factors page compares each condition's severe rate with the overall
rate, one condition at a time. That is honest but incomplete: unsealed roads
are mostly rural and fast, so a crude comparison cannot say whether the road
surface matters *beyond* the speed environment it tends to come with.

This fits one logistic regression with every condition entered together, so
each odds ratio is the association with that condition holding the others
fixed, and reports the crude (one-at-a-time) estimate beside it. A large gap
between the two is the interesting result: it means the crude figure was
mostly carried by the conditions it travels with.

Limits, stated on the page as well:
- Association, never cause. CAS records no cause, and this is observational.
- Severity *given a crash was reported*. The data contains no journeys that
  ended safely, so nothing here says a condition makes a crash more likely.
- Not a prediction model; Stage 20 builds that separately and evaluates it.

Run from data-pipeline/ (after the pipeline has produced the features CSV):
    python src/analyze_associations.py
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import statsmodels.api as sm

from feature_engineering import FEATURES_PATH
from generate_frontend_fixtures import envelope, write_fixture

# Each term: the column, how to turn it into predictors, and the level every
# odds ratio is measured against.
SPEED_LABELS = {
    "low_<=50": "50 km/h or less",
    "medium_51-80": "51-80 km/h",
    "high_81-100": "81-100 km/h",
    "very_high_>100": "Over 100 km/h",
}
SPEED_REFERENCE = "low_<=50"
LIGHT_REFERENCE = "Bright sun"
ROAD_TYPE_REFERENCE = "Local road - urban"

BINARY_TERMS = {
    "adverse_weather": ("Adverse weather", "Weather", "Fine"),
    "is_unsealed_road": ("Unsealed road", "Road surface", "Sealed"),
    "is_hill_road": ("Hill road", "Road geometry", "Flat"),
    "is_uncontrolled_intersection": ("No traffic control", "Traffic control", "Any control"),
    "in_holiday_period": ("Holiday period", "Holiday period", "Outside holidays"),
}

USED_COLUMNS = [
    "is_severe", "speed_limit_binned", "light", "crashSHDescription", "urban",
    "adverse_weather", "is_unsealed_road", "is_hill_road",
    "is_uncontrolled_intersection", "holiday",
]


def prepare(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Complete cases only, with the categorical levels the page reports."""
    total = len(df)

    df = df.copy()
    df["in_holiday_period"] = df["holiday"].notna()
    df["road_type"] = (
        df["crashSHDescription"].map({"Yes": "State highway", "No": "Local road"})
        + " - "
        + df["urban"].map({"Urban": "urban", "Open": "open road"})
    )

    # "Unknown" is absent information, not a condition (see DECISIONS #30), so
    # those rows cannot contribute to a comparison against a known reference.
    df = df[(df["light"] != "Unknown") & (df["crashSHDescription"] != "Unknown")]
    df = df.dropna(subset=["speed_limit_binned", "light", "road_type"])

    excluded = {
        "totalRows": int(total),
        "modelledRows": int(len(df)),
        "excludedRows": int(total - len(df)),
        "reason": "Rows with an unknown speed limit, light condition or road type.",
    }
    return df, excluded


def load_model_frame() -> tuple[pd.DataFrame, dict]:
    return prepare(pd.read_csv(FEATURES_PATH, usecols=USED_COLUMNS, low_memory=False))


def design_matrix(df: pd.DataFrame) -> tuple[pd.DataFrame, list[dict]]:
    """Dummy columns plus the metadata each one needs for reporting."""
    columns: dict[str, pd.Series] = {}
    terms: list[dict] = []

    for level, label in SPEED_LABELS.items():
        if level == SPEED_REFERENCE:
            continue
        name = f"speed::{level}"
        columns[name] = (df["speed_limit_binned"] == level).astype(float)
        terms.append({
            "name": name, "factor": label, "category": "Speed environment",
            "reference": SPEED_LABELS[SPEED_REFERENCE],
        })

    for level in sorted(df["light"].unique()):
        if level == LIGHT_REFERENCE:
            continue
        name = f"light::{level}"
        columns[name] = (df["light"] == level).astype(float)
        terms.append({
            "name": name, "factor": level, "category": "Light",
            "reference": LIGHT_REFERENCE,
        })

    for level in sorted(df["road_type"].unique()):
        if level == ROAD_TYPE_REFERENCE:
            continue
        name = f"road::{level}"
        columns[name] = (df["road_type"] == level).astype(float)
        terms.append({
            "name": name, "factor": level, "category": "Road type",
            "reference": ROAD_TYPE_REFERENCE,
        })

    for column, (label, category, reference) in BINARY_TERMS.items():
        name = f"flag::{column}"
        columns[name] = df[column].astype(float)
        terms.append({
            "name": name, "factor": label, "category": category,
            "reference": reference,
        })

    return pd.DataFrame(columns, index=df.index), terms


def fit(y: pd.Series, x: pd.DataFrame) -> sm.Logit:
    return sm.Logit(y, sm.add_constant(x, has_constant="add")).fit(disp=0)


def odds_ratio(result, name: str) -> dict:
    low, high = result.conf_int().loc[name]
    return {
        "oddsRatio": float(np.exp(result.params[name])),
        "interval": [float(np.exp(low)), float(np.exp(high))],
    }


def main() -> None:
    print(f"Reading {FEATURES_PATH.name} ...")
    df, coverage = load_model_frame()
    y = df["is_severe"].astype(float)
    x, terms = design_matrix(df)
    print(f"  {coverage['modelledRows']:,} complete cases, {len(terms)} terms")

    print("Fitting adjusted model ...")
    adjusted = fit(y, x)

    print("Fitting crude models ...")
    rows = []
    for term in terms:
        name = term["name"]
        exposed = x[name] == 1
        crude = fit(y, x[[name]])

        rows.append({
            "factor": term["factor"],
            "category": term["category"],
            "reference": term["reference"],
            "crashCount": int(exposed.sum()),
            "severeCount": int(y[exposed].sum()),
            "severeRate": float(y[exposed].mean()),
            "crude": odds_ratio(crude, name),
            "adjusted": odds_ratio(adjusted, name),
        })

    rows.sort(key=lambda row: row["adjusted"]["oddsRatio"], reverse=True)

    payload = {
        "model": "Logistic regression (statsmodels Logit), 95% Wald intervals",
        "target": "is_severe",
        "baselineSevereRate": float(y.mean()),
        "pseudoR2": float(adjusted.prsquared),
        "coverage": coverage,
        "terms": rows,
    }
    print("\nAdjusted odds ratios:")
    for row in rows:
        crude, adj = row["crude"]["oddsRatio"], row["adjusted"]["oddsRatio"]
        print(f"  {row['factor']:26} crude {crude:5.2f}  adjusted {adj:5.2f}")
    print(f"\nMcFadden pseudo R2: {payload['pseudoR2']:.4f}")

    write_fixture(
        "adjusted-associations",
        envelope(
            payload,
            "Logistic regression over the full CAS dataset. Associations with "
            "severity given a crash occurred, not causes and not predictions.",
        ),
    )


if __name__ == "__main__":
    main()
