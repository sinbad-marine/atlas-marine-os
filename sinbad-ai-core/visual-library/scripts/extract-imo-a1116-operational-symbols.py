#!/usr/bin/env python3
"""Extract PSS, WSS and MSS cards from official IMO A.1116(30) renders."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np


CATEGORIES = {
    "pss": {
        "column": (0.555, 0.675), "colour": "red",
        "pages": {
            6: ["general-prohibition", "no-smoking", "no-open-flame"],
            7: ["no-thoroughfare", "not-drinking-water", "no-access-industrial-vehicles"],
            8: ["no-access-active-cardiac-devices", "no-metallic-articles-or-watches", "do-not-touch"],
            9: ["do-not-extinguish-with-water", "no-activated-mobile-phones", "no-access-metallic-implants", "no-reaching-in"],
            10: ["no-pushing", "no-sitting", "no-stepping-on-surface", "do-not-use-lift-in-fire"],
            11: ["no-dogs", "no-eating-or-drinking", "do-not-obstruct", "do-not-walk-or-stand-here"],
        },
    },
    "wss": {
        "column": (0.675, 0.855), "colour": "yellow",
        "pages": {
            6: ["general-warning", "explosive-material", "radioactive-material"],
            7: ["laser-beam", "non-ionizing-radiation", "magnetic-field"],
            8: ["floor-level-obstacle", "drop-fall", "biological-hazard"],
            9: ["low-temperature", "slippery-surface", "electricity", "guard-dog"],
            10: ["industrial-vehicles", "overhead-load", "toxic-material", "hot-surface"],
            11: ["automatic-start-up", "crushing", "overhead-obstacle"],
            12: ["flammable-material", "sharp-element"],
        },
    },
    "mss": {
        "column": (0.79, 0.98), "colour": "blue",
        "pages": {
            6: ["general-mandatory-action", "refer-to-instruction-manual", "wear-ear-protection"],
            7: ["wear-eye-protection", "connect-earth-terminal", "disconnect-mains-plug"],
            8: ["opaque-eye-protection", "wear-safety-footwear", "wear-protective-gloves"],
            9: ["wear-protective-clothing", "wash-your-hands", "use-handrail", "wear-face-shield"],
            10: ["wear-head-protection", "wear-high-visibility-clothing", "wear-mask", "wear-respiratory-protection"],
            11: ["wear-safety-harness", "wear-welding-mask"],
        },
    },
}

MSS_LAUNCH_SEQUENCE = [
    (22, "fasten-safety-belts"),
    (23, "close-and-secure-hatches"),
    (24, "start-engine"),
    (25, "lower-lifeboat-to-water"),
    (26, "lower-liferaft-to-water"),
    (27, "lower-rescue-boat-to-water"),
    (28, "release-falls"),
    (29, "start-water-spray"),
    (30, "start-air-supply"),
    (31, "release-lifeboat-gripes"),
]


def colour_mask(image, colour):
    blue, green, red = cv2.split(image)
    if colour == "red":
        return (red > 100) & (red > green * 1.3) & (red > blue * 1.2)
    if colour == "yellow":
        return (red > 140) & (green > 120) & (blue < 120) & (red > blue * 1.4) & (green > blue * 1.3)
    return (blue > 80) & (blue > green * 1.05) & (blue > red * 1.25)


def coloured_boxes(image, bounds, colour):
    _height, width = image.shape[:2]
    left, right = int(width * bounds[0]), int(width * bounds[1])
    mask = colour_mask(image[:, left:right], colour)
    count, _labels, stats, _centroids = cv2.connectedComponentsWithStats(mask.astype(np.uint8) * 255)
    boxes = []
    for x, y, w, h, area in stats[1:count]:
        minimum = 4000 if colour != "blue" else 9000
        if area < minimum or w < 100 or h < 100:
            continue
        boxes.append((left + int(x), int(y), int(w), int(h)))
    boxes = [
        box for box in boxes
        if not any(
            other != box
            and other[0] <= box[0] and other[1] <= box[1]
            and other[0] + other[2] >= box[0] + box[2]
            and other[1] + other[3] >= box[1] + box[3]
            for other in boxes
        )
    ]
    return sorted(boxes, key=lambda box: box[1])


def launch_boxes(image):
    mask = colour_mask(image, "blue")
    count, _labels, stats, _centroids = cv2.connectedComponentsWithStats(mask.astype(np.uint8) * 255)
    boxes = []
    for x, y, w, h, area in stats[1:count]:
        if area > 30000 and w > 220 and h > 220 and y > 1800:
            boxes.append((int(x), int(y), int(w), int(h)))
    return sorted(boxes, key=lambda box: (box[1], box[0]))


def write_crop(image, box, target, category, name, pdf_page, records):
    x, y, w, h = box
    pad = 4
    crop = image[max(0, y-pad):min(image.shape[0], y+h+pad), max(0, x-pad):min(image.shape[1], x+w+pad)]
    if not cv2.imwrite(str(target), crop, [cv2.IMWRITE_WEBP_QUALITY, 98]):
        raise RuntimeError(f"failed to write {target}")
    records.append({
        "file": target.name, "category": category, "symbol": name,
        "pdfPage": pdf_page, "width": int(crop.shape[1]), "height": int(crop.shape[0]),
        "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
    })


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
            for name, box in zip(names, boxes):
                target = args.output_dir / f"imo-a1116-{category}-{name}.webp"
                write_crop(image, box, target, category, name, pdf_page, records)

    image = cv2.imread(str(args.render_dir / "page-12.png"))
    boxes = launch_boxes(image)
    if len(boxes) != len(MSS_LAUNCH_SEQUENCE):
        raise RuntimeError(f"mss launch sequence: expected {len(MSS_LAUNCH_SEQUENCE)}, found {len(boxes)}: {boxes}")
    for (_number, name), box in zip(MSS_LAUNCH_SEQUENCE, boxes):
        target = args.output_dir / f"imo-a1116-mss-{name}.webp"
        write_crop(image, box, target, "mss", name, 12, records)
    print(json.dumps(records, indent=2))


if __name__ == "__main__":
    main()
