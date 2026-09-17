"""
Load the pipeline's crash data into PostgreSQL + PostGIS.

    migrations → snapshot check → COPY into staging → insert with geometry
               → reconcile against the CSV → ANALYZE

- Connection settings come from the repo-root `.env` (see `.env.example`);
  nothing is hard-coded.
- Migrations in `database/migrations/` are applied in name order, once each,
  and recorded in `schema_migrations`.
- A snapshot is identified by its content fingerprint (see validate_data.py),
  so loading the same data twice is a no-op, and a reordered re-export of the
  same crashes is recognised as the same snapshot.
- The whole load is one transaction: a failed reconciliation leaves the
  database exactly as it was.

Run from data-pipeline/ (with the database running: `docker compose up -d db`):
    python src/load_database.py
    python src/load_database.py --replace   # reload a snapshot already present
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import time
from pathlib import Path

import pandas as pd
import psycopg
from dotenv import load_dotenv

from download_data import MANIFEST_PATH
from feature_engineering import FEATURES_PATH

REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = REPO_ROOT / "database" / "migrations"
RUN_RECORD = FEATURES_PATH.parent / "pipeline_run.json"

# CAS names that do not snake_case cleanly, or are renamed on purpose.
RENAMES = {
    "X": "x_nztm",
    "Y": "y_nztm",
    "OBJECTID": "source_object_id",
    "crashSHDescription": "crash_sh_description",
    "NumberOfLanes": "number_of_lanes",
    "areaUnitID": "area_unit_id",
    "tlaId": "tla_id",
    "meshblockId": "meshblock_id",
}

COPY_CHUNK_ROWS = 50_000


def snake_case(name: str) -> str:
    return RENAMES.get(name) or re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def connect() -> psycopg.Connection:
    load_dotenv(REPO_ROOT / ".env")
    missing = [
        key for key in ("POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD")
        if not os.environ.get(key)
    ]
    if missing:
        sys.exit(f"Missing {', '.join(missing)}. Copy .env.example to .env and fill it in.")

    return psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5434")),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        connect_timeout=10,
    )


def apply_migrations(conn: psycopg.Connection) -> None:
    conn.execute(
        """CREATE TABLE IF NOT EXISTS schema_migrations (
               name       text PRIMARY KEY,
               applied_at timestamptz NOT NULL DEFAULT now()
           )"""
    )
    applied = {row[0] for row in conn.execute("SELECT name FROM schema_migrations")}

    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        if path.name in applied:
            continue
        print(f"  applying {path.name}")
        with conn.transaction():
            conn.execute(path.read_text(encoding="utf-8"))
            conn.execute("INSERT INTO schema_migrations (name) VALUES (%s)", (path.name,))


def table_columns(conn: psycopg.Connection, table: str) -> dict[str, str]:
    rows = conn.execute(
        """SELECT column_name, data_type FROM information_schema.columns
           WHERE table_name = %s ORDER BY ordinal_position""",
        (table,),
    )
    return dict(rows.fetchall())


def read_features(db_columns: dict[str, str]) -> pd.DataFrame:
    df = pd.read_csv(FEATURES_PATH, low_memory=False)
    df = df.rename(columns={c: snake_case(c) for c in df.columns})

    loadable = [c for c in db_columns if c not in {"crash_id", "snapshot_id", "geom"}]
    unexpected = sorted(set(df.columns) - set(loadable))
    absent = sorted(set(loadable) - set(df.columns))
    if unexpected or absent:
        sys.exit(
            "CSV and schema disagree. "
            f"In CSV only: {unexpected or '-'}. In schema only: {absent or '-'}. "
            "Add a migration before loading."
        )

    # Integer columns with blanks arrive as floats; write them as whole numbers.
    for column in loadable:
        if db_columns[column] in {"smallint", "integer", "bigint"}:
            df[column] = df[column].astype("Int64")
    return df[loadable]


def copy_frame(conn: psycopg.Connection, df: pd.DataFrame, table: str) -> None:
    columns = ", ".join(df.columns)
    with conn.cursor().copy(
        f"COPY {table} ({columns}) FROM STDIN WITH (FORMAT csv, NULL '')"
    ) as copy:
        for start in range(0, len(df), COPY_CHUNK_ROWS):
            buffer = io.StringIO()
            df.iloc[start:start + COPY_CHUNK_ROWS].to_csv(buffer, index=False, header=False)
            copy.write(buffer.getvalue())


def reconcile(conn: psycopg.Connection, snapshot_id: int, df: pd.DataFrame) -> None:
    """Compare database aggregates with the same aggregates from the CSV."""
    sql = conn.execute(
        """SELECT count(*),
                  count(*) FILTER (WHERE crash_severity = 'Serious Crash'),
                  count(*) FILTER (WHERE crash_severity = 'Fatal Crash'),
                  coalesce(sum(fatal_count), 0),
                  coalesce(sum(serious_injury_count + minor_injury_count), 0),
                  count(*) FILTER (WHERE geom IS NULL),
                  count(*) FILTER (WHERE tla_name IS NULL),
                  count(DISTINCT source_object_id)
           FROM crashes WHERE snapshot_id = %s""",
        (snapshot_id,),
    ).fetchone()

    injured = (df["serious_injury_count"] + df["minor_injury_count"]).sum()
    expected = (
        len(df),
        int((df["crash_severity"] == "Serious Crash").sum()),
        int((df["crash_severity"] == "Fatal Crash").sum()),
        int(df["fatal_count"].sum()),
        int(injured),
        int((~df["location_valid"]).sum()),
        int(df["tla_name"].isna().sum()),
        len(df),
    )
    labels = [
        "crashes", "serious", "fatal", "killed", "injured",
        "without geometry", "without area", "distinct source ids",
    ]
    mismatches = [
        f"{label}: database {got:,} vs CSV {want:,}"
        for label, got, want in zip(labels, sql, expected)
        if int(got) != int(want)
    ]
    for label, got in zip(labels, sql):
        print(f"    {label:20} {int(got):>9,}")
    if mismatches:
        raise RuntimeError("Reconciliation failed: " + "; ".join(mismatches))


def main() -> None:
    parser = argparse.ArgumentParser(description="Load crash data into PostGIS.")
    parser.add_argument("--replace", action="store_true", help="reload a snapshot already present")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    run = json.loads(RUN_RECORD.read_text(encoding="utf-8"))
    fingerprint = run["snapshot"]["contentFingerprint"]
    if run["snapshot"]["sha256"] != manifest["sha256"]:
        sys.exit("pipeline_run.json is from a different download. Run run_pipeline.py first.")

    started = time.perf_counter()
    with connect() as conn:
        print("== migrations")
        apply_migrations(conn)
        conn.commit()

        existing = conn.execute(
            "SELECT snapshot_id FROM snapshots WHERE content_fingerprint = %s", (fingerprint,)
        ).fetchone()
        if existing and not args.replace:
            print(f"Snapshot {fingerprint} is already loaded (id {existing[0]}). Nothing to do.")
            return

        db_columns = table_columns(conn, "crashes")
        print("== reading features CSV")
        df = read_features(db_columns)
        print(f"   {len(df):,} rows, {len(df.columns)} columns")

        with conn.transaction():
            if existing:
                conn.execute("DELETE FROM snapshots WHERE snapshot_id = %s", (existing[0],))

            snapshot_id = conn.execute(
                """INSERT INTO snapshots
                       (sha256, content_fingerprint, source_last_modified, retrieved_at, row_count)
                   VALUES (%s, %s, %s, %s, %s) RETURNING snapshot_id""",
                (
                    manifest["sha256"], fingerprint, manifest["sourceLastModified"],
                    manifest["retrievedAt"], manifest["rows"],
                ),
            ).fetchone()[0]

            print("== COPY into staging")
            columns = ", ".join(df.columns)
            conn.execute(
                f"CREATE TEMP TABLE staging ON COMMIT DROP AS "
                f"SELECT {columns} FROM crashes WITH NO DATA"
            )
            copy_frame(conn, df, "staging")

            print("== insert with geometry")
            conn.execute(
                f"""INSERT INTO crashes (snapshot_id, geom, {columns})
                    SELECT %s,
                           CASE WHEN location_valid
                                THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
                           END,
                           {columns}
                    FROM staging""",
                (snapshot_id,),
            )

            print("== reconcile")
            reconcile(conn, snapshot_id, df)

        conn.execute("ANALYZE crashes")
        conn.commit()

    print(f"\nLoaded snapshot {fingerprint} as id {snapshot_id} "
          f"in {time.perf_counter() - started:.0f}s")


if __name__ == "__main__":
    main()
