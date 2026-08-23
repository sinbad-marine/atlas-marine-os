"""Query or resolve immutable assets from the private SINBAD visual atlas."""

from __future__ import annotations

import argparse
import base64
import json
import re
import sqlite3
import sys
from pathlib import Path


IMO_A760_PAGES = {
    "lifeboat": 6, "rescue-boat": 6, "liferaft": 6,
    "davit-launched-liferaft": 7, "embarkation-ladder": 7,
    "evacuation-slide": 7, "lifebuoy": 7,
    "lifebuoy-with-line": 8, "lifebuoy-with-light": 8,
    "lifebuoy-with-light-and-smoke": 8, "lifejacket": 8,
    "emergency-exit-indicator": 9, "exit": 9, "emergency-exit": 9,
    "muster-station": 10, "embarkation-station": 10, "direction-indicator": 10,
    "radar-transponder-sart": 11, "survival-craft-pyrotechnics": 11,
    "rocket-parachute-flares": 11, "line-throwing-appliance": 11,
    "child-lifejacket": 12, "immersion-suit": 12,
    "survival-craft-portable-radio": 12, "epirb": 12,
}

IMO_A760_ALIASES = {
    "filika": "lifeboat", "kurtarma botu": "rescue-boat", "can salı": "liferaft",
    "can sali": "liferaft", "can simidi": "lifebuoy", "can yeleği": "lifejacket",
    "can yelegi": "lifejacket", "toplanma istasyonu": "muster-station",
    "binme istasyonu": "embarkation-station", "dalma giysisi": "immersion-suit",
    "çocuk can yeleği": "child-lifejacket", "cocuk can yelegi": "child-lifejacket",
    "sart": "search-and-rescue-transponder", "radar transponder": "search-and-rescue-transponder",
}

IMO_A1116_LSS_PAGES = {
    "lifeboat": 6, "rescue-boat": 6, "liferaft": 6,
    "davit-launched-liferaft": 7, "lifebuoy": 7, "lifebuoy-with-line": 7,
    "lifebuoy-with-light": 8, "lifebuoy-with-line-and-light": 8,
    "lifebuoy-with-light-and-smoke": 8, "lifejacket": 9,
    "child-lifejacket": 9, "infant-lifejacket": 9,
    "search-and-rescue-transponder": 9, "survival-craft-distress-signal": 10,
    "rocket-parachute-flare": 10, "line-throwing-appliance": 10,
    "two-way-vhf-radiotelephone": 10, "epirb": 11,
    "embarkation-ladder": 11, "marine-evacuation-slide": 11,
    "marine-evacuation-chute": 11,
}


def curated_symbol_root() -> Path:
    return Path(__file__).resolve().parents[1] / "assets" / "curated-imo-symbols"


def curated_symbol_collections():
    assets = Path(__file__).resolve().parents[1] / "assets"
    return (
        (assets / "curated-imo-a1116-lss", "imo-a1116-lss-", IMO_A1116_LSS_PAGES,
         "IMO Resolution A.1116(30)",
         "https://wwwcdn.imo.org/localresources/en/KnowledgeCentre/IndexofIMOResolutions/AssemblyDocuments/A.1116%2830%29.pdf", 200),
        (assets / "curated-imo-symbols", "imo-a760-", IMO_A760_PAGES,
         "IMO Resolution A.760(18)",
         "https://wwwcdn.imo.org/localresources/en/KnowledgeCentre/IndexofIMOResolutions/AssemblyDocuments/A.760%2818%29.pdf", 100),
    )


def curated_symbol_query(value: str, limit: int) -> list[dict]:
    normalized = value.casefold()
    if not any(token in normalized for token in ("symbol", "sembol", "işaret", "isaret", "pictogram", "piktogram")):
        return []
    needles = set(re.findall(r"[^\W\d_][\w-]{2,}", normalized, re.UNICODE))
    preferred = set()
    for phrase, canonical in IMO_A760_ALIASES.items():
        if phrase in normalized:
            needles.update(canonical.split("-"))
            preferred.add(canonical)
    scored = []
    for root, prefix, pages, title, source_url, priority in curated_symbol_collections():
        for path in root.glob(f"{prefix}*.webp"):
            name = path.stem.removeprefix(prefix)
            score = len(needles.intersection(name.split("-"))) + (100 if name in preferred else 0)
            if score:
                scored.append((score + priority, name, path, pages, title, source_url, prefix))
    result = []
    for _score, name, path, pages, title, source_url, prefix in sorted(scored, key=lambda item: (-item[0], item[1]))[:limit]:
        digest = __import__("hashlib").sha256(path.read_bytes()).hexdigest()
        page = pages[name]
        resolution = "imo-a1116-lss" if prefix == "imo-a1116-lss-" else "imo-a760"
        document_hash = "imo-resolution-a1116-30" if prefix == "imo-a1116-lss-" else "imo-resolution-a760-18"
        result.append({
            "visual_key": f"curated:{resolution}:{name}", "visual_type": "object",
            "document_hash": document_hash, "page_number": page,
            "image_number": None, "asset_hash": digest,
            "file": str(path), "title": title, "volume": None,
            "heading": name.replace("-", " ").title(),
            "context": "Official IMO symbol related to life-saving appliances and arrangements.",
            "topics": [name, title, "life-saving appliance symbol"],
            "sourcePaths": [source_url],
            "rank": -1000.0,
            "assetUrl": f"http://127.0.0.1:31983/visuals/assets/{digest}.webp",
        })
    return result


