"""
Train and evaluate the crash-severity model.

Predicts `is_severe` (serious or fatal) **given that a crash was reported**.
It cannot say whether a crash will happen: CAS contains only crashes, so the
data has no examples of journeys that ended safely.

Method, and why:

- **Chronological split**, never random: train 2006–2019, validate 2020–2021,
  test 2022–2025, with the partial year held out entirely. The severe rate
  rises over the period, so a random split would leak later years into
  training and flatter every score.
- **The test years are used once**, for the model already chosen on
  validation. Picking a model or a threshold by test performance would make
  the reported figures optimistic.
- **PR-AUC is the headline**, not accuracy or ROC-AUC. Positives are ~7% of
  rows, so predicting "not severe" for everything scores ~93% accuracy while
  catching nothing, and ROC-AUC is dominated by the easy negatives.
- **No class reweighting.** The imbalance is handled by choosing the decision
  threshold on validation, which leaves the predicted probabilities usable as
  probabilities. A reliability table is reported so that claim is checkable.

Excluded from the features:
- Casualty counts and `crashSeverity` define the target (leakage).
- `OBJECTID`, a row number.
- The object-struck block: what a vehicle hit is recorded as part of the crash
  description and partly reflects how the crash ended, so it sits too close to
  the outcome to use as an input.

Run from data-pipeline/ (after run_pipeline.py):
    python src/train_model.py
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    precision_recall_fscore_support,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

from feature_engineering import FEATURES_PATH
from generate_frontend_fixtures import envelope, write_fixture

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

TRAIN_YEARS = (2006, 2019)
VALIDATION_YEARS = (2020, 2021)
TEST_YEARS = (2022, 2025)

# Labels match the wording the site already uses for these columns.
CATEGORICAL = {
    "speed_limit_binned": "Speed environment",
    "road_type": "Road type",
    "light": "Light",
    "roadSurface": "Road surface",
    "flatHill": "Road geometry",
    "trafficControl": "Traffic control",
    "region": "Region",
    "holiday_period": "Holiday period",
}
NUMERIC = {
    "NumberOfLanes": "Number of lanes",
    "total_vehicles_involved": "Vehicles involved",
}
BOOLEAN = {"adverse_weather": "Adverse weather"}

LOAD_COLUMNS = [
    "crashYear", "is_severe", "speed_limit_binned", "light", "roadSurface",
    "flatHill", "trafficControl", "region", "holiday", "NumberOfLanes",
    "total_vehicles_involved", "adverse_weather", "crashSHDescription", "urban",
]

RANDOM_STATE = 42


def load_splits() -> dict[str, pd.DataFrame]:
    df = pd.read_csv(FEATURES_PATH, usecols=LOAD_COLUMNS, low_memory=False)

    df["road_type"] = (
        df["crashSHDescription"].map({"Yes": "State highway", "No": "Local road"})
        + " - "
        + df["urban"].map({"Urban": "urban", "Open": "open road"})
    ).fillna("Unknown")
    # A blank holiday means "not in a holiday period", which is information.
    df["holiday_period"] = df["holiday"].fillna("None")
    for column in CATEGORICAL:
        df[column] = df[column].fillna("Unknown").astype(str)

    def slice_years(bounds: tuple[int, int]) -> pd.DataFrame:
        return df[df["crashYear"].between(*bounds)]

    return {
        "train": slice_years(TRAIN_YEARS),
        "validation": slice_years(VALIDATION_YEARS),
        "test": slice_years(TEST_YEARS),
    }


def split_xy(df: pd.DataFrame) -> tuple[pd.DataFrame, np.ndarray]:
    features = [*CATEGORICAL, *NUMERIC, *BOOLEAN]
    return df[features], df["is_severe"].to_numpy(dtype=int)


def preprocessor(scale: bool) -> ColumnTransformer:
    numeric_steps = [("impute", SimpleImputer(strategy="median"))]
    if scale:
        numeric_steps.append(("scale", StandardScaler()))

    return ColumnTransformer(
        [
            (
                "categorical",
                OneHotEncoder(handle_unknown="ignore", min_frequency=50, sparse_output=False),
                list(CATEGORICAL),
            ),
            ("numeric", Pipeline(numeric_steps), list(NUMERIC)),
            ("boolean", "passthrough", list(BOOLEAN)),
        ]
    )


def candidates() -> dict[str, Pipeline]:
    return {
        "Always predict not severe": Pipeline(
            [("model", DummyClassifier(strategy="prior"))]
        ),
        "Logistic regression": Pipeline(
            [
                ("prep", preprocessor(scale=True)),
                ("model", LogisticRegression(max_iter=1000, random_state=RANDOM_STATE)),
            ]
        ),
        "Random forest": Pipeline(
            [
                ("prep", preprocessor(scale=False)),
                (
                    "model",
                    RandomForestClassifier(
                        n_estimators=300,
                        min_samples_leaf=25,
                        n_jobs=-1,
                        random_state=RANDOM_STATE,
                    ),
                ),
            ]
        ),
        "XGBoost": Pipeline(
            [
                ("prep", preprocessor(scale=False)),
                (
                    "model",
                    XGBClassifier(
                        n_estimators=400,
                        learning_rate=0.08,
                        max_depth=6,
                        subsample=0.8,
                        colsample_bytree=0.8,
                        min_child_weight=5,
                        eval_metric="aucpr",
                        tree_method="hist",
                        n_jobs=-1,
                        random_state=RANDOM_STATE,
                    ),
                ),
            ]
        ),
    }


def scores(y_true: np.ndarray, probability: np.ndarray, threshold: float) -> dict:
    predicted = (probability >= threshold).astype(int)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, predicted, average="binary", zero_division=0
    )
    tn, fp, fn, tp = confusion_matrix(y_true, predicted, labels=[0, 1]).ravel()

    return {
        "threshold": float(threshold),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "rocAuc": float(roc_auc_score(y_true, probability)),
        "prAuc": float(average_precision_score(y_true, probability)),
        "accuracy": float((predicted == y_true).mean()),
        "confusionMatrix": {
            "trueNegative": int(tn),
            "falsePositive": int(fp),
            "falseNegative": int(fn),
            "truePositive": int(tp),
        },
    }


def best_threshold(y_true: np.ndarray, probability: np.ndarray) -> float:
    """The threshold with the best F1 on *validation*, never on test."""
    grid = np.quantile(probability, np.linspace(0.5, 0.999, 120))
    best, best_f1 = 0.5, -1.0
    for threshold in np.unique(grid):
        predicted = (probability >= threshold).astype(int)
        _, _, f1, _ = precision_recall_fscore_support(
            y_true, predicted, average="binary", zero_division=0
        )
        if f1 > best_f1:
            best, best_f1 = float(threshold), float(f1)
    return best


def calibration(y_true: np.ndarray, probability: np.ndarray, bins: int = 10) -> list[dict]:
    """Predicted probability against what actually happened, by bin."""
    edges = np.unique(np.quantile(probability, np.linspace(0, 1, bins + 1)))
    if len(edges) < 2:
        # A model that predicts one value everywhere has a single bin; it
        # still has a calibration story, and dropping it would lose every row.
        return [{
            "predicted": float(probability.mean()),
            "observed": float(y_true.mean()),
            "crashes": int(len(y_true)),
        }]

    index = np.clip(np.digitize(probability, edges[1:-1]), 0, len(edges) - 2)

    rows = []
    for b in range(len(edges) - 1):
        mask = index == b
        if not mask.any():
            continue
        rows.append({
            "predicted": float(probability[mask].mean()),
            "observed": float(y_true[mask].mean()),
            "crashes": int(mask.sum()),
        })
    return rows


def feature_labels(pipeline: Pipeline) -> list[str]:
    prep = pipeline.named_steps["prep"]
    names = list(prep.get_feature_names_out())

    pretty = []
    for name in names:
        section, _, rest = name.partition("__")
        if section == "categorical":
            # Match the longest known column name first: several inputs
            # contain underscores, so splitting on the first one mislabels
            # them ("speed: limit_binned_Unknown").
            column = next(
                (c for c in sorted(CATEGORICAL, key=len, reverse=True)
                 if rest.startswith(f"{c}_")),
                rest,
            )
            level = rest[len(column) + 1:] if column != rest else rest
            pretty.append(f"{CATEGORICAL.get(column, column)}: {level}")
        elif section == "numeric":
            pretty.append(NUMERIC.get(rest, rest))
        else:
            pretty.append(BOOLEAN.get(rest, rest))
    return pretty


def importance(pipeline: Pipeline, x: pd.DataFrame, y: np.ndarray, top: int = 12) -> list[dict]:
    """
    Permutation importance: how much PR-AUC drops when one input is shuffled.

    Model-agnostic and measured on data the model was not fitted to, unlike a
    tree's built-in split counts, which favour high-cardinality inputs.
    """
    sample = min(30_000, len(x))
    rng = np.random.default_rng(RANDOM_STATE)
    rows = rng.choice(len(x), size=sample, replace=False)

    result = permutation_importance(
        pipeline,
        x.iloc[rows],
        y[rows],
        scoring="average_precision",
        n_repeats=3,
        random_state=RANDOM_STATE,
        n_jobs=1,
    )
    order = np.argsort(result.importances_mean)[::-1][:top]
    return [
        {
            "feature": f"{CATEGORICAL.get(x.columns[i]) or NUMERIC.get(x.columns[i]) or BOOLEAN.get(x.columns[i], x.columns[i])}",
            "importance": float(result.importances_mean[i]),
            "standardDeviation": float(result.importances_std[i]),
        }
        for i in order
        if result.importances_mean[i] > 0
    ]


def main() -> None:
    print(f"Reading {FEATURES_PATH.name} ...")
    splits = load_splits()
    data = {name: split_xy(df) for name, df in splits.items()}
    for name, (x, y) in data.items():
        print(f"  {name:11} {len(x):>7,} rows, {y.mean():.2%} severe")

    x_train, y_train = data["train"]
    x_val, y_val = data["validation"]
    x_test, y_test = data["test"]

    comparison = []
    fitted: dict[str, Pipeline] = {}

    for name, pipeline in candidates().items():
        print(f"\nFitting {name} ...")
        started = time.perf_counter()
        pipeline.fit(x_train, y_train)
        seconds = time.perf_counter() - started

        probability = pipeline.predict_proba(x_val)[:, 1]
        threshold = best_threshold(y_val, probability)
        result = scores(y_val, probability, threshold)

        fitted[name] = pipeline
        comparison.append({"model": name, "fitSeconds": round(seconds, 1), **result})
        print(
            f"  PR-AUC {result['prAuc']:.4f}  ROC-AUC {result['rocAuc']:.4f}  "
            f"F1 {result['f1']:.3f} at {threshold:.3f}  ({seconds:.0f}s)"
        )

    # Chosen on validation PR-AUC. The dummy is a reference point, not a
    # candidate: it has no ranking to score.
    ranked = sorted(
        (row for row in comparison if row["model"] != "Always predict not severe"),
        key=lambda row: row["prAuc"],
        reverse=True,
    )
    chosen_name = ranked[0]["model"]
    chosen = fitted[chosen_name]
    threshold = ranked[0]["threshold"]
    print(f"\nChosen on validation PR-AUC: {chosen_name} (threshold {threshold:.3f})")

    print("Evaluating on the test years, once ...")
    test_probability = chosen.predict_proba(x_test)[:, 1]
    test_scores = scores(y_test, test_probability, threshold)

    print("Permutation importance ...")
    ranking = importance(chosen, x_val, y_val)

    MODELS_DIR.mkdir(exist_ok=True)
    artefact = MODELS_DIR / "severity_model.joblib"
    joblib.dump({"pipeline": chosen, "threshold": threshold, "model": chosen_name}, artefact)

    prevalence = float(y_test.mean())
    metrics = {
        "modelName": chosen_name,
        "trainedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "precision": test_scores["precision"],
        "recall": test_scores["recall"],
        "f1": test_scores["f1"],
        "rocAuc": test_scores["rocAuc"],
        "prAuc": test_scores["prAuc"],
        "accuracy": test_scores["accuracy"],
        "confusionMatrix": test_scores["confusionMatrix"],
        "threshold": threshold,
        "thresholdRule": "Best F1 on the validation years; the test years were scored once, with this threshold already fixed.",
        "trainYears": list(TRAIN_YEARS),
        "validationYears": list(VALIDATION_YEARS),
        "testYears": list(TEST_YEARS),
        "trainRows": int(len(x_train)),
        "testRows": int(len(x_test)),
        "testPrevalence": prevalence,
        "references": {
            "alwaysNotSevereAccuracy": 1 - prevalence,
            "randomPrAuc": prevalence,
        },
        "comparison": comparison,
        "calibration": calibration(y_test, test_probability),
        "features": [*CATEGORICAL.values(), *NUMERIC.values(), *BOOLEAN.values()],
    }

    print("\nTest years:")
    print(f"  PR-AUC {test_scores['prAuc']:.4f} (random would score {prevalence:.4f})")
    print(f"  ROC-AUC {test_scores['rocAuc']:.4f}")
    print(f"  precision {test_scores['precision']:.3f}  recall {test_scores['recall']:.3f}"
          f"  F1 {test_scores['f1']:.3f}")
    print(f"  confusion {test_scores['confusionMatrix']}")

    note = (
        f"{chosen_name} trained on {TRAIN_YEARS[0]}-{TRAIN_YEARS[1]}, chosen on "
        f"{VALIDATION_YEARS[0]}-{VALIDATION_YEARS[1]}, scored once on "
        f"{TEST_YEARS[0]}-{TEST_YEARS[1]}. Estimates severity given a crash "
        "occurred; it cannot predict whether a crash will happen."
    )
    write_fixture("model-metrics", envelope(metrics, note))
    write_fixture(
        "feature-importance",
        envelope(
            {"model": chosen_name, "method": "Permutation importance on the validation years, scored by PR-AUC", "items": ranking},
            note,
        ),
    )
    print(f"\nSaved model to {artefact.relative_to(MODELS_DIR.parent)}")


if __name__ == "__main__":
    main()
