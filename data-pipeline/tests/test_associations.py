"""
Unit tests for the association model's data preparation.

The fitted estimates themselves are checked against the real dataset by the
frontend service tests; these cover the choices that decide what the model is
actually measuring: which rows qualify, and which level each odds ratio is
measured against.
"""

import numpy as np
import pandas as pd

import analyze_associations as aa


def frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "is_severe": [True, False, False, True, False],
            "speed_limit_binned": [
                "low_<=50", "high_81-100", "low_<=50", np.nan, "high_81-100",
            ],
            "light": ["Bright sun", "Dark", "Unknown", "Dark", "Bright sun"],
            "crashSHDescription": ["No", "Yes", "No", "No", "Unknown"],
            "urban": ["Urban", "Open", "Urban", "Open", "Open"],
            "adverse_weather": [False, True, False, False, True],
            "is_unsealed_road": [False, True, False, False, False],
            "is_hill_road": [False, False, True, False, False],
            "is_uncontrolled_intersection": [True, False, False, True, False],
            "holiday": [np.nan, "Easter", np.nan, np.nan, "Easter"],
        }
    )


class TestModelFrame:
    def test_drops_rows_that_cannot_be_compared(self):
        df, coverage = aa.prepare(frame())

        # Rows 2 (light Unknown), 3 (no speed band) and 4 (highway Unknown)
        # have no known level to compare against a reference.
        assert coverage == {
            "totalRows": 5,
            "modelledRows": 2,
            "excludedRows": 3,
            "reason": "Rows with an unknown speed limit, light condition or road type.",
        }
        assert df.index.tolist() == [0, 1]

    def test_builds_the_derived_predictors(self):
        df, _ = aa.prepare(frame())
        assert df["road_type"].tolist() == [
            "Local road - urban",
            "State highway - open road",
        ]
        assert df["in_holiday_period"].tolist() == [False, True]

    def test_does_not_mutate_the_caller_frame(self):
        original = frame()
        aa.prepare(original)
        assert "road_type" not in original.columns


class TestDesignMatrix:
    def test_reference_levels_get_no_column(self):
        df = frame().iloc[[0, 1]].copy()
        df["in_holiday_period"] = df["holiday"].notna()
        df["road_type"] = ["Local road - urban", "State highway - open road"]

        x, terms = aa.design_matrix(df)
        names = [t["name"] for t in terms]

        # The reference level of each categorical is absent by design: every
        # odds ratio is measured against it.
        assert f"speed::{aa.SPEED_REFERENCE}" not in names
        assert f"light::{aa.LIGHT_REFERENCE}" not in names
        assert f"road::{aa.ROAD_TYPE_REFERENCE}" not in names
        assert list(x.columns) == names

    def test_every_term_reports_its_reference(self):
        df = frame().iloc[[0, 1]].copy()
        df["in_holiday_period"] = df["holiday"].notna()
        df["road_type"] = ["Local road - urban", "State highway - open road"]

        _, terms = aa.design_matrix(df)
        assert all(term["reference"] for term in terms)
        assert {t["factor"] for t in terms} >= {
            "81-100 km/h", "Unsealed road", "Holiday period",
        }

    def test_binary_flags_become_0_1(self):
        df = frame().iloc[[0, 1]].copy()
        df["in_holiday_period"] = df["holiday"].notna()
        df["road_type"] = ["Local road - urban", "State highway - open road"]

        x, _ = aa.design_matrix(df)
        assert x["flag::is_unsealed_road"].tolist() == [0.0, 1.0]
        assert x["flag::in_holiday_period"].tolist() == [0.0, 1.0]
