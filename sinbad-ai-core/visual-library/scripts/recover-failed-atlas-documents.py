#!/usr/bin/env python3
"""Retry every failed atlas document directly, without the parent timeout."""

from __future__ import annotations

import argparse
import json
import sqlite3
import subprocess
import sys
import time
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--atlas", type=Path, required=True)
    parser.add_argument("--poppler", type=Path, required=True)
    parser.add_argument("--builder", type=Path, required=True)
    args = parser.parse_args()

    database = args.atlas / "catalog.sqlite"
    connection = sqlite3.connect(database, timeout=300)
    connection.execute("PRAGMA busy_timeout=300000")
    hashes = [
        row[0]
        for row in connection.execute(
            "SELECT document_hash FROM documents WHERE status='failed' "
            "ORDER BY bytes, document_hash"
        )
    ]
    connection.close()

    for index, document_hash in enumerate(hashes, start=1):
        started = time.monotonic()
        print(json.dumps({
            "stage": "recovery-start",
            "index": index,
            "total": len(hashes),
            "documentHash": document_hash,
        }), flush=True)
        command = [
            sys.executable,
            str(args.builder),
            "--stage",
            "process-one",
            "--output",
            str(args.atlas),
            "--poppler",
            str(args.poppler),
            "--document-hash",
            document_hash,
        ]
        completed = subprocess.run(command, text=True, capture_output=True)
        print(
            json.dumps(
                {
                    "stage": "recovery-complete" if completed.returncode == 0 else "recovery-failed",
                    "index": index,
                    "total": len(hashes),
                    "documentHash": document_hash,
                    "returnCode": completed.returncode,
                    "seconds": round(time.monotonic() - started, 2),
                    "stdout": completed.stdout[-500:],
                    "stderr": completed.stderr[-1200:],
                },
                ensure_ascii=False,
            ),
            flush=True,
        )


if __name__ == "__main__":
    main()
