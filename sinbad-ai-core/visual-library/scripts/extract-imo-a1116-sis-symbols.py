#!/usr/bin/env python3
"""Extract SIS001-SIS052 fire-control-plan signs from IMO A.1116(30)."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np


PAGE_ROWS = {
    13: {
        "bounds": [809, 1359, 1953, 2604, 3198],
        "rows": [
            [(1, "fire-control-plan"), (9, "remote-control-fire-doors"),
             (17, "closing-device-ventilation-machinery-spaces"), (25, "emergency-fire-pump"),
             (33, "international-shore-connection"), (41, "inert-gas-installation"),
             (49, "emergency-electrical-power-battery")],
            [(2, "safety-plan"), (10, "fire-damper-accommodation-service-spaces"),
             (18, "closing-device-ventilation-cargo-spaces"), (26, "fuel-pumps-remote-shut-off"),
             (34, "fire-hydrant"), (42, "water-fire-extinguishing-system"),
             (50, "emergency-switchboard")],
            [(3, "fire-and-safety-plan"), (11, "fire-damper-machinery-spaces"),
             (19, "remote-control-closing-device-ventilation-accommodation-service-spaces"),
             (27, "lube-oil-pumps-remote-shut-off"), (35, "fire-main-section-valve"),
             (43, "foam-fire-extinguishing-system"), (51, "air-compressor-breathing-devices")],
            [(4, "ventilation-remote-control-accommodation-service-spaces"),
             (12, "fire-damper-cargo-spaces"),
             (20, "remote-control-closing-device-ventilation-machinery-spaces"),
             (28, "remote-control-bilge-pumps"), (36, "sprinkler-section-valve"),
             (44, "gas-other-than-co2-fire-extinguishing-system"),
             (52, "fire-detection-alarm-control-panel")],
        ],
    },
    14: {
        "bounds": [451, 1018, 1628, 2287, 2890],
        "rows": [
            [(5, "ventilation-remote-control-machinery-spaces"),
             (13, "remote-control-fire-damper-accommodation-service-spaces"),
             (21, "remote-control-closing-device-ventilation-cargo-spaces"),
             (29, "remote-control-emergency-bilge-pump"), (37, "powder-section-valve"),
             (45, "powder-fire-extinguishing-system")],
            [(6, "ventilation-remote-control-cargo-spaces"),
             (14, "remote-control-fire-damper-machinery-spaces"),
             (22, "remote-control-fire-pumps"), (30, "remote-control-fuel-oil-valves"),
             (38, "foam-section-valve"), (46, "co2-fire-extinguishing-system")],
            [(7, "remote-control-skylight"), (15, "remote-control-fire-damper-cargo-spaces"),
             (23, "fire-pumps"), (31, "remote-control-lube-oil-valves"),
             (39, "high-expansion-foam-supply-trunk-outlet"),
             (47, "sprinkler-or-high-pressure-water-fire-extinguishing-system")],
            [(8, "remote-control-watertight-doors"),
             (16, "closing-device-ventilation-accommodation-service-spaces"),
             (24, "emergency-fire-pump-supplied-by-emergency-power"),
             (32, "remote-control-fire-pump-valves"), (40, "water-spray-system-valves"),
             (48, "emergency-electrical-power-generator")],
        ],
    },
}

COLUMN_BOUNDS = [223, 514, 804, 1094, 1384, 1675, 1967, 2255]


def symbol_crop(image, left, right, top, bottom):
    # Signs occupy the upper part of each table cell; labels begin below it.
    region = image[top + 18:min(bottom - 8, top + 238), left + 18:right - 18]
    gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
    ys, xs = np.where(gray < 248)
    if len(xs) == 0:
        raise RuntimeError("empty SIS symbol cell")
    x0, x1 = max(0, int(xs.min()) - 5), min(region.shape[1], int(xs.max()) + 6)
    y0, y1 = max(0, int(ys.min()) - 5), min(region.shape[0], int(ys.max()) + 6)
    crop = region[y0:y1, x0:x1]
    # Square white canvas prevents variable symbol proportions from distorting cards.
    side = max(crop.shape[:2]) + 12
    canvas = np.full((side, side, 3), 255, dtype=np.uint8)
    oy, ox = (side - crop.shape[0]) // 2, (side - crop.shape[1]) // 2
    canvas[oy:oy + crop.shape[0], ox:ox + crop.shape[1]] = crop
    return canvas


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--render-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    records = []
    seen = set()
    for pdf_page, config in PAGE_ROWS.items():
        source = args.render_dir / f"page-{pdf_page}.png"
        image = cv2.imread(str(source))
        if image is None:
            raise FileNotFoundError(source)
        for row_index, entries in enumerate(config["rows"]):
            top, bottom = config["bounds"][row_index:row_index + 2]
            for column_index, (number, name) in enumerate(entries):
                left, right = COLUMN_BOUNDS[column_index:column_index + 2]
                crop = symbol_crop(image, left, right, top, bottom)
                target = args.output_dir / f"imo-a1116-sis-{number:03d}-{name}.webp"
                if not cv2.imwrite(str(target), crop, [cv2.IMWRITE_WEBP_QUALITY, 98]):
                    raise RuntimeError(f"failed to write {target}")
                seen.add(number)
                records.append({
                    "file": target.name, "category": "sis", "number": number,
                    "symbol": name, "pdfPage": pdf_page,
                    "width": int(crop.shape[1]), "height": int(crop.shape[0]),
                    "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                })
    if seen != set(range(1, 53)):
        raise RuntimeError(f"SIS catalogue incomplete: {sorted(set(range(1, 53)) - seen)}")
    print(json.dumps(sorted(records, key=lambda item: item["number"]), indent=2))


if __name__ == "__main__":
    main()
