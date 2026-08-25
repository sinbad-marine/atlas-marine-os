"""Split the public-domain U.S. Chart No. 1 symbol tables into searchable row cards."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

import pdfplumber
from PIL import Image


SOURCE_URL = "https://repository.library.noaa.gov/view/noaa/2615"


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def words_in_band(words: list[dict], top: float, bottom: float) -> list[dict]:
    return [word for word in words if top <= (word["top"] + word["bottom"]) / 2 < bottom]


def numbered_rows(words: list[dict], page_height: float) -> list[tuple[float, float, str]]:
    """Return row bands from the stable left-hand symbol-number column.

    Chart No. 1 does not draw a full-width horizontal rule under every row, so
    line-based table detection silently loses most symbols.  The number column
    is present on every actual entry and is therefore the reliable row anchor.
    """
    number_pattern = re.compile(r"\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?[a-z]?", re.IGNORECASE)
    anchors: list[tuple[float, str]] = []
    for word in words:
        value = clean(word["text"])
        if 48 <= word["x0"] < 84 and 75 < word["top"] < page_height - 25 and number_pattern.fullmatch(value):
            anchors.append((word["top"], value))
    anchors.sort()
    deduplicated: list[tuple[float, str]] = []
    for top, value in anchors:
        if deduplicated and abs(top - deduplicated[-1][0]) < 2:
            continue
        deduplicated.append((top, value))
    rows: list[tuple[float, float, str]] = []
    for index, (top, value) in enumerate(deduplicated):
        bottom = deduplicated[index + 1][0] if index + 1 < len(deduplicated) else page_height - 24
        if bottom - top >= 10:
            rows.append((max(72, top - 4), bottom - 4, value))
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--pages", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    pdf_path, pages_root, output = args.pdf.resolve(), args.pages.resolve(), args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    visuals: list[dict] = []
    with pdfplumber.open(pdf_path) as document:
        for page_number, page in enumerate(document.pages, start=1):
            page_image = pages_root / f"page-{page_number:03d}.png"
            if not page_image.is_file():
                raise FileNotFoundError(page_image)
            words = page.extract_words(keep_blank_chars=False)
            labels = {word["text"] for word in words if word["top"] < 100}
            if not {"No.", "Description", "NOAA", "NGA"}.issubset(labels):
                continue
            rows = numbered_rows(words, page.height)
            if not rows:
                continue
            heading = clean(" ".join(word["text"] for word in words if word["top"] < 65))
            with Image.open(page_image) as image:
                scale_x, scale_y = image.width / page.width, image.height / page.height
                row_index = 0
                for top, bottom, number in rows:
                    band = words_in_band(words, top, bottom)
                    if not band:
                        continue
                    description = clean(" ".join(word["text"] for word in band if 209 <= word["x0"] < 321))
                    row_text = clean(" ".join(word["text"] for word in band))
                    if not description:
                        continue
                    row_index += 1
                    left = max(0, round(52 * scale_x))
                    right = min(image.width, round(757 * scale_x))
                    upper = max(0, round((top - 2) * scale_y))
                    lower = min(image.height, round((bottom + 2) * scale_y))
                    crop = image.crop((left, upper, right, lower)).convert("RGB")
                    safe_number = re.sub(r"[^0-9A-Za-z.-]+", "-", number).strip("-") or str(row_index)
                    filename = f"page-{page_number:03d}-symbol-{safe_number}-{row_index:02d}.webp"
                    path = output / filename
                    crop.save(path, "WEBP", quality=90, method=6)
                    digest = hashlib.sha256(path.read_bytes()).hexdigest()
                    topics = list(dict.fromkeys(re.findall(r"[A-Za-z][A-Za-z-]{2,}", row_text.casefold())))[:60]
                    visuals.append({
                        "visualId": f"nga-chart-no-1:card:{page_number}:{row_index}:{digest}",
                        "sha256": digest,
                        "file": filename,
                        "mediaType": "image/webp",
                        "width": crop.width,
                        "height": crop.height,
                        "sourceUrl": SOURCE_URL,
                        "occurrences": [{
                            "pdfPage": page_number,
                            "symbolNumber": number,
                            "headings": [heading] if heading else [],
                            "topics": topics,
                            "context": row_text[:4000],
                            "description": description,
                        }],
                    })
    manifest = {
        "schemaVersion": "sinbad-chart-no-1-symbol-cards/1",
        "collection": "U.S. Chart No. 1 - Individual Symbol Cards",
        "rights": "Public Domain",
        "rightsRecord": SOURCE_URL,
        "sourceDocumentSha256": hashlib.sha256(pdf_path.read_bytes()).hexdigest(),
        "sourceUrl": SOURCE_URL,
        "cardCount": len(visuals),
        "visuals": visuals,
    }
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"cards": len(visuals), "manifest": str(output / "manifest.json")}))


if __name__ == "__main__":
    main()
