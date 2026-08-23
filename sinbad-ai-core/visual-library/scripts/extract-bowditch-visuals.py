"""Extract and provenance-index visuals from NGA American Practical Navigator PDFs."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import OrderedDict
from pathlib import Path

from pypdf import PdfReader


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def page_context(text: str) -> dict[str, object]:
    lines = [clean_text(line) for line in text.splitlines() if clean_text(line)]
    headings = []
    for line in lines[:35]:
        if re.match(r"^(chapter|part|appendix)\s+[0-9ivxlc]+\b", line, re.I):
            headings.append(line)
        elif 3 <= len(line) <= 90 and line.isupper():
            headings.append(line)
    terms = re.findall(r"[A-Za-z][A-Za-z-]{3,}", " ".join(lines[:40]).lower())
    stop = {"that", "this", "with", "from", "which", "figure", "table", "chapter", "page"}
    topics = list(OrderedDict.fromkeys(term for term in terms if term not in stop))[:24]
    return {
        "headings": list(OrderedDict.fromkeys(headings))[:6],
        "topics": topics,
        "context": clean_text(" ".join(lines[:45]))[:2400],
    }


def extract_document(pdf: Path, volume: int, output: Path, source_url: str) -> dict[str, object]:
    reader = PdfReader(str(pdf))
    document_hash = hashlib.sha256(pdf.read_bytes()).hexdigest()
    assets = output / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    records: dict[str, dict[str, object]] = {}
    failures: list[dict[str, object]] = []

    for page_number, page in enumerate(reader.pages, start=1):
        context = page_context(page.extract_text() or "")
        for image_number in range(1, len(page.images) + 1):
            try:
                image = page.images[image_number - 1]
                data = image.data
                digest = hashlib.sha256(data).hexdigest()
                suffix = Path(image.name or "image.bin").suffix.lower() or ".bin"
                filename = f"{digest}{suffix}"
                target = assets / filename
                if not target.exists():
                    target.write_bytes(data)
                occurrence = {
                    "volume": volume,
                    "pdfPage": page_number,
                    "imageNumber": image_number,
                    "headings": context["headings"],
                    "topics": context["topics"],
                    "context": context["context"],
                }
                if digest not in records:
                    pil_image = image.image
                    records[digest] = {
                        "visualId": f"bowditch:{digest}",
                        "sha256": digest,
                        "file": f"assets/{filename}",
                        "mediaType": f"image/{(pil_image.format or suffix.lstrip('.')).lower()}",
                        "width": pil_image.width,
                        "height": pil_image.height,
                        "sourceDocument": pdf.name,
                        "sourceDocumentSha256": document_hash,
                        "sourceUrl": source_url,
                        "occurrences": [],
                    }
                records[digest]["occurrences"].append(occurrence)
            except Exception as exc:  # Preserve a complete, auditable failure list.
                failures.append({"volume": volume, "pdfPage": page_number, "imageNumber": image_number, "error": str(exc)})

    return {
        "schemaVersion": "sinbad-bowditch-visual-atlas/1",
        "volume": volume,
        "sourceDocument": pdf.name,
        "sourceDocumentSha256": document_hash,
        "sourceUrl": source_url,
        "pageCount": len(reader.pages),
        "uniqueVisualCount": len(records),
        "occurrenceCount": sum(len(item["occurrences"]) for item in records.values()),
        "failureCount": len(failures),
        "visuals": list(records.values()),
        "failures": failures,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--volume-1", type=Path, required=True)
    parser.add_argument("--volume-2", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--only-volume", type=int, choices=(1, 2))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    urls = {
        1: "https://msi.nga.mil/api/publications/download?key=16693975/SFH00000/Bowditch_Vol_1_LoRes.pdf&type=view",
        2: "https://msi.nga.mil/api/publications/download?key=16693975/SFH00000/Bowditch_Vol_2_LoRes.pdf&type=view",
    }
    for volume, pdf in ((1, args.volume_1), (2, args.volume_2)):
        if args.only_volume and volume != args.only_volume:
            continue
        result = extract_document(pdf.resolve(), volume, args.output, urls[volume])
        manifest = args.output / f"volume-{volume}-manifest.json"
        manifest.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({key: result[key] for key in ("volume", "pageCount", "uniqueVisualCount", "occurrenceCount", "failureCount")}))


if __name__ == "__main__":
    main()
