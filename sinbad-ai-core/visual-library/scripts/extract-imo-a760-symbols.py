#!/usr/bin/env python3
"""Extract individual Annex 2 symbol cards from the official IMO A.760(18) scan."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import cv2


SYMBOLS = {
    6: ["lifeboat", "rescue-boat", "liferaft"],
    7: ["davit-launched-liferaft", "embarkation-ladder", "evacuation-slide", "lifebuoy"],
    8: ["lifebuoy-with-line", "lifebuoy-with-light", "lifebuoy-with-light-and-smoke", "lifejacket"],
    9: ["emergency-exit-indicator", "exit", "emergency-exit"],
    10: ["muster-station", "embarkation-station", "direction-indicator"],
    11: ["radar-transponder-sart", "survival-craft-pyrotechnics", "rocket-parachute-flares", "line-throwing-appliance"],
    12: ["child-lifejacket", "immersion-suit", "survival-craft-portable-radio", "epirb"],
}

ROW_BANDS = {
    6: [(0.25, 0.43), (0.46, 0.63), (0.65, 0.81)],
    7: [(0.16, 0.35), (0.36, 0.52), (0.54, 0.70), (0.72, 0.88)],
    8: [(0.16, 0.36), (0.36, 0.53), (0.53, 0.70), (0.70, 0.88)],
    9: [(0.17, 0.38), (0.38, 0.58), (0.58, 0.78)],
    10: [(0.17, 0.42), (0.42, 0.63), (0.63, 0.84)],
    11: [(0.16, 0.35), (0.35, 0.53), (0.53, 0.71), (0.71, 0.89)],
    12: [(0.16, 0.35), (0.35, 0.53), (0.53, 0.71), (0.71, 0.89)],
}


def symbol_boxes(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape
    left, right = int(width * 0.57), int(width * 0.84)
    mask = gray[:, left:right] < 175
    active = (mask.sum(axis=1) > int((right - left) * 0.16)).astype("uint8")
    active = cv2.morphologyEx(active[:, None], cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 85)))[:, 0]
    rows = active.nonzero()[0].tolist()
    if not rows:
        return []
    rows = sorted(set(map(int, rows)))
    groups = []
    start = previous = rows[0]
    for row in rows[1:]:
        if row > previous + 1:
            groups.append((start, previous))
            start = row
        previous = row
    groups.append((start, previous))
    boxes = []
    for top, bottom in groups:
        if bottom - top < height * 0.09 or top < height * 0.15 or bottom > height * 0.92:
            continue
        ys, xs = (gray[top:bottom + 1, left:right] < 190).nonzero()
        if len(xs) == 0:
            continue
        x0, x1 = left + int(xs.min()), left + int(xs.max())
        y0, y1 = top + int(ys.min()), top + int(ys.max())
        boxes.append((x0, y0, x1 - x0 + 1, y1 - y0 + 1))
    return boxes


def fixed_symbol_boxes(image, pdf_page):
    height, width = image.shape[:2]
    left, right = int(width * 0.59), int(width * 0.84)
    return [(left, int(height * top), right - left, int(height * (bottom - top))) for top, bottom in ROW_BANDS[pdf_page]]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--render-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    records = []
    for pdf_page, names in SYMBOLS.items():
        source = args.render_dir / f"page-{pdf_page:02d}.png"
        image = cv2.imread(str(source))
        if image is None:
            raise FileNotFoundError(source)
        boxes = fixed_symbol_boxes(image, pdf_page)
        if len(boxes) != len(names):
            raise RuntimeError(f"page {pdf_page}: expected {len(names)} symbols, found {len(boxes)}: {boxes}")
        for name, (x, y, w, h) in zip(names, boxes):
            pad = max(18, int(min(w, h) * 0.06))
            crop = image[max(0, y-pad):min(image.shape[0], y+h+pad), max(0, x-pad):min(image.shape[1], x+w+pad)]
            target = args.output_dir / f"imo-a760-{name}.webp"
            if not cv2.imwrite(str(target), crop, [cv2.IMWRITE_WEBP_QUALITY, 95]):
                raise RuntimeError(f"failed to write {target}")
            payload = target.read_bytes()
            records.append({
                "file": target.name,
                "sha256": hashlib.sha256(payload).hexdigest(),
                "width": int(crop.shape[1]),
                "height": int(crop.shape[0]),
                "pdfPage": pdf_page,
                "symbol": name,
            })
    print(json.dumps(records, indent=2))


if __name__ == "__main__":
    main()
