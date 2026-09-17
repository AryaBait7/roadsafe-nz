"""
Download the NZTA Crash Analysis System (CAS) dataset and pin the snapshot.

The source is Waka Kotahi's public open data portal (ArcGIS Hub item
8d684f1841fa4dbea6afaefc8a1ba0fc, "Crash Analysis System (CAS) data").
No credentials are involved.

CAS is updated in place, so "the CAS dataset" is not a fixed thing: the same
URL returned 705,609 rows in early September 2026 and 707,449 a week later.
Every download therefore writes `data/raw/manifest.json` with the retrieval
time, byte size, row count and SHA-256. Later pipeline steps record which
snapshot they were built from, and `--verify` checks a local file against
its manifest without downloading anything.

Run from data-pipeline/:
    python src/download_data.py            # download (skips if already present)
    python src/download_data.py --force    # replace the local snapshot
    python src/download_data.py --verify   # check the local file only
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

ITEM_ID = "8d684f1841fa4dbea6afaefc8a1ba0fc"
PORTAL = "https://opendata-nzta.opendata.arcgis.com"
DOWNLOAD_URL = f"{PORTAL}/api/download/v1/items/{ITEM_ID}/csv?layers=0"
DATASET_PAGE = f"{PORTAL}/datasets/NZTA::crash-analysis-system-cas-data-1/"

RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
RAW_PATH = RAW_DIR / "cas_crash_data.csv"
MANIFEST_PATH = RAW_DIR / "manifest.json"

CHUNK = 1 << 20  # 1 MiB


def file_stats(path: Path) -> tuple[str, int, int]:
    """SHA-256, size in bytes, and data rows (lines minus the header)."""
    digest = hashlib.sha256()
    size = 0
    lines = 0
    with path.open("rb") as handle:
        while chunk := handle.read(CHUNK):
            digest.update(chunk)
            size += len(chunk)
            lines += chunk.count(b"\n")
    return digest.hexdigest(), size, lines - 1


def download() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    partial = RAW_PATH.with_suffix(".csv.part")

    print(f"Downloading CAS data from {PORTAL} ...")
    with requests.get(DOWNLOAD_URL, stream=True, timeout=(30, 300)) as response:
        response.raise_for_status()
        last_modified = response.headers.get("Last-Modified")
        received = 0
        with partial.open("wb") as handle:
            for chunk in response.iter_content(CHUNK):
                handle.write(chunk)
                received += len(chunk)
                if received % (25 * CHUNK) < CHUNK:
                    print(f"  {received / 1e6:,.0f} MB", flush=True)

    # Only replace the real file once the transfer finished, so an
    # interrupted download never leaves a truncated CSV behind.
    partial.replace(RAW_PATH)

    sha256, size, rows = file_stats(RAW_PATH)
    manifest = {
        "source": "Waka Kotahi NZ Transport Agency, Crash Analysis System (CAS)",
        "datasetPage": DATASET_PAGE,
        "itemId": ITEM_ID,
        "downloadUrl": DOWNLOAD_URL,
        "sourceLastModified": last_modified,
        "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "file": RAW_PATH.name,
        "bytes": size,
        "rows": rows,
        "sha256": sha256,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {RAW_PATH.name}: {size / 1e6:,.1f} MB, {rows:,} rows")
    print(f"sha256 {sha256}")


def verify() -> bool:
    if not RAW_PATH.exists() or not MANIFEST_PATH.exists():
        print("No local snapshot. Run: python src/download_data.py")
        return False

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    sha256, size, rows = file_stats(RAW_PATH)
    ok = (sha256, size, rows) == (manifest["sha256"], manifest["bytes"], manifest["rows"])
    status = "matches" if ok else "DOES NOT MATCH"
    print(f"{RAW_PATH.name} {status} the manifest from {manifest['retrievedAt']} ({rows:,} rows)")
    return ok


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--force", action="store_true", help="replace an existing snapshot")
    parser.add_argument("--verify", action="store_true", help="check the local file only")
    args = parser.parse_args()

    if args.verify:
        sys.exit(0 if verify() else 1)

    if RAW_PATH.exists() and MANIFEST_PATH.exists() and not args.force:
        print("Snapshot already present; use --force to replace it.")
        sys.exit(0 if verify() else 1)

    download()


if __name__ == "__main__":
    main()
