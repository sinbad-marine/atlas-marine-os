"""Extract vector-diagram and table regions from every page in the SINBAD PDF atlas."""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import pymupdf
from PIL import Image

REGION_SCHEMA = "sinbad-visual-regions/5"


class SparseRegionError(RuntimeError):
    pass


def sha_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def connect(atlas: Path) -> sqlite3.Connection:
    db = sqlite3.connect(atlas / "catalog.sqlite", timeout=60)
    db.execute("pragma busy_timeout=300000")
    db.row_factory = sqlite3.Row
    db.execute("pragma journal_mode=WAL")
    db.executescript("""
      create table if not exists region_scans(
        document_hash text not null,page_number integer not null,status text not null,
        error text,processed_at text not null default(datetime('now')),
        primary key(document_hash,page_number)
      );
      create table if not exists visual_regions(
        document_hash text not null,page_number integer not null,region_number integer not null,
        kind text not null,bbox_json text not null,asset_hash text,file text,width integer,height integer,
        heading text,context text,topics text,status text not null,error text,
        primary key(document_hash,page_number,region_number)
      );
      create index if not exists visual_region_asset on visual_regions(asset_hash);
    """)
    current = db.execute("select value from meta where key='region_schema_version'").fetchone()
    if not current or current[0] != REGION_SCHEMA:
        db.execute("delete from visual_regions")
        db.execute("delete from region_scans")
        db.execute("insert or replace into meta values('region_schema_version',?)", (REGION_SCHEMA,))
    db.commit()
    return db


def overlap_ratio(first: pymupdf.Rect, second: pymupdf.Rect) -> float:
    intersection = first & second
    if intersection.is_empty:
        return 0.0
    return intersection.get_area() / min(first.get_area(), second.get_area())


def padded(rect: pymupdf.Rect, page_rect: pymupdf.Rect, padding: float = 10) -> pymupdf.Rect:
    return pymupdf.Rect(rect.x0 - padding, rect.y0 - padding, rect.x1 + padding, rect.y1 + padding) & page_rect


def regions(page: pymupdf.Page) -> list[tuple[str, pymupdf.Rect]]:
    page_rect = page.rect
    page_area = page_rect.get_area()
    candidates: list[tuple[str, pymupdf.Rect]] = []
    try:
        for table in page.find_tables().tables:
            rect = padded(pymupdf.Rect(table.bbox), page_rect)
            if rect.width >= 40 and rect.height >= 25 and rect.get_area() >= page_area * 0.003:
                candidates.append(("table", rect))
    except Exception:
        pass
    try:
        drawings = page.get_drawings()
        for raw in page.cluster_drawings(drawings=drawings, x_tolerance=6, y_tolerance=6):
            rect = padded(pymupdf.Rect(raw), page_rect)
            area = rect.get_area()
            if rect.width < 40 or rect.height < 40 or area < page_area * 0.005:
                continue
            if area > page_area * 0.985:
                continue
            aspect = max(rect.width / rect.height, rect.height / rect.width)
            if aspect > 15:
                continue
            members = [drawing for drawing in drawings if not (pymupdf.Rect(drawing["rect"]) & rect).is_empty]
            drawing_items = sum(len(drawing.get("items", ())) for drawing in members)
            text_chars = len((page.get_text("text", clip=rect) or "").strip())
            if drawing_items <= 4 and text_chars > 200:
                continue
            if text_chars > 300 and text_chars / max(drawing_items, 1) > 60:
                continue
            candidates.append(("vector", rect))
    except Exception:
        pass
    selected: list[tuple[str, pymupdf.Rect]] = []
    for kind, rect in sorted(candidates, key=lambda item: (item[0] != "table", -item[1].get_area())):
        duplicate = next((index for index, (_, prior) in enumerate(selected) if overlap_ratio(rect, prior) >= 0.82), None)
        if duplicate is None:
            selected.append((kind, rect))
        elif kind == "table" and selected[duplicate][0] != "table":
            selected[duplicate] = (kind, rect)
    return selected