def terms(value: str) -> list[str]:
    aliases = {
        "şamandıra": "buoy", "samandira": "buoy",
        "akıntı": "current", "akinti": "current", "gelgit": "tide", "fener": "light",
        "ışık": "light", "isik": "light", "pusula": "compass", "harita": "chart",
        "sembol": "symbol", "kardinal": "cardinal", "batık": "wreck", "batik": "wreck",
        "kerteriz": "bearing", "işaret": "mark", "isaret": "mark", "kısaltma": "abbreviation",
        "kisaltma": "abbreviation", "yangın": "fire", "yangin": "fire", "çapa": "anchor",
        "capa": "anchor", "halat": "rope", "dümen": "rudder", "dumen": "rudder",
    }
    request_words = {
        "göster", "goster", "gösterin", "gosterin", "gösterir", "gosterir",
        "gösterme", "gosterme", "görsel", "gorsel", "görseli", "gorseli",
        "görselini", "gorselini", "resim", "resmi", "resmini", "fotoğraf",
        "fotograf", "fotoğrafı", "fotografi", "fotoğrafını", "fotografini",
        "cihaz", "cihazı", "cihazi", "cihazını", "cihazini", "ekipman",
        "show", "display", "image", "picture", "photo", "photograph", "please",
    }
    normalized = value.casefold()
    found: list[str] = []
    lifebuoy_phrase = bool(re.search(r"\bcan\s+simid[uiı]\w*", normalized))
    if lifebuoy_phrase:
        result = ["lifebuoy", "life ring", "life-saving appliance"]
        if "sembol" in normalized or "symbol" in normalized:
            result.append("symbol")
        return result
    for word in re.findall(r"[^\W\d_][\w-]{2,}", normalized, re.UNICODE):
        if word in request_words:
            continue
        if lifebuoy_phrase and word in {"can", "simidi", "simidu", "simidı"}:
            continue
        for candidate in (word, aliases.get(word)):
            if candidate and candidate not in found:
                found.append(candidate)
    return found[:16]


def table_exists(db: sqlite3.Connection, name: str) -> bool:
    return db.execute("select 1 from sqlite_master where name=?", (name,)).fetchone() is not None


def query(db: sqlite3.Connection, value: str, limit: int, object_only: bool = False) -> list[dict]:
    curated = curated_symbol_query(value, limit)
    if curated:
        return curated
    wanted = terms(value)
    if not wanted:
        return []
    indexed = table_exists(db, "visual_search")
    if indexed:
        expression = " OR ".join(f'"{word.replace(chr(34), chr(34) * 2)}"' for word in wanted)
        type_clause = " and visual_type='object'" if object_only else ""
        rows = db.execute(
            """select visual_key,visual_type,document_hash,page_number,image_number,asset_hash,file,
                      title,volume,heading,context,topics,source_paths,bm25(visual_search) rank
               from visual_search where visual_search match ?""" + type_clause + """
               order by rank,case visual_type when 'object' then 0 when 'table' then 1 when 'vector' then 1 else 2 end limit ?""",
            (expression, limit - len(curated)),
        ).fetchall()
    else:
        clauses = " or ".join("lower(coalesce(p.heading,'')||' '||p.context||' '||p.topics) like ?" for _ in wanted)
        params = [f"%{word}%" for word in wanted]
        rows = db.execute(
            f"""select 'page:'||p.document_hash||':'||p.page_number visual_key,'page' visual_type,
                       p.document_hash,p.page_number,null image_number,p.asset_hash,p.file,
                       l.path title,null volume,p.heading,p.context,p.topics,
                       json_array(l.path) source_paths,0 rank
                from page_plates p
                join locations l on l.document_hash=p.document_hash
                 and l.rowid=(select min(x.rowid) from locations x where x.document_hash=p.document_hash)
                where {clauses} order by p.document_hash,p.page_number limit ?""",
            (*params, min(1000, max(200, limit * 100))),
        ).fetchall()
        rows = sorted(
            rows,
            key=lambda row: sum(
                token in f"{row['heading'] or ''} {row['context'] or ''} {row['topics'] or ''}".casefold()
                for token in wanted
            ),
            reverse=True,
        )[:limit]
    result = []
    for row in rows:
        item = dict(row)
        item["sourcePaths"] = json.loads(item.pop("source_paths"))
        item["topics"] = json.loads(item["topics"] or "[]")
        item["assetUrl"] = f"http://127.0.0.1:31983/visuals/assets/{item['asset_hash']}.webp"
        result.append(item)
    return curated + result[:limit - len(curated)]


