"""Finalize, search-index, and audit the complete private SINBAD visual atlas."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
from pathlib import Path


SCHEMA = "sinbad-complete-visual-atlas/1"
FINAL_SCHEMA = "sinbad-complete-visual-atlas-final/2"


def structure_overrides() -> dict[str, dict]:
    path = Path(__file__).resolve().parents[1] / "publication-structure-overrides.json"
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8")).get("documents", {})


def structured_heading(override: dict, page_number: int, fallback: str | None) -> str | None:
    for section in override.get("sections", []):
        if section["fromPage"] <= page_number <= section["toPage"]:
            return section["heading"]
    return fallback


def sha_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def source_labels(path_value: str) -> tuple[str, str | None]:
    path = Path(path_value)
    title = re.sub(r"__[0-9a-f]{10}(?=\.pdf$)", "", path.name, flags=re.I)
    title = re.sub(r"\.pdf$", "", title, flags=re.I).strip()
    volume = next(
        (
            re.sub(r"[-_. ]+", " ", match.group(0)).strip()
            for part in reversed(path.parts)
            if (match := re.search(r"(?:volume|vol(?:ume)?|cilt)\s*[-_. ]*(?:\d+|[ivxlcdm]+)(?=$|[^a-z0-9])", part, re.I))
        ),
        None,
    )
    return title, volume


def connect(atlas: Path) -> sqlite3.Connection:
    db = sqlite3.connect(atlas / "catalog.sqlite", timeout=60)
    db.row_factory = sqlite3.Row
    version = db.execute("select value from meta where key='schema_version'").fetchone()
    if not version or version[0] != SCHEMA:
        raise RuntimeError("ATLAS_SCHEMA_MISMATCH")
    return db


def build_search_index(db: sqlite3.Connection) -> None:
    overrides = structure_overrides()
    has_bindings = db.execute("select 1 from sqlite_master where name='visual_bindings'").fetchone() is not None
    db.executescript("""
      create table if not exists source_metadata(
        document_hash text primary key,title text not null,volume text,
        primary_path text not null,all_paths_json text not null
      );
      drop table if exists visual_search;
      create virtual table visual_search using fts5(
        visual_key unindexed,visual_type unindexed,document_hash unindexed,
        page_number unindexed,image_number unindexed,asset_hash unindexed,
        file unindexed,title,volume,heading,context,topics,source_paths unindexed,
        tokenize='unicode61 remove_diacritics 2'
      );
    """)
    db.execute("delete from source_metadata")
    documents = db.execute("select document_hash from documents order by document_hash").fetchall()
    for document in documents:
        digest = document[0]
        paths = [row[0] for row in db.execute("select path from locations where document_hash=? order by path", (digest,))]
        if not paths:
            continue
        title, volume = source_labels(paths[0])
        override = overrides.get(digest, {})
        title = override.get("title", title)
        paths_json = json.dumps(paths, ensure_ascii=False, separators=(",", ":"))
        db.execute("insert into source_metadata values(?,?,?,?,?)", (digest, title, volume, paths[0], paths_json))
        pages = db.execute("""
            select p.page_number,p.asset_hash,p.file,
                   coalesce(nullif(b.section_heading,''),p.heading) heading,
                   coalesce(nullif(b.local_context,''),p.context) context,
                   coalesce(nullif(b.topics,''),p.topics) topics
              from page_plates p
              left join visual_bindings b on b.visual_key='page:'||p.document_hash||':'||p.page_number
             where p.document_hash=? order by p.page_number
        """ if has_bindings else
            "select page_number,asset_hash,file,heading,context,topics from page_plates where document_hash=? order by page_number",
            (digest,))
        for page in pages:
            values = (
                f"page:{digest}:{page['page_number']}", "page", digest, page["page_number"], None,
                page["asset_hash"], page["file"], title, volume,
                structured_heading(override, page["page_number"], page["heading"]), page["context"],
                page["topics"], paths_json,
            )
            db.execute("insert into visual_search values(?,?,?,?,?,?,?,?,?,?,?,?,?)", values)
        objects = db.execute(
            """select e.page_number,e.image_number,e.asset_hash,e.file,
                      coalesce(nullif(b.section_heading,''),p.heading) heading,
                      trim(coalesce(b.caption,'')||' '||coalesce(nullif(b.local_context,''),p.context)) context,
                      coalesce(nullif(b.topics,''),p.topics) topics
               from embedded_visuals e join page_plates p using(document_hash,page_number)
               left join visual_bindings b on b.visual_key='object:'||e.document_hash||':'||e.page_number||':'||e.image_number
               where e.document_hash=? and e.status='ready'
               order by e.page_number,e.image_number""",
            (digest,),
        ) if has_bindings else db.execute(
            """select e.page_number,e.image_number,e.asset_hash,e.file,p.heading,p.context,p.topics
               from embedded_visuals e join page_plates p using(document_hash,page_number)
               where e.document_hash=? and e.status='ready' order by e.page_number,e.image_number""", (digest,)
        )
        for item in objects:
            values = (
                f"object:{digest}:{item['page_number']}:{item['image_number']}", "object", digest,
                item["page_number"], item["image_number"], item["asset_hash"], item["file"], title,
                volume, structured_heading(override, item["page_number"], item["heading"]),
                item["context"], item["topics"], paths_json,
            )
            db.execute("insert into visual_search values(?,?,?,?,?,?,?,?,?,?,?,?,?)", values)
        if db.execute("select 1 from sqlite_master where name='visual_regions'").fetchone():
            regions = db.execute(
                """select r.page_number,r.region_number,r.kind,r.asset_hash,r.file,
                          coalesce(nullif(b.section_heading,''),r.heading) heading,
                          trim(coalesce(b.caption,'')||' '||coalesce(nullif(b.local_context,''),r.context)) context,
                          coalesce(nullif(b.topics,''),r.topics) topics
                   from visual_regions r
                   left join visual_bindings b on b.visual_key='region:'||r.document_hash||':'||r.page_number||':'||r.region_number
                   where r.document_hash=? and r.status='ready'
                   order by r.page_number,r.region_number""",
                (digest,),
            ) if has_bindings else db.execute(
                """select page_number,region_number,kind,asset_hash,file,heading,context,topics
                   from visual_regions where document_hash=? and status='ready' order by page_number,region_number""", (digest,)
            )
            for item in regions:
                values = (
                    f"region:{digest}:{item['page_number']}:{item['region_number']}", item["kind"], digest,
                    item["page_number"], item["region_number"], item["asset_hash"], item["file"], title,
                    volume, structured_heading(override, item["page_number"], item["heading"]),
                    item["context"], item["topics"], paths_json,
                )
                db.execute("insert into visual_search values(?,?,?,?,?,?,?,?,?,?,?,?,?)", values)
    db.execute("insert or replace into meta values('final_schema_version',?)", (FINAL_SCHEMA,))
    db.commit()


def referenced_asset_files(db: sqlite3.Connection) -> set[str]:
    statements = [
        "select file from page_plates",
        "select file from embedded_visuals where status='ready'",
    ]
    if db.execute("select 1 from sqlite_master where name='visual_regions'").fetchone():
        statements.append("select file from visual_regions where status='ready'")
    return {row[0] for row in db.execute(" union ".join(statements)) if row[0]}


def orphan_assets(db: sqlite3.Connection, atlas: Path) -> list[Path]:
    referenced = referenced_asset_files(db)
    result: list[Path] = []
    for namespace in ("pages", "objects", "regions"):
        root = (atlas / "assets" / namespace).resolve()
        if not root.is_dir():
            continue
        for path in root.rglob("*.webp"):
            relative = path.relative_to(atlas).as_posix()
            if relative not in referenced:
                result.append(path)
    return result


def prune_orphan_assets(db: sqlite3.Connection, atlas: Path) -> dict[str, int]:
    orphans = orphan_assets(db, atlas)
    removed_bytes = 0
    for path in orphans:
        resolved = path.resolve()
        allowed = any((atlas / "assets" / namespace).resolve() in resolved.parents for namespace in ("pages", "objects", "regions"))
        if not allowed:
            raise RuntimeError(f"ORPHAN_PATH_OUTSIDE_CAS:{resolved}")
        removed_bytes += resolved.stat().st_size
        resolved.unlink()
    for namespace in ("pages", "objects", "regions"):
        root = atlas / "assets" / namespace
        if root.is_dir():
            for folder in sorted((item for item in root.rglob("*") if item.is_dir()), reverse=True):
                try:
                    folder.rmdir()
                except OSError:
                    pass
    return {"removedAssets": len(orphans), "removedBytes": removed_bytes}


def audit(db: sqlite3.Connection, atlas: Path, verify_hashes: bool) -> dict:
    result: dict[str, object] = {
        "schemaVersion": FINAL_SCHEMA,
        "documents": db.execute("select count(*) from documents").fetchone()[0],
        "locations": db.execute("select count(*) from locations").fetchone()[0],
        "duplicateLocations": db.execute("select count(*) from locations").fetchone()[0]
        - db.execute("select count(*) from documents").fetchone()[0],
        "inventoryFailures": db.execute("select count(*) from inventory_failures").fetchone()[0],
        "statuses": dict(db.execute("select status,count(*) from documents group by status")),
        "pagePlates": db.execute("select count(*) from page_plates").fetchone()[0],
        "embeddedVisuals": db.execute("select count(*) from embedded_visuals where status='ready'").fetchone()[0],
        "embeddedFallbacks": db.execute("select count(*) from embedded_visuals where status='page-fallback'").fetchone()[0],
    }
    has_regions = db.execute("select 1 from sqlite_master where name='visual_regions'").fetchone() is not None
    result["visualRegions"] = db.execute("select count(*) from visual_regions where status='ready'").fetchone()[0] if has_regions else 0
    result["regionFallbacks"] = db.execute("select count(*) from visual_regions where status='page-fallback'").fetchone()[0] if has_regions else 0
    result["expectedRegionScanPages"] = db.execute("select coalesce(sum(page_count),0) from documents where status='complete'").fetchone()[0]
    result["regionScannedPages"] = db.execute("select count(*) from region_scans where status='complete'").fetchone()[0] if has_regions else 0
    result["regionFailedPages"] = db.execute("select count(*) from region_scans where status='failed'").fetchone()[0] if has_regions else 0
    dedupe_queries = {
        "pages": ("select count(*),count(distinct asset_hash) from page_plates", ()),
        "objects": ("select count(*),count(distinct asset_hash) from embedded_visuals where status=?", ("ready",)),
    }
    if has_regions:
        dedupe_queries["regions"] = ("select count(*),count(distinct asset_hash) from visual_regions where status=?", ("ready",))
    result["deduplication"] = {}
    for name, (query, params) in dedupe_queries.items():
        occurrences, unique_assets = db.execute(query, params).fetchone()
        result["deduplication"][name] = {
            "occurrences": occurrences,
            "uniqueAssets": unique_assets,
            "deduplicatedOccurrences": occurrences - unique_assets,
        }
    result["inventoryFailureDetails"] = [
        dict(row)
        for row in db.execute(
            "select path,document_hash,bytes,error,recorded_at from inventory_failures order by path"
        )
    ]
    result["failedDocumentDetails"] = [
        dict(row)
        for row in db.execute(
            """select d.document_hash,d.page_count,d.encrypted,d.error,
                      group_concat(l.path,char(10)) source_paths
               from documents d left join locations l using(document_hash)
               where d.status='failed' group by d.document_hash order by d.document_hash"""
        )
    ]
    result["encryptedDocumentDetails"] = [
        dict(row)
        for row in db.execute(
            """select d.document_hash,d.status,d.error,group_concat(l.path,char(10)) source_paths
               from documents d left join locations l using(document_hash)
               where d.encrypted=1 group by d.document_hash order by d.document_hash"""
        )
    ]
    result["encryptedDocuments"] = len(result["encryptedDocumentDetails"])
    result["encryptedAccessibleDocuments"] = sum(
        item["status"] == "complete" for item in result["encryptedDocumentDetails"]
    )
    result["encryptedFailedDocuments"] = sum(
        item["status"] == "failed" for item in result["encryptedDocumentDetails"]
    )
    result["embeddedFallbackDetails"] = [
        dict(row)
        for row in db.execute(
            """select e.document_hash,e.page_number,e.image_number,e.error,
                      group_concat(l.path,char(10)) source_paths
               from embedded_visuals e left join locations l using(document_hash)
               where e.status='page-fallback'
               group by e.document_hash,e.page_number,e.image_number
               order by e.document_hash,e.page_number,e.image_number"""
        )
    ]
    result["regionFallbackDetails"] = [dict(row) for row in db.execute(
        """select r.document_hash,r.page_number,r.region_number,r.kind,r.error,
                  group_concat(l.path,char(10)) source_paths
           from visual_regions r left join locations l using(document_hash)
           where r.status='page-fallback'
           group by r.document_hash,r.page_number,r.region_number
           order by r.document_hash,r.page_number,r.region_number"""
    )] if has_regions else []
    result["regionScanFailures"] = [dict(row) for row in db.execute(
        """select r.document_hash,r.page_number,r.error,group_concat(l.path,char(10)) source_paths
           from region_scans r left join locations l using(document_hash)
           where r.status='failed' group by r.document_hash,r.page_number
           order by r.document_hash,r.page_number"""
    )] if has_regions else []
    mismatches = db.execute(
        """select d.document_hash,d.page_count,count(p.page_number) actual
           from documents d left join page_plates p using(document_hash)
           where d.status='complete' group by d.document_hash,d.page_count
           having actual != d.page_count"""
    ).fetchall()
    result["completePageCountMismatches"] = [dict(row) for row in mismatches]
    result["completeWithoutSourceMetadata"] = db.execute(
        """select count(*) from documents d left join source_metadata s using(document_hash)
           where d.status='complete' and s.document_hash is null"""
    ).fetchone()[0]
    asset_query = """select asset_hash,file from page_plates
                     union select asset_hash,file from embedded_visuals where status='ready'"""
    if has_regions:
        asset_query += " union select asset_hash,file from visual_regions where status='ready'"
    assets = db.execute(asset_query).fetchall()
    missing: list[str] = []
    bad_hashes: list[dict[str, str]] = []
    for row in assets:
        path = atlas / row["file"]
        if not path.is_file():
            missing.append(row["file"])
        elif verify_hashes:
            actual = sha_file(path)
            if actual != row["asset_hash"]:
                bad_hashes.append({"file": row["file"], "expected": row["asset_hash"], "actual": actual})
    result["uniqueReferencedAssets"] = len(assets)
    result["missingAssets"] = missing
    result["hashMismatches"] = bad_hashes
    remaining_orphans = orphan_assets(db, atlas)
    result["orphanAssets"] = len(remaining_orphans)
    result["orphanAssetBytes"] = sum(path.stat().st_size for path in remaining_orphans)
    result["searchRows"] = db.execute("select count(*) from visual_search").fetchone()[0]
    has_bindings = db.execute("select 1 from sqlite_master where name='visual_bindings'").fetchone() is not None
    result["visualBindings"] = db.execute("select count(*) from visual_bindings").fetchone()[0] if has_bindings else 0
    result["bindingCompletePages"] = db.execute(
        "select count(*) from visual_binding_scans where status='complete'"
    ).fetchone()[0] if has_bindings else 0
    result["bindingFailedPages"] = db.execute(
        "select count(*) from visual_binding_scans where status='failed'"
    ).fetchone()[0] if has_bindings else 0
    binding_passed = (not has_bindings or (
        result["bindingCompletePages"] == result["expectedRegionScanPages"]
        and result["bindingFailedPages"] == 0
        and result["visualBindings"] == result["pagePlates"] + result["embeddedVisuals"] + result["visualRegions"]
    ))
    result["passed"] = (
        not mismatches
        and not missing
        and not bad_hashes
        and result["orphanAssets"] == 0
        and result["completeWithoutSourceMetadata"] == 0
        and result["searchRows"] == result["pagePlates"] + result["embeddedVisuals"] + result["visualRegions"]
        and result["regionScannedPages"] + result["regionFailedPages"] == result["expectedRegionScanPages"]
        and binding_passed
        and set(result["statuses"]) <= {"complete", "failed"}
    )
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--atlas", type=Path, required=True)
    parser.add_argument("--verify-hashes", action="store_true")
    parser.add_argument("--allow-incomplete", action="store_true")
    parser.add_argument("--prune-orphans", action="store_true")
    args = parser.parse_args()
    atlas = args.atlas.resolve()
    db = connect(atlas)
    statuses = dict(db.execute("select status,count(*) from documents group by status"))
    incomplete = statuses.get("pending", 0) + statuses.get("processing", 0)
    if incomplete and not args.allow_incomplete:
        raise SystemExit(f"ATLAS_INCOMPLETE:{incomplete}")
    build_search_index(db)
    prune_result = prune_orphan_assets(db, atlas) if args.prune_orphans else {"removedAssets": 0, "removedBytes": 0}
    result = audit(db, atlas, args.verify_hashes)
    result["prunedOrphanAssets"] = prune_result["removedAssets"]
    result["prunedOrphanBytes"] = prune_result["removedBytes"]
    report = atlas / "final-audit.json"
    report.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({**result, "report": str(report)}, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["passed"] else 2)


if __name__ == "__main__":
    main()
