#!/usr/bin/env python3
import argparse
import json
import sqlite3
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--atlas", required=True)
    parser.add_argument("--summary", action="store_true")
    args = parser.parse_args()
    database = Path(args.atlas) / "catalog.sqlite"
    # Diagnostics are read-only.  Opening with SQLite's default read/write
    # mode fails under a read-only ACL even though every query below is a
    # SELECT; URI read-only mode also prevents accidental catalogue mutation.
    connection = sqlite3.connect(
        f"file:{database.as_posix()}?mode=ro&immutable=1", uri=True
    )
    connection.row_factory = sqlite3.Row
    if args.summary:
        result = {
            "statuses": dict(connection.execute(
                "SELECT status, COUNT(1) FROM documents GROUP BY status"
            )),
            "pages": connection.execute(
                "SELECT COALESCE(SUM(page_count), 0) FROM documents"
            ).fetchone()[0],
            "pagePlates": connection.execute(
                "SELECT COUNT(1) FROM page_plates"
            ).fetchone()[0],
            "embeddedReady": connection.execute(
                "SELECT COUNT(1) FROM embedded_visuals WHERE status='ready'"
            ).fetchone()[0],
        }
        tables = {row[0] for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        result["visualRegions"] = (
            connection.execute("SELECT COUNT(1) FROM visual_regions").fetchone()[0]
            if "visual_regions" in tables else 0
        )
        result["failureKinds"] = dict(connection.execute(
            "SELECT CASE "
            "WHEN error LIKE 'ISOLATED_WORKER_TIMEOUT:%' THEN 'timeout' "
            "WHEN error LIKE '%PermissionError:%' THEN 'permission' "
            "WHEN error LIKE '%database is locked%' THEN 'database_locked' "
            "ELSE 'other' END, COUNT(1) FROM documents "
            "WHERE status='failed' GROUP BY 1"
        ))
        result["processing"] = [dict(row) for row in connection.execute(
            "SELECT d.document_hash, d.page_count, "
            "(SELECT COUNT(1) FROM page_plates p WHERE p.document_hash=d.document_hash) "
            "AS processed_pages, "
            "(SELECT COUNT(1) FROM embedded_visuals e WHERE e.document_hash=d.document_hash "
            "AND e.status='ready') AS embedded_ready, "
            "(SELECT COUNT(1) FROM embedded_visuals e WHERE e.document_hash=d.document_hash "
            "AND e.status='ready' AND e.page_number=(SELECT MAX(p.page_number) "
            "FROM page_plates p WHERE p.document_hash=d.document_hash)) "
            "AS latest_page_embedded, l.path FROM documents d "
            "JOIN locations l ON l.document_hash=d.document_hash "
            "WHERE d.status='processing' AND l.rowid=(SELECT MIN(x.rowid) "
            "FROM locations x WHERE x.document_hash=d.document_hash)"
        )]
        print(json.dumps(result, ensure_ascii=False))
        return
    rows = connection.execute(
        "SELECT d.document_hash, l.path AS source_path, d.page_count, "
        "d.encrypted, d.error FROM documents d JOIN locations l "
        "ON l.document_hash = d.document_hash WHERE d.status = 'failed' "
        "AND l.rowid = (SELECT MIN(x.rowid) FROM locations x "
        "WHERE x.document_hash = d.document_hash) ORDER BY l.path"
    ).fetchall()
    print(json.dumps([dict(row) for row in rows], ensure_ascii=False))


if __name__ == "__main__":
    main()
