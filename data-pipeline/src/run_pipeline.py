"""
Run the whole data pipeline, raw download to frontend fixtures.

    download → validate raw → clean → validate → features → validate
             → frontend fixtures → data dictionary → adjusted associations
             → run record

Each step is the same function the individual scripts run, so the
standalone scripts stay useful for debugging one step. The run ends by
writing `data/processed/pipeline_run.json`, which records which snapshot
(SHA-256 and content fingerprint) produced the published figures.

Run from data-pipeline/:
    python src/run_pipeline.py                 # reuse the pinned snapshot
    python src/run_pipeline.py --refresh       # download the latest first
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone

import analyze_associations
import clean_data
import download_data
import feature_engineering
import generate_data_dictionary
import generate_frontend_fixtures
import validate_data

RUN_RECORD = clean_data.PROCESSED_PATH.parent / "pipeline_run.json"


class Timer:
    def __init__(self) -> None:
        self.steps: dict[str, float] = {}

    def step(self, name: str):
        timer = self

        class _Step:
            def __enter__(self):
                print(f"\n== {name}")
                self.start = time.perf_counter()

            def __exit__(self, *exc):
                timer.steps[name] = round(time.perf_counter() - self.start, 1)
                print(f"   ({timer.steps[name]}s)")

        return _Step()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the RoadSafe NZ data pipeline.")
    parser.add_argument("--refresh", action="store_true", help="download the latest CAS export first")
    parser.add_argument(
        "--train",
        action="store_true",
        help="also retrain the severity model (several minutes)",
    )
    args = parser.parse_args()
    timer = Timer()

    with timer.step("snapshot"):
        if args.refresh or not download_data.RAW_PATH.exists():
            download_data.download()
        elif not download_data.verify():
            sys.exit("Local snapshot does not match its manifest. Re-run with --refresh.")
        manifest = json.loads(download_data.MANIFEST_PATH.read_text(encoding="utf-8"))
        rows = manifest["rows"]

    with timer.step("load + validate raw"):
        raw = clean_data.load_raw()
        validate_data.validate_raw(raw, rows).raise_if_failed()
        content = validate_data.fingerprint(raw)
        print(f"   content fingerprint {content}")

    with timer.step("clean + validate"):
        clean = clean_data.clean(raw)
        validate_data.validate_clean(clean, rows).raise_if_failed()
        clean.to_csv(clean_data.PROCESSED_PATH, index=False)
        # Counted now: engineer_features adds its columns to this same frame.
        clean_columns = len(clean.columns)

    with timer.step("features + validate"):
        # Engineered from the in-memory frame rather than re-reading the CSV,
        # so both files come from exactly the same rows.
        features = feature_engineering.engineer_features(clean)
        validate_data.validate_features(features, rows).raise_if_failed()
        features.to_csv(feature_engineering.FEATURES_PATH, index=False)

    with timer.step("frontend fixtures"):
        generate_frontend_fixtures.main()

    with timer.step("data dictionary"):
        generate_data_dictionary.main()

    with timer.step("adjusted associations"):
        analyze_associations.main()

    # Off by default: training takes minutes, and the data it consumes has
    # not changed unless a refresh brought in new crashes.
    if args.train:
        with timer.step("train severity model"):
            import train_model

            train_model.main()

        with timer.step("explain severity model"):
            import explain_model

            explain_model.main()

    record = {
        "completedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "snapshot": {
            "retrievedAt": manifest["retrievedAt"],
            "sourceLastModified": manifest["sourceLastModified"],
            "sha256": manifest["sha256"],
            "contentFingerprint": content,
            "rows": rows,
        },
        "outputs": {
            "cleanColumns": clean_columns,
            "featureColumns": len(features.columns),
            "severeRate": round(float(clean["is_severe"].mean()), 6),
            "objectInvolvedRate": round(float(clean["object_involved"].mean()), 6),
        },
        "stepSeconds": timer.steps,
    }
    RUN_RECORD.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(f"\nPipeline complete. Run record: {RUN_RECORD.name}")


if __name__ == "__main__":
    main()