def store_clip(page: pymupdf.Page, rect: pymupdf.Rect, atlas: Path) -> tuple[str, str, int, int]:
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(240 / 72, 240 / 72), clip=rect, alpha=False)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False, dir=atlas / "tmp") as temp:
        png = Path(temp.name)
    webp = png.with_suffix(".webp")
    try:
        pixmap.save(str(png))
        with Image.open(png) as image:
            probe = image.convert("L")
            probe.thumbnail((512, 512))
            histogram = probe.histogram()
            pixels = max(1, probe.width * probe.height)
            ink_ratio = sum(histogram[:245]) / pixels
            if ink_ratio < 0.02:
                raise SparseRegionError(f"SPARSE_REGION:{ink_ratio:.6f}")
            image.save(webp, "WEBP", quality=92, method=4, exact=True)
            width, height = image.size
        digest = sha_file(webp)
        relative = Path("assets") / "regions" / digest[:2] / f"{digest}.webp"
        target = atlas / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            webp.replace(target)
        return digest, relative.as_posix(), width, height
    finally:
        png.unlink(missing_ok=True)
        webp.unlink(missing_ok=True)


def scan_document(db: sqlite3.Connection, atlas: Path, digest: str, source: Path) -> None:
    document = pymupdf.open(str(source))
    for page_index in range(document.page_count):
        page_number = page_index + 1
        done = db.execute(
            "select status from region_scans where document_hash=? and page_number=?",
            (digest, page_number),
        ).fetchone()
        if done and done[0] == "complete":
            continue
        page = document.load_page(page_index)
        page_context = db.execute(
            "select heading,context,topics from page_plates where document_hash=? and page_number=?",
            (digest, page_number),
        ).fetchone()
        try:
            found = regions(page)
            db.execute("delete from visual_regions where document_hash=? and page_number=?", (digest, page_number))
            # Rendering a dense vector page may take minutes. Release the WAL
            # writer lock before doing that CPU-bound work.
            db.commit()
            for number, (kind, rect) in enumerate(found, start=1):
                try:
                    asset_hash, file, width, height = store_clip(page, rect, atlas)
                    db.execute(
                        "insert into visual_regions values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (
                            digest, page_number, number, kind,
                            json.dumps([round(value, 3) for value in rect], separators=(",", ":")),
                            asset_hash, file, width, height,
                            page_context["heading"] if page_context else None,
                            page_context["context"] if page_context else "",
                            page_context["topics"] if page_context else "[]",
                            "ready", None,
                        ),
                    )
                    db.commit()
                except SparseRegionError:
                    continue
                except Exception as exc:
                    db.execute(
                        "insert into visual_regions values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (digest, page_number, number, kind, json.dumps(list(rect)), None, None, None, None,
                         page_context["heading"] if page_context else None,
                         page_context["context"] if page_context else "",
                         page_context["topics"] if page_context else "[]", "page-fallback", str(exc)[:1000]),
                    )
                    db.commit()
            db.execute(
                "insert or replace into region_scans values(?,?,?,null,datetime('now'))",
                (digest, page_number, "complete"),
            )
            db.commit()
        except Exception as exc:
            db.execute(
                "insert or replace into region_scans values(?,?,?,?,datetime('now'))",
                (digest, page_number, "failed", str(exc)[:2000]),
            )
            db.commit()
    document.close()


def mark_document_failure(db: sqlite3.Connection, digest: str, error: str) -> None:
    page_count = db.execute("select page_count from documents where document_hash=?", (digest,)).fetchone()[0] or 0
    for page_number in range(1, page_count + 1):
        current = db.execute(
            "select status from region_scans where document_hash=? and page_number=?", (digest, page_number)
        ).fetchone()
        if current and current[0] == "complete":
            continue
        db.execute(
            "insert or replace into region_scans values(?,?,?,?,datetime('now'))",
            (digest, page_number, "failed", error[:2000]),
        )
    db.commit()


