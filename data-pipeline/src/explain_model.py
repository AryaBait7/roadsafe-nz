"""
Explain the trained severity model: SHAP values and a scenario grid.

Two outputs, for two different questions.

**What drives the model overall** — SHAP values on a sample of the test years.
Permutation importance (Stage 20) says how much a feature matters; SHAP adds
the direction and size of each push, in log-odds, and is additive: the pushes
for one crash sum to its prediction minus the average prediction.

**What would this model say about these conditions** — every combination of
the conditions a reader can choose is scored in advance, so the page can show
a real model prediction without shipping the model to the browser. The
remaining inputs are held at their most common training value, which the page
states, because a probability means nothing without knowing what else was
assumed.

Both describe severity *given a crash was reported*, and neither is a causal
claim: SHAP explains the model, not the road.

Run from data-pipeline/ (after train_model.py):
    python src/explain_model.py
"""

from __future__ import annotations

import itertools

import joblib
import numpy as np
import pandas as pd
import shap

from generate_frontend_fixtures import envelope, write_fixture
from train_model import (
    BOOLEAN,
    CATEGORICAL,
    MODELS_DIR,
    NUMERIC,
    RANDOM_STATE,
    TEST_YEARS,
    feature_labels,
    load_splits,
    split_xy,
)

SAMPLE_ROWS = 20_000

# The conditions the scenario explorer lets a reader set. Everything else is
# held fixed, so the grid stays small enough to enumerate exactly.
GRID = {
    "speed_limit_binned": ["low_<=50", "medium_51-80", "high_81-100", "very_high_>100"],
    "road_type": [
        "Local road - urban",
        "Local road - open road",
        "State highway - urban",
        "State highway - open road",
    ],
    "light": ["Bright sun", "Overcast", "Twilight", "Dark"],
    "roadSurface": ["Sealed", "Unsealed"],
    "flatHill": ["Flat", "Hill Road"],
    "adverse_weather": [False, True],
}

SPEED_LABELS = {
    "low_<=50": "50 km/h or less",
    "medium_51-80": "51-80 km/h",
    "high_81-100": "81-100 km/h",
    "very_high_>100": "Over 100 km/h",
}

TOP_CONTRIBUTIONS = 4


def readable(label: str) -> str:
    """Turn the encoder's level codes into the wording the site uses."""
    for code, text in SPEED_LABELS.items():
        label = label.replace(f": {code}", f": {text}")
    return label.replace("holiday_period", "Holiday period").replace(": None", ": Outside holidays")


def source_column(name: str) -> str:
    """Map a transformed column back to the input column it came from."""
    section, _, rest = name.partition("__")
    if section != "categorical":
        return rest
    for column in CATEGORICAL:
        if rest.startswith(f"{column}_"):
            return column
    return rest


def shap_values_for(pipeline, x: pd.DataFrame) -> tuple[np.ndarray, np.ndarray, float]:
    prep = pipeline.named_steps["prep"]
    model = pipeline.named_steps["model"]

    transformed = prep.transform(x)
    explainer = shap.TreeExplainer(model)
    values = explainer.shap_values(transformed)
    return values, transformed, float(explainer.expected_value)


def summarise(values: np.ndarray, transformed: np.ndarray, names: list[str], raw: list[str]) -> dict:
    """Global importance per input, and the signed push of each level."""
    mean_absolute = np.abs(values).mean(axis=0)

    by_input: dict[str, float] = {}
    for column, contribution in zip(raw, mean_absolute):
        by_input[source_column(column)] = by_input.get(source_column(column), 0.0) + float(contribution)

    labels = {**CATEGORICAL, **NUMERIC, **BOOLEAN}
    features = sorted(
        (
            {"feature": labels.get(column, column), "meanAbsoluteShap": round(total, 5)}
            for column, total in by_input.items()
        ),
        key=lambda row: row["meanAbsoluteShap"],
        reverse=True,
    )

    # For one-hot columns, the push when that level is the one present.
    levels = []
    for index, (label, column) in enumerate(zip(names, raw)):
        present = transformed[:, index] == 1
        share = float(present.mean())
        if share < 0.005 or not column.startswith("categorical__"):
            continue
        levels.append({
            "label": label,
            "meanShap": round(float(values[present, index].mean()), 5),
            "share": round(share, 4),
        })

    levels.sort(key=lambda row: row["meanShap"], reverse=True)
    return {"features": features, "levels": levels}


