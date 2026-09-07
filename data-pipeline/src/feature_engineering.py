"""
Feature engineering on the cleaned CAS dataset, preparing it for a
scikit-learn classifier predicting `is_severe`.

Run from data-pipeline/ (after clean_data.py has produced the cleaned CSV):
    python src/feature_engineering.py
"""

from pathlib import Path

import pandas as pd

CLEAN_PATH = Path(__file__).resolve().parent.parent / "data" / "processed" / "cas_crash_data_clean.csv"
FEATURES_PATH = Path(__file__).resolve().parent.parent / "data" / "processed" / "cas_crash_data_features.csv"

# The 12 columns that count how many of each vehicle type were involved.
# Excludes the generic `vehicle` column (only populated for ~43% of rows,
# looks like a legacy/duplicate field from an older CAS schema) and `train`
# (grouped with roadside-object columns like `fence`/`ditch` in this
# dataset, not with the vehicle-type columns).
VEHICLE_TYPE_COLUMNS = [
    "bicycle", "bus", "carStationWagon", "moped", "motorcycle",
    "otherVehicleType", "schoolBus", "suv", "taxi", "truck",
    "unknownVehicleType", "vanOrUtility",
]

# weatherA conditions that count as adverse (excludes "Fine")
ADVERSE_WEATHER_A = {"Heavy rain", "Light rain", "Mist or Fog", "Snow", "Hail or Sleet"}

# light conditions with reduced visibility
LOW_LIGHT_CONDITIONS = {"Dark", "Twilight"}

SPEED_BINS = [0, 50, 80, 100, float("inf")]
SPEED_LABELS = ["low_<=50", "medium_51-80", "high_81-100", "very_high_>100"]


def load_clean(path: Path = CLEAN_PATH) -> pd.DataFrame:
    return pd.read_csv(path)


def add_total_vehicles(df: pd.DataFrame) -> pd.DataFrame:
    df["total_vehicles_involved"] = df[VEHICLE_TYPE_COLUMNS].fillna(0).sum(axis=1).astype(int)
    return df


def add_adverse_weather_flag(df: pd.DataFrame) -> pd.DataFrame:
    weather_a_bad = df["weatherA"].isin(ADVERSE_WEATHER_A)
    weather_b_present = df["weatherB"].notna()  # weatherB is only ever Frost/Strong wind/NaN
    df["adverse_weather"] = weather_a_bad | weather_b_present
    return df


def add_road_condition_flags(df: pd.DataFrame) -> pd.DataFrame:
    df["is_unsealed_road"] = df["roadSurface"].isin(["Unsealed", "End of seal"])
    df["is_hill_road"] = df["flatHill"] == "Hill Road"
    df["is_low_light"] = df["light"].isin(LOW_LIGHT_CONDITIONS)
    df["is_uncontrolled_intersection"] = df["trafficControl"] == "Nil"
    return df


def add_road_hazard_score(df: pd.DataFrame) -> pd.DataFrame:
    hazard_flags = [
        "adverse_weather", "is_unsealed_road", "is_hill_road",
        "is_low_light", "is_uncontrolled_intersection",
    ]
    df["road_hazard_score"] = df[hazard_flags].sum(axis=1).astype(int)
    return df


def add_speed_limit_bins(df: pd.DataFrame) -> pd.DataFrame:
    df["speed_limit_binned"] = pd.cut(
        df["speedLimit"], bins=SPEED_BINS, labels=SPEED_LABELS, right=True
    )
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = add_total_vehicles(df)
    df = add_adverse_weather_flag(df)
    df = add_road_condition_flags(df)
    df = add_road_hazard_score(df)
    df = add_speed_limit_bins(df)
    return df


def main() -> None:
    df = load_clean()
    print(f"Loaded cleaned data: {df.shape}")

    df = engineer_features(df)

    new_cols = [
        "total_vehicles_involved", "adverse_weather", "is_unsealed_road",
        "is_hill_road", "is_low_light", "is_uncontrolled_intersection",
        "road_hazard_score", "speed_limit_binned",
    ]
    print("\nNew feature summary:")
    print(df[new_cols].describe(include="all"))

    print("\nMean is_severe rate by road_hazard_score:")
    print(df.groupby("road_hazard_score")["is_severe"].mean())

    FEATURES_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(FEATURES_PATH, index=False)
    print(f"\nSaved feature-engineered data to {FEATURES_PATH}")


if __name__ == "__main__":
    main()