def process(db: sqlite3.Connection, atlas: Path, shard_count: int, shard_index: int, limit: int | None) -> None:
    rows = db.execute(
        """select d.document_hash,l.path from documents d join locations l using(document_hash)
           where d.status='complete'
             and l.rowid=(select min(x.rowid) from locations x where x.document_hash=d.document_hash)
             and exists(select 1 from page_plates p where p.document_hash=d.document_hash)
             and (select count(*) from region_scans r where r.document_hash=d.document_hash and r.status='complete') < d.page_count
           order by d.bytes,d.document_hash"""
    ).fetchall()
    rows = [row for row in rows if int(row["document_hash"][:16], 16) % shard_count == shard_index]
    if limit is not None:
        rows = rows[:limit]
    script = Path(__file__).resolve()
    for index, row in enumerate(rows, start=1):
        started = time.monotonic()
        try:
            page_count = db.execute("select page_count from documents where document_hash=?", (row["document_hash"],)).fetchone()[0] or 1
            timeout = max(120, min(3600, page_count * 8 + 60))
            child = subprocess.run(
                [sys.executable, str(script), "--atlas", str(atlas), "--stage", "process-one", "--document-hash", row["document_hash"]],
                capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout,
            )
            if child.returncode != 0:
                raise RuntimeError(f"REGION_ISOLATED_WORKER_FAILED:{child.returncode}:{child.stderr[-1200:]}")
            print(json.dumps({"stage": "region-complete", "index": index, "total": len(rows), "documentHash": row["document_hash"], "seconds": round(time.monotonic() - started, 2)}), flush=True)
        except subprocess.TimeoutExpired:
            error = f"REGION_ISOLATED_WORKER_TIMEOUT:{timeout}s"
            mark_document_failure(db, row["document_hash"], error)
            print(json.dumps({"stage": "region-failed", "index": index, "total": len(rows), "documentHash": row["document_hash"], "error": error}), flush=True)
        except Exception as exc:
            mark_document_failure(db, row["document_hash"], str(exc))
            print(json.dumps({"stage": "region-failed", "index": index, "total": len(rows), "documentHash": row["document_hash"], "error": str(exc)[:1000]}), flush=True)


def process_one(db: sqlite3.Connection, atlas: Path, document_hash: str) -> None:
    row = db.execute(
        "select path from locations where document_hash=? order by rowid limit 1", (document_hash,)
    ).fetchone()
    if not row:
        raise RuntimeError("DOCUMENT_LOCATION_MISSING")
    scan_document(db, atlas, document_hash, Path(row[0]))
    print(json.dumps({"stage": "region-process-one-complete", "documentHash": document_hash}), flush=True)


def report(db: sqlite3.Connection) -> None:
    result = {
        "eligiblePages": db.execute("select coalesce(sum(page_count),0) from documents where status='complete'").fetchone()[0],
        "scannedPages": db.execute("select count(*) from region_scans where status='complete'").fetchone()[0],
        "failedPages": db.execute("select count(*) from region_scans where status='failed'").fetchone()[0],
        "readyRegions": db.execute("select count(*) from visual_regions where status='ready'").fetchone()[0],
        "regionFallbacks": db.execute("select count(*) from visual_regions where status='page-fallback'").fetchone()[0],
        "kinds": dict(db.execute("select kind,count(*) from visual_regions where status='ready' group by kind")),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--atlas", type=Path, required=True)
    parser.add_argument("--stage", choices=("process", "process-one", "report"), default="process")
    parser.add_argument("--shard-count", type=int, default=1)
    parser.add_argument("--shard-index", type=int, default=0)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--document-hash")
    args = parser.parse_args()
    if args.shard_count < 1 or not 0 <= args.shard_index < args.shard_count:
        raise SystemExit("invalid shard configuration")
    atlas = args.atlas.resolve()
    db = connect(atlas)
    if args.stage == "process":
        process(db, atlas, args.shard_count, args.shard_index, args.limit)
    elif args.stage == "process-one":
        if not args.document_hash:
            raise SystemExit("--document-hash is required for process-one")
        process_one(db, atlas, args.document_hash)
    report(db)


if __name__ == "__main__":
    main()