def resolve_asset(db: sqlite3.Connection, atlas: Path, digest: str) -> dict:
    if not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise RuntimeError("INVALID_ASSET_HASH")
    for root, prefix, _pages, _title, _source_url, _priority in curated_symbol_collections():
        for path in root.glob(f"{prefix}*.webp"):
            if __import__("hashlib").sha256(path.read_bytes()).hexdigest() == digest:
                return {"asset_hash": digest, "file": str(path), "width": None, "height": None,
                        "visual_type": "object", "absolutePath": str(path.resolve())}
    statements = [
        "select asset_hash,file,width,height,'page' visual_type from page_plates where asset_hash=?",
        "select asset_hash,file,width,height,'object' visual_type from embedded_visuals where asset_hash=? and status='ready'",
    ]
    params = [digest, digest]
    if table_exists(db, "visual_regions"):
        statements.append("select asset_hash,file,width,height,kind visual_type from visual_regions where asset_hash=? and status='ready'")
        params.append(digest)
    row = db.execute(" union all ".join(statements) + " limit 1", params).fetchone()
    if not row:
        raise RuntimeError("ASSET_NOT_INDEXED")
    path = (atlas / row["file"]).resolve()
    if atlas not in path.parents or not path.is_file():
        raise RuntimeError("ASSET_FILE_UNAVAILABLE")
    return {**dict(row), "absolutePath": str(path)}


def status(db: sqlite3.Connection) -> dict:
    statuses = dict(db.execute("select status,count(*) from documents group by status"))
    total_pages = db.execute("select coalesce(sum(page_count),0) from documents").fetchone()[0]
    page_plates = db.execute("select count(*) from page_plates").fetchone()[0]
    result = {
        "schemaVersion": db.execute("select value from meta where key='schema_version'").fetchone()[0],
        "documents": db.execute("select count(*) from documents").fetchone()[0],
        "locations": db.execute("select count(*) from locations").fetchone()[0],
        "totalPages": total_pages,
        "pagePlates": page_plates,
        "pageProgressPercent": round(100 * page_plates / total_pages, 2) if total_pages else 100.0,
        "embeddedVisuals": db.execute("select count(*) from embedded_visuals where status='ready'").fetchone()[0],
        "inventoryFailures": db.execute("select count(*) from inventory_failures").fetchone()[0],
        "statuses": statuses,
    }
    result["visualRegions"] = db.execute("select count(*) from visual_regions where status='ready'").fetchone()[0] if table_exists(db, "visual_regions") else 0
    result["regionScannedPages"] = db.execute("select count(*) from region_scans where status='complete'").fetchone()[0] if table_exists(db, "region_scans") else 0
    result["regionExpectedPages"] = db.execute("select coalesce(sum(page_count),0) from documents where status='complete'").fetchone()[0]
    result["finalized"] = table_exists(db, "visual_search")
    return result


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--atlas", type=Path, required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--query")
    mode.add_argument("--query-base64")
    mode.add_argument("--asset-hash")
    mode.add_argument("--status", action="store_true")
    parser.add_argument("--limit", type=int, default=3)
    parser.add_argument("--object-only", action="store_true")
    args = parser.parse_args()
    atlas = args.atlas.resolve()
    catalog = (atlas / "catalog.sqlite").resolve().as_posix()
    db = sqlite3.connect(f"file:{catalog}?mode=ro&immutable=1", uri=True)
    db.row_factory = sqlite3.Row
    if args.status:
        output = status(db)
    elif args.asset_hash:
        output = resolve_asset(db, atlas, args.asset_hash)
    else:
        query_value = args.query
        if args.query_base64:
            query_value = base64.b64decode(args.query_base64, validate=True).decode("utf-8")
        output = {"visuals": query(db, query_value, max(1, min(args.limit, 10)), args.object_only)}
    print(json.dumps(output, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