def example_explanations(
    values: np.ndarray, x: pd.DataFrame, names: list[str], probability: np.ndarray, base: float
) -> list[dict]:
    """Three real crashes: the most and least severe-looking, and a typical one."""
    order = np.argsort(probability)
    picks = {
        "Lowest predicted risk in the sample": int(order[0]),
        "Median predicted risk": int(order[len(order) // 2]),
        "Highest predicted risk in the sample": int(order[-1]),
    }

    examples = []
    for title, row in picks.items():
        contributions = values[row]
        top = np.argsort(np.abs(contributions))[::-1][:TOP_CONTRIBUTIONS]
        examples.append({
            "title": title,
            "probability": float(probability[row]),
            "conditions": {
                CATEGORICAL.get(column, NUMERIC.get(column, BOOLEAN.get(column, column))): str(
                    x.iloc[row][column]
                )
                for column in x.columns
            },
            "contributions": [
                {"label": names[i], "shap": round(float(contributions[i]), 5)}
                for i in top
            ],
        })
    return examples


# Below this many matching training crashes, a scenario is extrapolation
# rather than evidence, and the page says so instead of showing a number
# that looks as solid as the rest.
MIN_SUPPORT = 100


def build_scenarios(pipeline, train: pd.DataFrame) -> dict:
    held = {
        column: train[column].mode().iat[0]
        for column in [*CATEGORICAL, *NUMERIC, *BOOLEAN]
        if column not in GRID
    }

    combinations = list(itertools.product(*GRID.values()))
    rows = pd.DataFrame(combinations, columns=list(GRID))
    for column, value in held.items():
        rows[column] = value

    ordered = rows[[*CATEGORICAL, *NUMERIC, *BOOLEAN]]
    probability = pipeline.predict_proba(ordered)[:, 1]

    # How much evidence each combination actually has. A model will answer
    # for conditions that barely occur together — an unsealed state highway
    # in Auckland — and the answer comes from whichever leaf the tree lands
    # in, not from crashes like it. Counting the training rows that match on
    # the varied conditions is what lets the page flag that.
    support = (
        train.groupby(list(GRID), observed=True)["is_severe"]
        .agg(["size", "mean"])
        .rename(columns={"size": "crashes", "mean": "severeRate"})
    )

    values, _, base = shap_values_for(pipeline, ordered)
    names = [readable(label) for label in feature_labels(pipeline)]

    scenarios = []
    for index, combination in enumerate(combinations):
        contributions = values[index]
        top = np.argsort(np.abs(contributions))[::-1][:TOP_CONTRIBUTIONS]
        matched = support.loc[combination] if combination in support.index else None
        scenarios.append({
            "key": "|".join(str(part) for part in combination),
            "probability": round(float(probability[index]), 5),
            "trainingCrashes": int(matched["crashes"]) if matched is not None else 0,
            "observedSevereRate": (
                round(float(matched["severeRate"]), 5) if matched is not None else None
            ),
            "contributions": [
                {"label": names[i], "shap": round(float(contributions[i]), 4)}
                for i in top
            ],
        })

    labels = {**CATEGORICAL, **NUMERIC, **BOOLEAN}
    return {
        "dimensions": [
            {
                "column": column,
                "label": labels[column],
                "options": [
                    {"value": str(option), "label": SPEED_LABELS.get(str(option), str(option))}
                    if column == "speed_limit_binned"
                    else {
                        "value": str(option),
                        "label": {"True": "Yes", "False": "No"}.get(str(option), str(option)),
                    }
                    for option in options
                ],
            }
            for column, options in GRID.items()
        ],
        "heldFixed": [
            {"feature": labels.get(column, column), "value": str(value)}
            for column, value in held.items()
        ],
        "baseLogOdds": round(base, 5),
        "minSupport": MIN_SUPPORT,
        "scenarios": scenarios,
    }


def main() -> None:
    artefact = MODELS_DIR / "severity_model.joblib"
    if not artefact.exists():
        raise SystemExit("No trained model. Run: python src/train_model.py")

    saved = joblib.load(artefact)
    pipeline, model_name = saved["pipeline"], saved["model"]
    print(f"Explaining {model_name} ...")

    splits = load_splits()
    x_test, _ = split_xy(splits["test"])

    rng = np.random.default_rng(RANDOM_STATE)
    sample = x_test.iloc[rng.choice(len(x_test), size=min(SAMPLE_ROWS, len(x_test)), replace=False)]
    print(f"  SHAP on {len(sample):,} test crashes")

    values, transformed, base = shap_values_for(pipeline, sample)
    names = [readable(label) for label in feature_labels(pipeline)]
    raw = list(pipeline.named_steps["prep"].get_feature_names_out())

    summary = summarise(values, transformed, names, raw)
    probability = pipeline.predict_proba(sample)[:, 1]

    print("\n  Strongest inputs (mean |SHAP|, log-odds):")
    for row in summary["features"][:6]:
        print(f"    {row['feature']:22} {row['meanAbsoluteShap']:.4f}")
    print("\n  Largest upward pushes:")
    for row in summary["levels"][:4]:
        print(f"    {row['label']:34} {row['meanShap']:+.4f}")
    print("  Largest downward pushes:")
    for row in summary["levels"][-3:]:
        print(f"    {row['label']:34} {row['meanShap']:+.4f}")

    write_fixture(
        "shap-summary",
        envelope(
            {
                "model": model_name,
                "method": "TreeSHAP on a random sample of the test years, in log-odds",
                "sampleRows": int(len(sample)),
                "testYears": list(TEST_YEARS),
                "baseLogOdds": round(base, 5),
                **summary,
                "examples": example_explanations(values, sample, names, probability, base),
            },
            f"SHAP values for {model_name} on {TEST_YEARS[0]}-{TEST_YEARS[1]}. Explains the "
            "model's reasoning about severity given a crash occurred, not the causes of crashes.",
        ),
    )

    print("\n  Scoring the scenario grid ...")
    scenarios = build_scenarios(pipeline, splits["train"])
    print(f"    {len(scenarios['scenarios'])} combinations")
    write_fixture(
        "scenarios",
        envelope(
            scenarios,
            f"{model_name} predictions for every combination of the listed conditions, "
            "with all other inputs held at their most common training value.",
        ),
    )


if __name__ == "__main__":
    main()
