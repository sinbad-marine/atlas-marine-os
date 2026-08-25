"""Build whole-table crops and row/cell coordinates for U.S. Chart No. 1."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

import pdfplumber
from PIL import Image


SOURCE_URL = "https://repository.library.noaa.gov/view/noaa/2615"
NUMBER = re.compile(r"\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?[a-z]?", re.IGNORECASE)
COLUMNS = {
    "number": (52, 83),
    "int": (83, 209),
    "description": (209, 321),
    "noaa": (321, 398),
    "nga": (398, 476),
    "other-nga": (476, 585),
    "ecdis": (585, 757),
}


def clean(value: str) -> str:
    value = re.sub(r"\(cid:\d+\)", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def normalized_box(left: float, top: float, right: float, bottom: float, crop: tuple[float, float, float, float]) -> list[float]:
    crop_left, crop_top, crop_right, crop_bottom = crop
    width, height = crop_right - crop_left, crop_bottom - crop_top
    return [round((left - crop_left) / width, 6), round((top - crop_top) / height, 6),
            round((right - crop_left) / width, 6), round((bottom - crop_top) / height, 6)]


def row_anchors(words: list[dict], page_height: float, page_number: int) -> list[tuple[float, str]]:
    anchors = sorted((word["top"], clean(word["text"])) for word in words
                     if 34 <= word["x0"] < 84 and 70 < word["top"] < page_height - 24
                     and NUMBER.fullmatch(clean(word["text"])))
    if page_number == 101:
        # The source PDF's embedded font maps 130.4–130.6 to broken CID text.
        # Their printed table headings remain extractable and provide exact anchors.
        for label, heading in (("130.4", "Isolated"), ("130.5", "Safe"), ("130.6", "Special")):
            match = next((word for word in words if word["text"] == heading and 70 <= word["x0"] < 120), None)
            if match:
                anchors.append((match["top"], label))
        anchors.sort()
    result: list[tuple[float, str]] = []
    for top, number in anchors:
        if not result or abs(top - result[-1][0]) >= 2:
            result.append((top, number))
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--pages", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--only-page", type=int)
    args = parser.parse_args()
    pdf_path, pages_root, output = args.pdf.resolve(), args.pages.resolve(), args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    if args.only_page is None:
        for stale in output.glob("table-page-*.webp"):
            stale.unlink()
    tables = []
    with pdfplumber.open(pdf_path) as document:
        # Pages 9–109 are the complete principal symbol/table section. Some
        # diagram plates intentionally omit the repeated column header, so a
        # header-presence filter would silently lose valid Q/H/M plates.
        page_numbers = [args.only_page] if args.only_page else range(9, 110)
        for page_number in page_numbers:
            page = document.pages[page_number - 1]
            words = page.extract_words(keep_blank_chars=False)
            source = pages_root / f"page-{page_number:03d}.png"
            if not source.is_file():
                raise FileNotFoundError(source)
            crop_pdf = (30.0, 38.0, 758.0, page.height - 20.0)
            with Image.open(source) as image:
                scale_x, scale_y = image.width / page.width, image.height / page.height
                crop_px = (round(crop_pdf[0] * scale_x), round(crop_pdf[1] * scale_y),
                           round(crop_pdf[2] * scale_x), round(crop_pdf[3] * scale_y))
                table_image = image.crop(crop_px).convert("RGB")
                filename = f"table-page-{page_number:03d}.webp"
                path = output / filename
                table_image.save(path, "WEBP", quality=92, method=6)
            anchors = row_anchors(words, page.height, page_number)
            rows = []
            for index, (top, number) in enumerate(anchors):
                bottom = anchors[index + 1][0] if index + 1 < len(anchors) else page.height - 24
                if bottom - top < 9:
                    continue
                band = [word for word in words if top - 4 <= (word["top"] + word["bottom"]) / 2 < bottom - 4]
                text = clean(" ".join(word["text"] for word in band))
                description = clean(" ".join(word["text"] for word in band if 209 <= word["x0"] < 321))
                row_box = normalized_box(35, top - 5, 757, bottom - 4, crop_pdf)
                cells = {name: normalized_box(left, top - 5, right, bottom - 4, crop_pdf)
                         for name, (left, right) in COLUMNS.items()}
                rows.append({"symbolNumber": number, "description": description, "context": text,
                             "topics": list(dict.fromkeys(re.findall(r"[A-Za-z][A-Za-z-]{2,}", text.casefold())))[:80],
                             "rowBox": row_box, "cellBoxes": cells})
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            tables.append({"page": page_number, "file": filename, "sha256": digest,
                           "width": table_image.width, "height": table_image.height,
                           "headings": [clean(" ".join(word["text"] for word in words if word["top"] < 70))],
                           "rows": rows})
    manifest = {"schemaVersion": "sinbad-chart-no-1-table-atlas/1", "sourceUrl": SOURCE_URL,
                "sourceDocumentSha256": hashlib.sha256(pdf_path.read_bytes()).hexdigest(),
                "rights": "Public Domain", "tableCount": len(tables), "tables": tables}
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"tables": len(tables), "rows": sum(len(table["rows"]) for table in tables)}))


if __name__ == "__main__":
    main()
