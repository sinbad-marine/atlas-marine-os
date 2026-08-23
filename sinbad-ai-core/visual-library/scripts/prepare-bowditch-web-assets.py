"""Convert Bowditch JP2 extractions to browser-safe WebP and rebind manifests."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def convert(source: Path, target: Path) -> None:
    if target.exists():
        return
    with Image.open(source) as image:
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")
        image.save(target, "WEBP", quality=88, method=6, exact=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--atlas", type=Path, required=True)
    parser.add_argument("--prune-originals", action="store_true")
    args = parser.parse_args()
    atlas = args.atlas.resolve()
    manifests = [atlas / "volume-1-manifest.json", atlas / "volume-2-manifest.json"]
    converted: dict[Path, Path] = {}

    for manifest_path in manifests:
        document = json.loads(manifest_path.read_text(encoding="utf-8"))
        changed = False
        for visual in document.get("visuals", []):
            relative = Path(visual["file"])
            source = atlas / relative
            if source.suffix.lower() != ".jp2":
                continue
            target = source.with_suffix(".webp")
            convert(source, target)
            extracted_hash = visual["sha256"]
            delivery_hash = sha256(target)
            visual["extractedFile"] = visual["file"]
            visual["extractedSha256"] = extracted_hash
            visual["file"] = target.relative_to(atlas).as_posix()
            visual["sha256"] = delivery_hash
            visual["mediaType"] = "image/webp"
            converted[source] = target
            changed = True
        if changed:
            manifest_path.write_text(json.dumps(document, ensure_ascii=False, indent=2), encoding="utf-8")

    for target in converted.values():
        if not target.is_file() or target.stat().st_size == 0:
            raise RuntimeError(f"missing converted asset: {target}")
    if args.prune_originals:
        for source in converted:
            source.unlink()
    print(json.dumps({"converted": len(converted), "pruned": len(converted) if args.prune_originals else 0}))


if __name__ == "__main__":
    main()
