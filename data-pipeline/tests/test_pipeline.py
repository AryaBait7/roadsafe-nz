"""
Unit tests for the cleaning, feature and validation rules.

Small hand-built frames, so they run in well under a second and need no
download. The full-data checks live in validate_data.py and run inside the
pipeline itself.
"""

import numpy as np
import pandas as pd
import pytest

import clean_data as cd
import feature_engineering as fe
import validate_data as vd


def raw_frame(rows: int = 3) -> pd.DataFrame:
    """A minimal raw-shaped frame covering every column the cleaner touches."""
    df = pd.DataFrame(
        {
            "OBJECTID": range(1, rows + 1),
            "X": [1_757_000.0] * rows,
            "Y": [5_920_000.0] * rows,
            "crashSeverity": ["Fatal Crash", "Minor Crash", "Serious Crash"][:rows],
            "crashYear": [2020] * rows,
            "advisorySpeed": [np.nan] * rows,
            "pedestrian": [np.nan, 2, np.nan][:rows],
        }
    )
    for column in cd.NULL_STRING_COLUMNS:
        df[column] = ["Null", "Fine", "Null"][:rows]
    for column in cd.EMPTY_COLUMNS:
        df[column] = np.nan
    for column in cd.OBJECT_COLUMNS:
        # Row 1: no object involved (whole block blank). Rows 2–3: filled.
        df[column] = [np.nan, 0, 1][:rows]
    return df


class TestClean:
    def test_null_strings_become_missing(self):
        out = cd.fix_null_strings(raw_frame())
        assert out["weatherA"].isna().tolist() == [True, False, True]

    def test_object_block_blank_means_none_struck(self):
        out = cd.resolve_object_block(raw_frame())
        assert out["object_involved"].tolist() == [False, True, True]
        assert out["tree"].tolist() == [0, 0, 1]
        assert out[cd.OBJECT_COLUMNS].notna().all().all()

    def test_partially_filled_object_block_stops_the_pipeline(self):
        df = raw_frame()
        df.loc[0, "tree"] = 1  # one column filled on an otherwise blank row
        with pytest.raises(ValueError, match="partially filled"):
            cd.resolve_object_block(df)

    def test_blank_pedestrian_is_zero(self):
        assert cd.fill_pedestrian(raw_frame())["pedestrian"].tolist() == [0, 2, 0]

    def test_explicit_zero_pedestrians_stop_the_pipeline(self):
        df = raw_frame()
        df.loc[0, "pedestrian"] = 0
        with pytest.raises(ValueError, match="explicit zeros"):
            cd.fill_pedestrian(df)

    def test_empty_columns_are_dropped_only_while_empty(self):
        out = cd.drop_unusable_columns(raw_frame())
        assert not {"advisorySpeed", *cd.EMPTY_COLUMNS} & set(out.columns)

        df = raw_frame()
        df.loc[0, "intersection"] = 1.0
        with pytest.raises(ValueError, match="now contain data"):
            cd.drop_unusable_columns(df)

    def test_reprojection_lands_in_new_zealand(self):
        out = cd.reproject_coordinates(raw_frame(1))
        assert -38 < out.loc[0, "latitude"] < -36  # Auckland/Waikato latitude
        assert 174 < out.loc[0, "longitude"] < 176

    def test_placeholder_and_offshore_locations_are_flagged(self):
        df = pd.DataFrame(
            {
                "latitude": [-36.85, -47.5, -43.95, 10.0],
                "longitude": [174.76, 179.0, -176.56, 20.0],
            }
        )
        out = cd.flag_invalid_locations(df)
        # Auckland and the Chatham Islands are real; the placeholder and a
        # point outside New Zealand are not.
        assert out["location_valid"].tolist() == [True, False, True, False]
        assert out.loc[[1, 3], ["latitude", "longitude"]].isna().all().all()
        assert out.loc[2, "longitude"] == -176.56

    def test_target(self):
        out = cd.add_target(raw_frame())
        assert out["is_severe"].tolist() == [True, False, True]

    def test_full_clean_passes_validation(self):
        out = cd.clean(raw_frame())
        report = vd.validate_clean(out, expected_rows=3)
        assert report.failures == []


class TestFeatures:
    def test_speed_bins_and_hazard_score(self):
        df = pd.DataFrame(
            {
                "speedLimit": [30, 50, 51, 100, 110, np.nan],
                "weatherA": ["Heavy rain", "Fine", "Fine", "Fine", "Fine", "Fine"],
                "weatherB": [np.nan, "Frost", np.nan, np.nan, np.nan, np.nan],
                "roadSurface": ["Unsealed", "Sealed", "End of seal", "Sealed", "Sealed", "Sealed"],
                "flatHill": ["Hill Road", "Flat", "Flat", "Flat", "Flat", "Flat"],
                "light": ["Dark", "Bright sun", "Twilight", "Overcast", "Dark", "Dark"],
                "trafficControl": ["Nil", "Stop", "Nil", "Nil", "Give way", "Nil"],
                **{c: [1, 0, 0, 2, 0, np.nan] for c in fe.VEHICLE_TYPE_COLUMNS},
            }
        )
        out = fe.engineer_features(df)
        bands = [b if isinstance(b, str) else None for b in out["speed_limit_binned"]]
        assert bands == [
            "low_<=50", "low_<=50", "medium_51-80", "high_81-100", "very_high_>100", None,
        ]
        # Row 0 trips all five hazard flags.
        assert out.loc[0, "road_hazard_score"] == 5
        assert out["total_vehicles_involved"].tolist() == [12, 0, 0, 24, 0, 0]


class TestFingerprint:
    def test_ignores_row_order_and_objectid(self):
        df = raw_frame()
        shuffled = df.iloc[[2, 0, 1]].reset_index(drop=True)
        shuffled["OBJECTID"] = [10, 11, 12]  # renumbered, as NZTA exports do
        assert vd.fingerprint(df) == vd.fingerprint(shuffled)

    def test_changes_when_a_value_changes(self):
        df = raw_frame()
        changed = df.copy()
        changed.loc[1, "crashSeverity"] = "Fatal Crash"
        assert vd.fingerprint(df) != vd.fingerprint(changed)
