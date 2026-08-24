#!/usr/bin/env python3
"""Extract MES, EES and FES cards from official IMO A.1116(30) renders."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np


CATEGORIES = {
    "mes": {
        "column": (0.09, 0.205), "colour": "green",
        "pages": {
            6: ["shipboard-assembly-station", "emergency-exit-left", "emergency-exit-right"],
            7: ["door-slides-right-to-open", "door-slides-left-to-open", "turn-anticlockwise-to-open"],
            8: ["turn-clockwise-to-open", "door-pull-left-to-open", "door-pull-right-to-open"],
            9: ["push-door-right-to-open", "push-door-left-to-open"],
        },
    },
    "ees": {
        "column": (0.205, 0.32), "colour": "green",
        "pages": {
            6: ["first-aid", "emergency-telephone", "eyewash-station"],
            7: ["safety-shower", "stretcher", "medical-grab-bag"],
            8: ["oxygen-resuscitator", "emergency-escape-breathing-device", "doctor"],
            9: ["automated-external-defibrillator", "safety-equipment", "shipboard-general-alarm", "break-to-obtain-access"],
        },
    },
    "fes": {
        "column": (0.435, 0.56), "colour": "red",
        "pages": {
            6: ["fire-extinguisher", "fire-hose-reel", "collection-of-firefighting-equipment"],
            7: ["fire-alarm-call-point", "fixed-fire-extinguishing-battery", "wheeled-fire-extinguisher"],
            8: ["portable-foam-applicator", "water-fog-applicator", "fixed-fire-extinguishing-installation"],
            9: ["fixed-fire-extinguishing-bottle", "remote-release-station", "fire-monitor"],
        },
    },
}


def coloured_boxes(image, bounds, colour):
    height, width = image.shape[:2]
    left, right = int(width * bounds[0]), int(width * bounds[1])
    column = image[:, left:right]
    blue, green, red = cv2.split(column)
    if colour == "green":
        mask = (green > 85) & (green > red * 1.22) & (green > blue * 1.12)
    else:
        mask = (red > 90) & (red > green * 1.25) & (red > blue * 1.15)
    count, _labels, stats, _centroids = cv2.connectedComponentsWithStats(mask.astype(np.uint8) * 255)
    boxes = []
    for x, y, w, h, area in stats[1:count]:
        if area < 10000 or w < 140 or h < 140 or not 0.72 <= w / h <= 1.28:
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
    for category, config in CATEGORIES.items():
        for pdf_page, names in config["pages"].items():
            source = args.render_dir / f"page-{pdf_page:02d}.png"
            image = cv2.imread(str(source))
            if image is None:
                raise FileNotFoundError(source)
            boxes = coloured_boxes(image, config["column"], config["colour"])
            if len(boxes) != len(names):
                raise RuntimeError(f"{category} page {pdf_page}: expected {len(names)}, found {len(boxes)}: {boxes}")
            for name, (x, y, w, h) in zip(names, boxes):
                pad = 2
                crop = image[max(0, y-pad):min(image.shape[0], y+h+pad), max(0, x-pad):min(image.shape[1], x+w+pad)]
                target = args.output_dir / f"imo-a1116-{category}-{name}.webp"
                if not cv2.imwrite(str(target), crop, [cv2.IMWRITE_WEBP_QUALITY, 98]):
                    raise RuntimeError(f"failed to write {target}")
                records.append({
                    "file": target.name, "category": category, "symbol": name,
                    "pdfPage": pdf_page, "width": int(crop.shape[1]), "height": int(crop.shape[0]),
                    "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                })
    print(json.dumps(records, indent=2))


if __name__ == "__main__":
    main()
