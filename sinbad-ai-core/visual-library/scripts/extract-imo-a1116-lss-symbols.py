#!/usr/bin/env python3
"""Extract the modern LSS symbol column from official IMO A.1116(30) renders."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np


PAGE_SYMBOLS = {
    6: ["lifeboat", "rescue-boat", "liferaft"],
    7: ["davit-launched-liferaft", "lifebuoy", "lifebuoy-with-line"],
    8: ["lifebuoy-with-light", "lifebuoy-with-line-and-light", "lifebuoy-with-light-and-smoke"],
    9: ["lifejacket", "child-lifejacket", "infant-lifejacket", "search-and-rescue-transponder"],
    10: ["survival-craft-distress-signal", "rocket-parachute-flare", "line-throwing-appliance", "two-way-vhf-radiotelephone"],
    11: ["epirb", "embarkation-ladder", "marine-evacuation-slide", "marine-evacuation-chute"],
}


def green_boxes(image):
    height, width = image.shape[:2]
    left, right = int(width * 0.315), int(width * 0.445)
    column = image[:, left:right]
    blue, green, red = cv2.split(column)
    mask = ((green > 90) & (green > red * 1.25) & (green > blue * 1.15)).astype(np.uint8) * 255
    count, _labels, stats, _centroids = cv2.connectedComponentsWithStats(mask)
    boxes = []
    for x, y, w, h, area in stats[1:count]:
        if area < 12000 or w < 150 or h < 150:
            continue
        ratio = w / h
        if not 0.75 <= ratio <= 1.25:
            continue
        boxes.append((left + int(x), int(y), int(w), int(h)))
    return sorted(boxes, key=lambda box: box[1])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--render-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    records = []
    for pdf_page, names in PAGE_SYMBOLS.items():
        source = args.render_dir / f"page-{pdf_page:02d}.png"
        image = cv2.imread(str(source))
        if image is None:
            raise FileNotFoundError(source)
        boxes = green_boxes(image)
        if len(boxes) != len(names):
            raise RuntimeError(f"page {pdf_page}: expected {len(names)} symbols, found {len(boxes)}: {boxes}")
        for name, (x, y, w, h) in zip(names, boxes):
            pad = 2
            crop = image[max(0, y-pad):min(image.shape[0], y+h+pad), max(0, x-pad):min(image.shape[1], x+w+pad)]
            target = args.output_dir / f"imo-a1116-lss-{name}.webp"
            if not cv2.imwrite(str(target), crop, [cv2.IMWRITE_WEBP_QUALITY, 98]):
                raise RuntimeError(f"failed to write {target}")
            records.append({
                "file": target.name,
                "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                "width": int(crop.shape[1]), "height": int(crop.shape[0]),
                "pdfPage": pdf_page, "symbol": name,
            })
    print(json.dumps(records, indent=2))


if __name__ == "__main__":
    main()
