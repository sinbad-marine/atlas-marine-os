from __future__ import annotations

import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1] / "visual-library" / "scripts"


def load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / filename)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module


builder = load("atlas_builder", "build-complete-library-atlas.py")
regions = load("atlas_regions", "extract-complete-library-regions.py")
finalizer = load("atlas_finalizer", "finalize-complete-library-atlas.py")


class FinalizerTest(unittest.TestCase):
    def test_final_index_hash_audit_and_orphan_pruning(self):
        with tempfile.TemporaryDirectory() as folder:
            atlas = Path(folder)
            (atlas / "tmp").mkdir()
            db = builder.connect(atlas)
            digest = "a" * 64
            source = atlas / "Bowditch Volume II__1234567890.pdf"
            source.write_bytes(b"source")
            db.execute(
                "insert into documents(document_hash,bytes,page_count,encrypted,status) values(?,?,?,?,?)",
                (digest, source.stat().st_size, 1, 0, "complete"),
            )
            db.execute("insert into locations values(?,?)", (digest, str(source)))

            def asset(namespace: str, payload: bytes):
                asset_hash = hashlib.sha256(payload).hexdigest()
                relative = Path("assets") / namespace / asset_hash[:2] / f"{asset_hash}.webp"
                target = atlas / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(payload)
                return asset_hash, relative.as_posix()

            page_hash, page_file = asset("pages", b"page")
            object_hash, object_file = asset("objects", b"object")
            region_hash, region_file = asset("regions", b"region")
            db.execute(
                "insert into page_plates values(?,?,?,?,?,?,?,?,?)",
                (digest, 1, page_hash, page_file, 1000, 1400, "LIFEBUOYS", "Lifebuoy arrangement.", '["lifebuoy"]'),
            )
            db.execute(
                "insert into embedded_visuals values(?,?,?,?,?,?,?,?,?,?,?)",
                (digest, 1, 1, "b" * 64, object_hash, object_file, 300, 300, "image/webp", "ready", None),
            )
            db.commit()
            db.close()

            db = regions.connect(atlas)
            db.execute(
                "insert into visual_regions values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (digest, 1, 1, "table", "[0,0,100,100]", region_hash, region_file, 800, 500,
                 "LIFEBUOYS", "Lifebuoy table.", '["lifebuoy"]', "ready", None),
            )
            db.execute("insert into region_scans values(?,?,?,null,datetime('now'))", (digest, 1, "complete"))
            db.commit()
            db.close()

            db = finalizer.connect(atlas)
            finalizer.build_search_index(db)
            result = finalizer.audit(db, atlas, verify_hashes=True)
            self.assertTrue(result["passed"])
            self.assertEqual(result["searchRows"], 3)
            metadata = db.execute("select title,volume from source_metadata where document_hash=?", (digest,)).fetchone()
            self.assertEqual(tuple(metadata), ("Bowditch Volume II", "Volume II"))

            orphan_hash, orphan_file = asset("regions", b"orphan")
            self.assertEqual(len(finalizer.orphan_assets(db, atlas)), 1)
            pruned = finalizer.prune_orphan_assets(db, atlas)
            self.assertEqual(pruned["removedAssets"], 1)
            self.assertFalse((atlas / orphan_file).exists())
            self.assertTrue((atlas / region_file).exists())
            self.assertEqual(finalizer.audit(db, atlas, verify_hashes=True)["orphanAssets"], 0)
            db.close()


if __name__ == "__main__":
    unittest.main()
