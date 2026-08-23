"""Resumable private visual-atlas builder for the complete local SINBAD PDF corpus."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image
from pypdf import PdfReader


SCHEMA = "sinbad-complete-visual-atlas/1"


def sha_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def connect(output: Path) -> sqlite3.Connection:
    output.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(output / "catalog.sqlite", timeout=60)
    # Multiple isolated renderers share one WAL catalog.  A page with many
    # embedded objects can otherwise outlive sqlite3's default busy window.
    db.execute("pragma busy_timeout=300000")
    db.execute("pragma journal_mode=WAL")
    db.execute("pragma synchronous=NORMAL")
    db.executescript("""
      create table if not exists meta(key text primary key,value text not null);
      create table if not exists documents(
        document_hash text primary key,bytes integer not null,page_count integer,
        encrypted integer not null default 0,status text not null default 'pending',
        error text,processed_at text
      );
      create table if not exists locations(
        document_hash text not null,path text not null unique,
        foreign key(document_hash) references documents(document_hash)
      );
      create table if not exists inventory_failures(
        path text primary key,document_hash text,bytes integer,error text not null,
        recorded_at text not null default (datetime('now'))
      );
      create table if not exists page_plates(
        document_hash text not null,page_number integer not null,asset_hash text not null,
        file text not null,width integer not null,height integer not null,
        heading text,context text,topics text not null,
        primary key(document_hash,page_number)
      );
      create table if not exists embedded_visuals(
        document_hash text not null,page_number integer not null,image_number integer not null,
        extraction_hash text,asset_hash text,file text,width integer,height integer,
        media_type text,status text not null,error text,
        primary key(document_hash,page_number,image_number)
      );
      create index if not exists page_topics on page_plates(topics);
      create index if not exists embedded_asset on embedded_visuals(asset_hash);
    """)
    db.execute("insert or replace into meta(key,value) values('schema_version',?)", (SCHEMA,))
    db.commit()
    return db


def inventory(db: sqlite3.Connection, roots: list[Path]) -> None:
    files: dict[str, Path] = {}
    for root in roots:
        for path in root.rglob("*.pdf"):
            files[str(path.resolve()).casefold()] = path.resolve()
    total = len(files)
    for index, path in enumerate(sorted(files.values()), start=1):
        digest = None
        try:
            digest = sha_file(path)
            row = db.execute("select page_count from documents where document_hash=?", (digest,)).fetchone()
            page_count, encrypted = (row[0], 0) if row else (None, 0)
            if page_count is None:
                reader = PdfReader(str(path), strict=False)
                encrypted = int(reader.is_encrypted)
                if encrypted:
                    try:
                        reader.decrypt("")
                    except Exception:
                        pass
                page_count = len(reader.pages)
            db.execute("insert or ignore into documents(document_hash,bytes,page_count,encrypted) values(?,?,?,?)", (digest, path.stat().st_size, page_count, encrypted))
            db.execute("insert or ignore into locations(document_hash,path) values(?,?)", (digest, str(path)))
            db.commit()
            print(json.dumps({"stage":"inventory","index":index,"total":total,"pages":page_count,"path":str(path)}, ensure_ascii=False), flush=True)
        except Exception as exc:
            digest_value = digest
            try:
                size_value = path.stat().st_size
            except Exception:
                size_value = None
            db.execute("insert or replace into inventory_failures(path,document_hash,bytes,error) values(?,?,?,?)", (str(path), digest_value, size_value, str(exc)[:2000]))
            db.commit()
            print(json.dumps({"stage":"inventory-error","index":index,"total":total,"path":str(path),"error":str(exc)[:500]}, ensure_ascii=False), flush=True)


def context(text: str) -> tuple[str | None, str, str]:
    text = text.encode("utf-8", "replace").decode("utf-8")
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    heading = next((line for line in lines[:30] if 3 <= len(line) <= 120 and (line.isupper() or re.match(r"^(chapter|part|appendix|section)\b", line, re.I))), None)
    body = re.sub(r"\s+", " ", " ".join(lines[:120])).strip()[:5000]
    words = re.findall(r"[^\W\d_][\w-]{2,}", body.casefold(), re.UNICODE)
    stop = {"the","and","for","that","with","from","this","which","page","figure","table","bir","ve","ile","için","olan"}
    topics = list(dict.fromkeys(word for word in words if word not in stop))[:64]
    return heading, body, json.dumps(topics, ensure_ascii=False, separators=(",",":"))


def store_webp(image: Image.Image, output: Path, namespace: str) -> tuple[str, str, int, int]:
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGB")
    with tempfile.NamedTemporaryFile(suffix=".webp", delete=False, dir=output / "tmp") as temp:
        temp_path = Path(temp.name)
    try:
        image.save(temp_path, "WEBP", quality=90, method=3, exact=True)
        digest = sha_file(temp_path)
        relative = Path("assets") / namespace / digest[:2] / f"{digest}.webp"
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            temp_path.replace(target)
        return digest, relative.as_posix(), image.width, image.height
    finally:
        temp_path.unlink(missing_ok=True)


def render_pages(source: Path, prefix: Path, poppler: Path, page_count: int) -> tuple[list[Path], str]:
    command = [str(poppler), "-png", "-r", "160", str(source), str(prefix)]
    poppler_error = None
    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=max(45, min(3300, page_count * 15 + 30)),
        )
        rendered = sorted(prefix.parent.glob(f"{prefix.name}-*.png"))
        if completed.returncode == 0 and len(rendered) == page_count:
            return rendered, "poppler"
        poppler_error = f"exit={completed.returncode};pages={len(rendered)};stderr={completed.stderr[-500:]}"
    except subprocess.TimeoutExpired as exc:
        poppler_error = f"timeout={exc.timeout}"
    for partial in prefix.parent.glob(f"{prefix.name}-*.png"):
        partial.unlink(missing_ok=True)
    try:
        import pymupdf

        document = pymupdf.open(str(source))
        if document.page_count != page_count:
            raise RuntimeError(f"PYMUPDF_PAGE_COUNT_MISMATCH:{document.page_count}:{page_count}")
        matrix = pymupdf.Matrix(160 / 72, 160 / 72)
        rendered = []
        for page_index in range(page_count):
            target = prefix.parent / f"{prefix.name}-{page_index + 1:06d}.png"
            document.load_page(page_index).get_pixmap(matrix=matrix, alpha=False).save(str(target))
            rendered.append(target)
        document.close()
        return rendered, "pymupdf"
    except Exception as exc:
        raise RuntimeError(f"RENDER_FAILED:poppler[{poppler_error}];pymupdf[{exc}]") from exc


def process_document(db: sqlite3.Connection, output: Path, poppler: Path, document_hash: str, source: Path) -> None:
    reader = PdfReader(str(source), strict=False)
    if reader.is_encrypted and reader.decrypt("") == 0:
        raise RuntimeError("PDF_ENCRYPTED")
    page_count = len(reader.pages)
    # An isolated worker can be terminated by its parent just after committing
    # the final page but before flipping the document status to ``complete``.
    # In that case every page (and every embedded-object result for that page)
    # is already durable.  Re-rendering a 900-page book wastes hours and can
    # overwrite no additional information, so resume from the committed state
    # after proving that the page sequence and referenced assets are intact.
    existing_pages = db.execute(
        "select page_number,file from page_plates where document_hash=? order by page_number",
        (document_hash,),
    ).fetchall()
    if len(existing_pages) == page_count and all(
        number == expected and file and (output / file).is_file()
        for expected, (number, file) in enumerate(existing_pages, start=1)
    ):
        object_assets = db.execute(
            """select file from embedded_visuals
               where document_hash=? and status='ready'""",
            (document_hash,),
        ).fetchall()
        if all(file and (output / file).is_file() for (file,) in object_assets):
            db.execute(
                "update documents set status='complete',error=null,processed_at=datetime('now') where document_hash=?",
                (document_hash,),
            )
            db.execute(
                "insert or replace into meta(key,value) values(?,?)",
                (f"render_engine:{document_hash}", "committed-resume"),
            )
            db.commit()
            return
    temp_root = output / "tmp"
    temp_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=f"render-{document_hash[:10]}-", dir=temp_root) as folder:
        prefix = Path(folder) / "page"
        rendered, render_engine = render_pages(source, prefix, poppler, page_count)
        if len(rendered) != page_count:
            raise RuntimeError(f"PAGE_COUNT_MISMATCH:{len(rendered)}:{page_count}")
        for page_number, png in enumerate(rendered, start=1):
            try:
                text = reader.pages[page_number - 1].extract_text() or ""
            except Exception:
                try:
                    import pymupdf

                    with pymupdf.open(str(source)) as fallback_document:
                        text = fallback_document.load_page(page_number - 1).get_text("text") or ""
                except Exception:
                    text = ""
            heading, body, topics = context(text)
            with Image.open(png) as image:
                asset_hash, file, width, height = store_webp(image, output, "pages")
            db.execute("insert or replace into page_plates values(?,?,?,?,?,?,?,?,?)", (document_hash, page_number, asset_hash, file, width, height, heading, body, topics))
            # Do not retain the catalog's single writer lock while decoding and
            # transcoding every embedded object on this page.
            db.commit()
            png.unlink(missing_ok=True)
            try:
                page = reader.pages[page_number - 1]
                image_count = len(page.images)
            except Exception as exc:
                db.execute("insert or replace into embedded_visuals values(?,?,?,?,?,?,?,?,?,?,?)", (document_hash, page_number, 0, None, None, None, None, None, None, "page-fallback", f"IMAGE_LIST_FAILED:{exc}"[:500]))
                db.commit()
                continue
            for image_index in range(image_count):
                number = image_index + 1
                try:
                    item = page.images[image_index]
                    extraction_hash = hashlib.sha256(item.data).hexdigest()
                    asset_hash, file, width, height = store_webp(item.image, output, "objects")
                    db.execute("insert or replace into embedded_visuals values(?,?,?,?,?,?,?,?,?,?,?)", (document_hash, page_number, number, extraction_hash, asset_hash, file, width, height, "image/webp", "ready", None))
                    # A single PDF page may expose thousands of image objects.
                    # Commit each catalogue row so expensive decoding of the
                    # next object never monopolizes SQLite's WAL writer lock.
                    db.commit()
                except Exception as exc:
                    db.execute("insert or replace into embedded_visuals values(?,?,?,?,?,?,?,?,?,?,?)", (document_hash, page_number, number, None, None, None, None, None, None, "page-fallback", str(exc)[:500]))
                    db.commit()
            db.commit()
    db.execute("update documents set status='complete',error=null,processed_at=datetime('now') where document_hash=?", (document_hash,))
    db.execute("insert or replace into meta(key,value) values(?,?)", (f"render_engine:{document_hash}", render_engine))
    db.commit()


def process(db: sqlite3.Connection, output: Path, poppler: Path, limit: int | None, shard_count: int, shard_index: int) -> None:
    query = """select d.document_hash,l.path from documents d join locations l on l.document_hash=d.document_hash
               where d.status in ('pending','processing') and l.rowid=(select min(x.rowid) from locations x where x.document_hash=d.document_hash)
               order by d.bytes,d.document_hash"""
    rows = db.execute(query).fetchall()
    rows = [row for row in rows if int(row[0][:16], 16) % shard_count == shard_index]
    if limit is not None:
        rows = rows[:limit]
    total = len(rows)
    script_path = Path(__file__).resolve()
    for index, (digest, path_value) in enumerate(rows, start=1):
        started = time.monotonic()
        source = Path(path_value)
        db.execute("update documents set status='processing',error=null where document_hash=?", (digest,)); db.commit()
        try:
            pages = db.execute("select page_count from documents where document_hash=?", (digest,)).fetchone()[0] or 1
            timeout_seconds = max(90, min(3600, pages * 20 + 60))
            command = [sys.executable, str(script_path), "--stage", "process-one", "--document-hash", digest, "--poppler", str(poppler), "--output", str(output)]
            child = subprocess.run(command, capture_output=True, text=True, timeout=timeout_seconds)
            if child.returncode != 0:
                raise RuntimeError(f"ISOLATED_WORKER_FAILED:{child.returncode}:{child.stderr[-1200:]}")
            print(json.dumps({"stage":"complete","index":index,"total":total,"documentHash":digest,"seconds":round(time.monotonic()-started,2),"path":str(source)}, ensure_ascii=False), flush=True)
        except subprocess.TimeoutExpired:
            error = f"ISOLATED_WORKER_TIMEOUT:{timeout_seconds}s"
            db.execute("update documents set status='failed',error=? where document_hash=?", (error,digest)); db.commit()
            print(json.dumps({"stage":"failed","index":index,"total":total,"documentHash":digest,"error":error,"path":str(source)}, ensure_ascii=False), flush=True)
        except Exception as exc:
            db.execute("update documents set status='failed',error=? where document_hash=?", (str(exc)[:2000],digest)); db.commit()
            print(json.dumps({"stage":"failed","index":index,"total":total,"documentHash":digest,"error":str(exc)[:500],"path":str(source)}, ensure_ascii=False), flush=True)


def process_one(db: sqlite3.Connection, output: Path, poppler: Path, document_hash: str) -> None:
    row = db.execute("""select l.path from locations l where l.document_hash=?
                        order by l.rowid limit 1""", (document_hash,)).fetchone()
    if not row:
        raise RuntimeError("DOCUMENT_LOCATION_MISSING")
    db.execute("update documents set status='processing',error=null where document_hash=?", (document_hash,))
    db.commit()
    try:
        process_document(db, output, poppler, document_hash, Path(row[0]))
    except Exception as exc:
        db.execute("update documents set status='failed',error=? where document_hash=?", (str(exc)[:2000], document_hash))
        db.commit()
        raise
    print(json.dumps({"stage":"process-one-complete","documentHash":document_hash}), flush=True)


def report(db: sqlite3.Connection) -> None:
    statuses = dict(db.execute("select status,count(*) from documents group by status"))
    result = {
        "schemaVersion": SCHEMA,
        "uniqueDocuments": db.execute("select count(*) from documents").fetchone()[0],
        "locations": db.execute("select count(*) from locations").fetchone()[0],
        "pages": db.execute("select coalesce(sum(page_count),0) from documents").fetchone()[0],
        "pagePlates": db.execute("select count(*) from page_plates").fetchone()[0],
        "embeddedVisuals": db.execute("select count(*) from embedded_visuals where status='ready'").fetchone()[0],
        "fallbackVisuals": db.execute("select count(*) from embedded_visuals where status='page-fallback'").fetchone()[0],
        "inventoryFailures": db.execute("select count(*) from inventory_failures").fetchone()[0],
        "statuses": statuses,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--root", type=Path, action="append", default=[])
    parser.add_argument("--poppler", type=Path)
    parser.add_argument("--stage", choices=("inventory","process","process-one","report","all"), default="all")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--document-hash")
    parser.add_argument("--shard-count", type=int, default=1)
    parser.add_argument("--shard-index", type=int, default=0)
    args = parser.parse_args()
    output = args.output.resolve(); (output / "tmp").mkdir(parents=True, exist_ok=True)
    db = connect(output)
    if args.stage in ("inventory","all"):
        inventory(db, [root.resolve() for root in args.root])
    if args.stage in ("process","all"):
        if not args.poppler:
            raise SystemExit("--poppler is required for processing")
        if args.shard_count < 1 or not 0 <= args.shard_index < args.shard_count:
            raise SystemExit("invalid shard configuration")
        process(db, output, args.poppler.resolve(), args.limit, args.shard_count, args.shard_index)
    if args.stage == "process-one":
        if not args.poppler or not args.document_hash:
            raise SystemExit("--poppler and --document-hash are required for process-one")
        process_one(db, output, args.poppler.resolve(), args.document_hash)
    report(db)


if __name__ == "__main__":
    main()
