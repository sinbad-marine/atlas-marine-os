"""Bind every extracted SINBAD visual to its local PDF text and geometry.

The extractor deliberately keeps immutable page/object/region assets separate from
their semantic bindings.  This pass can therefore be rerun after improving the
binding algorithm without rendering or duplicating the visual corpus again.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sqlite3
import time
from pathlib import Path

import pymupdf


BINDING_SCHEMA = "sinbad-visual-bindings/1"
CAPTION_RE = re.compile(
    r"^(?:fig(?:ure)?|table|plate|chart|diagram|şekil|sekil|tablo|levha|çizim|cizim)\s*[.:#-]?\s*\d+[\w.-]*",
    re.I,
)
HEADING_RE = re.compile(
    r"^(?:chapter|part|section|appendix|annex|bölüm|bolum|kısım|kisim|ek)\b", re.I
)
STOP = {
    "the", "and", "for", "that", "with", "from", "this", "which", "page", "figure", "table",
    "bir", "ve", "ile", "için", "icin", "olan", "şekil", "sekil", "tablo", "sayfa",
}


def connect(atlas: Path) -> sqlite3.Connection:
    db = sqlite3.connect(atlas / "catalog.sqlite", timeout=300)
    db.row_factory = sqlite3.Row
    db.execute("pragma busy_timeout=300000")
    db.execute("pragma journal_mode=WAL")
    db.execute("pragma synchronous=NORMAL")
    db.executescript("""
      create table if not exists visual_binding_scans(
        document_hash text not null,page_number integer not null,status text not null,
        error text,processed_at text not null default(datetime('now')),
        primary key(document_hash,page_number)
      );
      create table if not exists visual_bindings(
        visual_key text primary key,visual_type text not null,document_hash text not null,
        page_number integer not null,visual_number integer,bbox_json text,
        section_heading text,caption text,local_context text not null,topics text not null,
        role text not null,quality_score real not null,quality_reasons text not null,
        binding_schema text not null,processed_at text not null default(datetime('now'))
      );
      create index if not exists visual_binding_document_page
        on visual_bindings(document_hash,page_number);
      create index if not exists visual_binding_role on visual_bindings(role,quality_score);
    """)
    db.execute("insert or replace into meta values('binding_schema_version',?)", (BINDING_SCHEMA,))
    db.commit()
    return db


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("\ufffd", " ")).strip()


def topics(value: str) -> str:
    words = re.findall(r"[^\W\d_][\w-]{2,}", value.casefold(), re.UNICODE)
    return json.dumps(list(dict.fromkeys(word for word in words if word not in STOP))[:96],
                      ensure_ascii=False, separators=(",", ":"))


def rect_distance(first: pymupdf.Rect, second: pymupdf.Rect) -> float:
    dx = max(first.x0 - second.x1, second.x0 - first.x1, 0)
    dy = max(first.y0 - second.y1, second.y0 - first.y1, 0)
    return math.hypot(dx, dy)


def text_layout(page: pymupdf.Page) -> tuple[list[dict], str | None, list[dict]]:
    raw = page.get_text("dict", flags=pymupdf.TEXTFLAGS_TEXT)
    spans = []
    blocks = []
    for block in raw.get("blocks", []):
        if block.get("type") != 0:
            continue
        lines = []
        block_spans = []
        for line in block.get("lines", []):
            line_text = clean("".join(span.get("text", "") for span in line.get("spans", [])))
            if line_text:
                lines.append(line_text)
            for span in line.get("spans", []):
                text = clean(span.get("text", ""))
                if text:
                    item = {"text": text, "size": float(span.get("size", 0)),
                            "font": span.get("font", ""), "bbox": pymupdf.Rect(span["bbox"])}
                    spans.append(item)
                    block_spans.append(item)
        value = clean(" ".join(lines))
        if value:
            blocks.append({"text": value, "bbox": pymupdf.Rect(block["bbox"]),
                           "caption": bool(CAPTION_RE.match(value)), "spans": block_spans})
    sizes = sorted(span["size"] for span in spans if span["size"] > 0)
    median = sizes[len(sizes) // 2] if sizes else 10.0
    candidates = []
    for block in blocks:
        value = block["text"]
        if len(value) > 180 or block["caption"] or not re.search(r"[A-Za-zÀ-ž]", value):
            continue
        largest = max((span["size"] for span in block["spans"]), default=0)
        bold = any(re.search(r"bold|black|heavy", span["font"], re.I) for span in block["spans"])
        upper = len(value) >= 4 and value.upper() == value and any(ch.isalpha() for ch in value)
        if largest >= median * 1.28 or bold or upper or HEADING_RE.match(value):
            candidates.append((largest + 2 * bold + upper, -block["bbox"].y0, value))
    heading = max(candidates, default=(0, 0, None))[2]
    captions = [block for block in blocks if block["caption"]]
    return blocks, heading, captions


def local_binding(rect: pymupdf.Rect | None, blocks: list[dict], captions: list[dict],
                  fallback: str) -> tuple[str | None, str]:
    if rect is None:
        caption = captions[0]["text"] if len(captions) == 1 else None
        return caption, clean(" ".join([caption or "", fallback]))[:5000]
    nearest = sorted(blocks, key=lambda block: (rect_distance(rect, block["bbox"]), block["bbox"].y0))
    caption_item = min(captions, key=lambda block: rect_distance(rect, block["bbox"]), default=None)
    caption = caption_item["text"] if caption_item and rect_distance(rect, caption_item["bbox"]) <= max(120, rect.height) else None
    selected = []
    if caption:
        selected.append(caption)
    for block in nearest:
        if block["text"] not in selected:
            selected.append(block["text"])
        if len(selected) >= 5 or len(" ".join(selected)) >= 3500:
            break
    return caption, clean(" ".join(selected))[:5000]


def object_rects(page: pymupdf.Page) -> list[pymupdf.Rect | None]:
    result = []
    for image in page.get_images(full=True):
        xref = image[0]
        try:
            rectangles = page.get_image_rects(xref)
            result.append(max(rectangles, key=lambda rect: rect.get_area()) if rectangles else None)
        except Exception:
            result.append(None)
    return result


def quality(width: int | None, height: int | None, rect: pymupdf.Rect | None,
            page_rect: pymupdf.Rect, caption: str | None, context: str,
            visual_type: str) -> tuple[str, float, str]:
    reasons = []
    score = 0.0
    area = (width or 0) * (height or 0)
    if area >= 150000:
        score += 3; reasons.append("substantial-pixel-area")
    elif area and area < 4096:
        score -= 8; reasons.append("tiny-object")
    if rect:
        coverage = rect.get_area() / max(page_rect.get_area(), 1)
        if coverage >= 0.03:
            score += 3; reasons.append("substantial-page-coverage")
        elif coverage < 0.001:
            score -= 6; reasons.append("tiny-page-coverage")
    if caption:
        score += 5; reasons.append("caption-bound")
    if len(context) >= 80:
        score += 3; reasons.append("local-context-bound")
    if visual_type in {"table", "vector"}:
        score += 2; reasons.append("structured-region")
    role = "instructional"
    if score <= -3:
        role = "decorative"
    elif score < 3:
        role = "uncertain"
    return role, score, json.dumps(reasons, separators=(",", ":"))


def upsert_binding(db: sqlite3.Connection, values: tuple) -> None:
    db.execute("""insert or replace into visual_bindings(
        visual_key,visual_type,document_hash,page_number,visual_number,bbox_json,
        section_heading,caption,local_context,topics,role,quality_score,quality_reasons,
        binding_schema,processed_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))""", values)


def scan_page(db: sqlite3.Connection, document_hash: str, page_number: int,
              page: pymupdf.Page) -> None:
    plate = db.execute("select heading,context,width,height from page_plates where document_hash=? and page_number=?",
                       (document_hash, page_number)).fetchone()
    if not plate:
        raise RuntimeError("PAGE_PLATE_MISSING")
    blocks, derived_heading, captions = text_layout(page)
    heading = derived_heading or plate["heading"]
    page_context = clean(" ".join(block["text"] for block in blocks))[:5000] or plate["context"] or ""
    upsert_binding(db, (f"page:{document_hash}:{page_number}", "page", document_hash, page_number,
        None, json.dumps(list(page.rect), separators=(",", ":")), heading, None, page_context,
        topics(" ".join(filter(None, (heading, page_context)))), "reference-page", 1.0,
        '["whole-source-page"]', BINDING_SCHEMA))

    rects = object_rects(page)
    objects = db.execute("""select image_number,width,height from embedded_visuals
        where document_hash=? and page_number=? and status='ready' order by image_number""",
        (document_hash, page_number)).fetchall()
    for item in objects:
        index = item["image_number"] - 1
        rect = rects[index] if 0 <= index < len(rects) else None
        caption, context = local_binding(rect, blocks, captions, page_context)
        role, score, reasons = quality(item["width"], item["height"], rect, page.rect,
                                       caption, context, "object")
        upsert_binding(db, (f"object:{document_hash}:{page_number}:{item['image_number']}", "object",
            document_hash, page_number, item["image_number"],
            json.dumps([round(v, 3) for v in rect], separators=(",", ":")) if rect else None,
            heading, caption, context, topics(" ".join(filter(None, (heading, caption, context)))),
            role, score, reasons, BINDING_SCHEMA))

    regions = db.execute("""select region_number,kind,bbox_json,width,height from visual_regions
        where document_hash=? and page_number=? and status='ready' order by region_number""",
        (document_hash, page_number)).fetchall()
    for item in regions:
        rect = pymupdf.Rect(json.loads(item["bbox_json"]))
        caption, context = local_binding(rect, blocks, captions, page_context)
        role, score, reasons = quality(item["width"], item["height"], rect, page.rect,
                                       caption, context, item["kind"])
        upsert_binding(db, (f"region:{document_hash}:{page_number}:{item['region_number']}", item["kind"],
            document_hash, page_number, item["region_number"], item["bbox_json"], heading, caption,
            context, topics(" ".join(filter(None, (heading, caption, context)))), role, score,
            reasons, BINDING_SCHEMA))


def scan_document(db: sqlite3.Connection, digest: str, source: Path) -> None:
    document = pymupdf.open(str(source))
    try:
        for index in range(document.page_count):
            page_number = index + 1
            done = db.execute("""select status from visual_binding_scans
                where document_hash=? and page_number=?""", (digest, page_number)).fetchone()
            if done and done[0] == "complete":
                continue
            try:
                scan_page(db, digest, page_number, document.load_page(index))
                db.execute("insert or replace into visual_binding_scans values(?,?,?,null,datetime('now'))",
                           (digest, page_number, "complete"))
            except Exception as error:
                db.execute("insert or replace into visual_binding_scans values(?,?,?,?,datetime('now'))",
                           (digest, page_number, "failed", str(error)[:2000]))
            db.commit()
    finally:
        document.close()


def process(db: sqlite3.Connection, shard_count: int, shard_index: int, limit: int | None) -> None:
    rows = db.execute("""select d.document_hash,l.path from documents d join locations l using(document_hash)
        where d.status='complete'
          and l.rowid=(select min(x.rowid) from locations x where x.document_hash=d.document_hash)
          and (select count(*) from visual_binding_scans b
               where b.document_hash=d.document_hash and b.status='complete') < d.page_count
        order by d.bytes,d.document_hash""").fetchall()
    rows = [row for row in rows if int(row["document_hash"][:16], 16) % shard_count == shard_index]
    if limit is not None:
        rows = rows[:limit]
    for index, row in enumerate(rows, 1):
        started = time.monotonic()
        try:
            scan_document(db, row["document_hash"], Path(row["path"]))
            print(json.dumps({"stage":"binding-complete","index":index,"total":len(rows),
                "documentHash":row["document_hash"],"seconds":round(time.monotonic()-started,2)}), flush=True)
        except Exception as error:
            print(json.dumps({"stage":"binding-document-failed","index":index,"total":len(rows),
                "documentHash":row["document_hash"],"error":str(error)[:1000]}), flush=True)


def classify_repeated_assets(db: sqlite3.Connection) -> None:
    """Suppress recurring page furniture without deleting its immutable asset."""
    db.execute("""
      update visual_bindings
         set role='decorative',quality_score=quality_score-12,
             quality_reasons=json_insert(quality_reasons,'$[#]','repeated-page-furniture')
       where visual_type='object' and caption is null
         and visual_key in (
           select 'object:'||e.document_hash||':'||e.page_number||':'||e.image_number
             from embedded_visuals e
             join (
               select document_hash,asset_hash,count(distinct page_number) page_uses
                 from embedded_visuals where status='ready'
                group by document_hash,asset_hash having page_uses>=5
             ) repeated using(document_hash,asset_hash)
         )
         and json_extract(quality_reasons,'$[#-1]')!='repeated-page-furniture'
    """)
    db.commit()


def report(db: sqlite3.Connection) -> None:
    classify_repeated_assets(db)
    expected_pages = db.execute("select coalesce(sum(page_count),0) from documents where status='complete'").fetchone()[0]
    result = {
        "schemaVersion": BINDING_SCHEMA,
        "expectedPages": expected_pages,
        "completePages": db.execute("select count(*) from visual_binding_scans where status='complete'").fetchone()[0],
        "failedPages": db.execute("select count(*) from visual_binding_scans where status='failed'").fetchone()[0],
        "bindings": db.execute("select count(*) from visual_bindings").fetchone()[0],
        "roles": dict(db.execute("select role,count(*) from visual_bindings group by role")),
        "types": dict(db.execute("select visual_type,count(*) from visual_bindings group by visual_type")),
    }
    result["passed"] = result["completePages"] == expected_pages and result["failedPages"] == 0
    print(json.dumps(result, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--atlas", type=Path, required=True)
    parser.add_argument("--stage", choices=("process", "process-one", "report"), default="process")
    parser.add_argument("--shard-count", type=int, default=1)
    parser.add_argument("--shard-index", type=int, default=0)
    parser.add_argument("--document-hash")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    if args.shard_count < 1 or not 0 <= args.shard_index < args.shard_count:
        raise SystemExit("invalid shard configuration")
    db = connect(args.atlas.resolve())
    if args.stage == "process":
        process(db, args.shard_count, args.shard_index, args.limit)
    elif args.stage == "process-one":
        row = db.execute("select path from locations where document_hash=? order by rowid limit 1",
                         (args.document_hash,)).fetchone()
        if not args.document_hash or not row:
            raise SystemExit("document not found")
        if args.force:
            db.execute("delete from visual_binding_scans where document_hash=?", (args.document_hash,))
            db.execute("delete from visual_bindings where document_hash=?", (args.document_hash,))
            db.commit()
        scan_document(db, args.document_hash, Path(row[0]))
    report(db)


if __name__ == "__main__":
    main()
