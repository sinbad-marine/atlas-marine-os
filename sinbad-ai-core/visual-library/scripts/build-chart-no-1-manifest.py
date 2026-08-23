"""Build a page-level searchable visual atlas for official NGA Chart No. 1."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

from PIL import Image
from pypdf import PdfReader


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--assets", type=Path, required=True)
    args = parser.parse_args()
    pdf, assets = args.pdf.resolve(), args.assets.resolve()
    reader = PdfReader(str(pdf))
    visuals = []
    for page_number, page in enumerate(reader.pages, start=1):
        image_path = assets / f"page-{page_number:03d}.png"
        if not image_path.is_file():
            raise FileNotFoundError(image_path)
        data = image_path.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        lines = [clean(line) for line in (page.extract_text() or "").splitlines() if clean(line)]
        headings = [line for line in lines[:30] if 2 < len(line) < 100 and (line.isupper() or re.match(r"^(appendix|index|[A-Z]\.)", line))][:8]
        words = re.findall(r"[A-Za-z][A-Za-z-]{2,}", " ".join(lines[:80]).lower())
        topics = list(dict.fromkeys(word for word in words if word not in {"the", "and", "for", "with", "chart", "symbol"}))[:40]
        with Image.open(image_path) as image:
            width, height = image.size
        visuals.append({
            "visualId": f"nga-chart-no-1:page:{page_number}:{digest}",
            "sha256": digest,
            "file": image_path.name,
            "mediaType": "image/png",
            "width": width,
            "height": height,
            "sourceUrl": "https://msi.nga.mil/api/publications/download?key=16694005/SFH00000/ChartNo1.pdf&type=view",
            "occurrences": [{
                "pdfPage": page_number,
                "printedPage": next((int(value) for value in reversed(lines[-8:]) if value.isdigit()), None),
                "headings": headings,
                "topics": topics,
                "context": clean(" ".join(lines[:100]))[:4000],
            }],
        })
    manifest = {
        "schemaVersion": "sinbad-chart-no-1-visual-atlas/1",
        "collection": "NGA Chart No. 1 - Nautical Chart Symbols, Abbreviations and Terms",
        "sourceDocumentSha256": hashlib.sha256(pdf.read_bytes()).hexdigest(),
        "sourceUrl": "https://msi.nga.mil/api/publications/download?key=16694005/SFH00000/ChartNo1.pdf&type=view",
        "pageCount": len(reader.pages),
        "uniqueVisualCount": len(visuals),
        "visuals": visuals,
    }
    (assets / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"pages": len(visuals), "manifest": str(assets / 'manifest.json')}))


if __name__ == "__main__":
    main()
