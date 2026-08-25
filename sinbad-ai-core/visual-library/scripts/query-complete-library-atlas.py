"""Query or resolve immutable assets from the private SINBAD visual atlas."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import re
import sqlite3
import sys
from pathlib import Path


IMO_A760_PAGES = {
    "lifeboat": 6, "rescue-boat": 6, "liferaft": 6,
    "davit-launched-liferaft": 7, "embarkation-ladder": 7,
    "evacuation-slide": 7, "lifebuoy": 7,
    "lifebuoy-with-line": 8, "lifebuoy-with-light": 8,
    "lifebuoy-with-light-and-smoke": 8, "lifejacket": 8,
    "emergency-exit-indicator": 9, "exit": 9, "emergency-exit": 9,
    "muster-station": 10, "embarkation-station": 10, "direction-indicator": 10,
    "radar-transponder-sart": 11, "survival-craft-pyrotechnics": 11,
    "rocket-parachute-flares": 11, "line-throwing-appliance": 11,
    "child-lifejacket": 12, "immersion-suit": 12,
    "survival-craft-portable-radio": 12, "epirb": 12,
}

IMO_A760_ALIASES = {
    "filika": "lifeboat", "kurtarma botu": "rescue-boat", "can salı": "liferaft",
    "can sali": "liferaft", "can simidi": "lifebuoy", "can yeleği": "lifejacket",
    "can yelegi": "lifejacket", "toplanma istasyonu": "mes-shipboard-assembly-station",
    "binme istasyonu": "embarkation-station", "dalma giysisi": "immersion-suit",
    "çocuk can yeleği": "child-lifejacket", "cocuk can yelegi": "child-lifejacket",
    "sart": "search-and-rescue-transponder", "radar transponder": "search-and-rescue-transponder",
    "acil çıkış": "mes-emergency-exit", "acil cikis": "mes-emergency-exit",
    "ilk yardım": "ees-first-aid", "ilk yardim": "ees-first-aid",
    "acil telefon": "ees-emergency-telephone", "göz duşu": "ees-eyewash-station",
    "goz dusu": "ees-eyewash-station", "sedye": "ees-stretcher",
    "eebd": "ees-emergency-escape-breathing-device",
    "yangın söndürücü": "fes-fire-extinguisher", "yangin sondurucu": "fes-fire-extinguisher",
    "yangın hortumu": "fes-fire-hose-reel", "yangin hortumu": "fes-fire-hose-reel",
    "yangın alarm butonu": "fes-fire-alarm-call-point", "yangin alarm butonu": "fes-fire-alarm-call-point",
    "sigara içilmez": "pss-no-smoking", "sigara icilmez": "pss-no-smoking",
    "açık alev yasak": "pss-no-open-flame", "acik alev yasak": "pss-no-open-flame",
    "yanıcı madde": "wss-flammable-material", "yanici madde": "wss-flammable-material",
    "elektrik tehlikesi": "wss-electricity", "biyolojik tehlike": "wss-biological-hazard",
    "baret tak": "mss-wear-head-protection", "koruyucu gözlük": "mss-wear-eye-protection",
    "koruyucu gozluk": "mss-wear-eye-protection", "emniyet kemerini bağla": "mss-fasten-safety-belts",
    "emniyet kemerini bagla": "mss-fasten-safety-belts",
    "filikayı suya indir": "mss-lower-lifeboat-to-water", "filikayi suya indir": "mss-lower-lifeboat-to-water",
    "can salını suya indir": "mss-lower-liferaft-to-water", "can salini suya indir": "mss-lower-liferaft-to-water",
    "yangın kontrol planı": "sis-001-fire-control-plan", "yangin kontrol plani": "sis-001-fire-control-plan",
    "yangın damperi": "sis-011-fire-damper-machinery-spaces", "yangin damperi": "sis-011-fire-damper-machinery-spaces",
    "acil yangın pompası": "sis-025-emergency-fire-pump", "acil yangin pompasi": "sis-025-emergency-fire-pump",
    "yangın hidrantı": "sis-034-fire-hydrant", "yangin hidranti": "sis-034-fire-hydrant",
    "yangın ana devre vanası": "sis-035-fire-main-section-valve", "yangin ana devre vanasi": "sis-035-fire-main-section-valve",
    "sprinkler bölüm vanası": "sis-036-sprinkler-section-valve", "sprinkler bolum vanasi": "sis-036-sprinkler-section-valve",
    "köpük bölüm vanası": "sis-038-foam-section-valve", "kopuk bolum vanasi": "sis-038-foam-section-valve",
    "inert gaz sistemi": "sis-041-inert-gas-installation",
    "co2 söndürme sistemi": "sis-046-co2-fire-extinguishing-system", "co2 sondurme sistemi": "sis-046-co2-fire-extinguishing-system",
    "acil jeneratör": "sis-048-emergency-electrical-power-generator", "acil jenerator": "sis-048-emergency-electrical-power-generator",
    "acil akü": "sis-049-emergency-electrical-power-battery", "acil aku": "sis-049-emergency-electrical-power-battery",
    "yangın alarm paneli": "sis-052-fire-detection-alarm-control-panel", "yangin alarm paneli": "sis-052-fire-detection-alarm-control-panel",
}

IMO_A1116_LSS_PAGES = {
    "lifeboat": 6, "rescue-boat": 6, "liferaft": 6,
    "davit-launched-liferaft": 7, "lifebuoy": 7, "lifebuoy-with-line": 7,
    "lifebuoy-with-light": 8, "lifebuoy-with-line-and-light": 8,
    "lifebuoy-with-light-and-smoke": 8, "lifejacket": 9,
    "child-lifejacket": 9, "infant-lifejacket": 9,
    "search-and-rescue-transponder": 9, "survival-craft-distress-signal": 10,
    "rocket-parachute-flare": 10, "line-throwing-appliance": 10,
    "two-way-vhf-radiotelephone": 10, "epirb": 11,
    "embarkation-ladder": 11, "marine-evacuation-slide": 11,
    "marine-evacuation-chute": 11,
}

IMO_A1116_SAFETY_PAGES = {
    "mes-shipboard-assembly-station": 6, "mes-emergency-exit-left": 6, "mes-emergency-exit-right": 6,
    "mes-door-slides-right-to-open": 7, "mes-door-slides-left-to-open": 7, "mes-turn-anticlockwise-to-open": 7,
    "mes-turn-clockwise-to-open": 8, "mes-door-pull-left-to-open": 8, "mes-door-pull-right-to-open": 8,
    "mes-push-door-right-to-open": 9, "mes-push-door-left-to-open": 9,
    "ees-first-aid": 6, "ees-emergency-telephone": 6, "ees-eyewash-station": 6,
    "ees-safety-shower": 7, "ees-stretcher": 7, "ees-medical-grab-bag": 7,
    "ees-oxygen-resuscitator": 8, "ees-emergency-escape-breathing-device": 8, "ees-doctor": 8,
    "ees-automated-external-defibrillator": 9, "ees-safety-equipment": 9,
    "ees-shipboard-general-alarm": 9, "ees-break-to-obtain-access": 9,
    "fes-fire-extinguisher": 6, "fes-fire-hose-reel": 6, "fes-collection-of-firefighting-equipment": 6,
    "fes-fire-alarm-call-point": 7, "fes-fixed-fire-extinguishing-battery": 7, "fes-wheeled-fire-extinguisher": 7,
    "fes-portable-foam-applicator": 8, "fes-water-fog-applicator": 8, "fes-fixed-fire-extinguishing-installation": 8,
    "fes-fixed-fire-extinguishing-bottle": 9, "fes-remote-release-station": 9, "fes-fire-monitor": 9,
}

IMO_A1116_OPERATIONAL_PAGES = {
    **{f"pss-{name}": page for page, names in {
        6: ["general-prohibition", "no-smoking", "no-open-flame"],
        7: ["no-thoroughfare", "not-drinking-water", "no-access-industrial-vehicles"],
        8: ["no-access-active-cardiac-devices", "no-metallic-articles-or-watches", "do-not-touch"],
        9: ["do-not-extinguish-with-water", "no-activated-mobile-phones", "no-access-metallic-implants", "no-reaching-in"],
        10: ["no-pushing", "no-sitting", "no-stepping-on-surface", "do-not-use-lift-in-fire"],
        11: ["no-dogs", "no-eating-or-drinking", "do-not-obstruct", "do-not-walk-or-stand-here"],
    }.items() for name in names},
    **{f"wss-{name}": page for page, names in {
        6: ["general-warning", "explosive-material", "radioactive-material"],
        7: ["laser-beam", "non-ionizing-radiation", "magnetic-field"],
        8: ["floor-level-obstacle", "drop-fall", "biological-hazard"],
        9: ["low-temperature", "slippery-surface", "electricity", "guard-dog"],
        10: ["industrial-vehicles", "overhead-load", "toxic-material", "hot-surface"],
        11: ["automatic-start-up", "crushing", "overhead-obstacle"],
        12: ["flammable-material", "sharp-element"],
    }.items() for name in names},
    **{f"mss-{name}": page for page, names in {
        6: ["general-mandatory-action", "refer-to-instruction-manual", "wear-ear-protection"],
        7: ["wear-eye-protection", "connect-earth-terminal", "disconnect-mains-plug"],
        8: ["opaque-eye-protection", "wear-safety-footwear", "wear-protective-gloves"],
        9: ["wear-protective-clothing", "wash-your-hands", "use-handrail", "wear-face-shield"],
        10: ["wear-head-protection", "wear-high-visibility-clothing", "wear-mask", "wear-respiratory-protection"],
        11: ["wear-safety-harness", "wear-welding-mask"],
        12: ["fasten-safety-belts", "close-and-secure-hatches", "start-engine", "lower-lifeboat-to-water",
             "lower-liferaft-to-water", "lower-rescue-boat-to-water", "release-falls", "start-water-spray",
             "start-air-supply", "release-lifeboat-gripes"],
    }.items() for name in names},
}


def curated_symbol_root() -> Path:
    return Path(__file__).resolve().parents[1] / "assets" / "curated-imo-symbols"


def curated_symbol_collections():
    assets = Path(__file__).resolve().parents[1] / "assets"
    sis_root = assets / "curated-imo-a1116-sis"
    sis_pages = {}
    for path in sis_root.glob("imo-a1116-sis-*.webp"):
        name = path.stem.removeprefix("imo-a1116-")
        number = int(name.split("-", 2)[1])
        sis_pages[name] = 13 if ((number - 1) // 4) % 2 == 0 else 14
    return (
        (sis_root, "imo-a1116-", sis_pages,
         "IMO Resolution A.1116(30)",
         "https://wwwcdn.imo.org/localresources/en/KnowledgeCentre/IndexofIMOResolutions/AssemblyDocuments/A.1116%2830%29.pdf", 500,
         "imo-a1116-sis"),
        (assets / "curated-imo-a1116-operational", "imo-a1116-", IMO_A1116_OPERATIONAL_PAGES,
         "IMO Resolution A.1116(30)",
         "https://wwwcdn.imo.org/localresources/en/KnowledgeCentre/IndexofIMOResolutions/AssemblyDocuments/A.1116%2830%29.pdf", 400,
         "imo-a1116-operational"),
        (assets / "curated-imo-a1116-safety", "imo-a1116-", IMO_A1116_SAFETY_PAGES,
         "IMO Resolution A.1116(30)",
         "https://wwwcdn.imo.org/localresources/en/KnowledgeCentre/IndexofIMOResolutions/AssemblyDocuments/A.1116%2830%29.pdf", 300,
         "imo-a1116-safety"),
        (assets / "curated-imo-a1116-lss", "imo-a1116-lss-", IMO_A1116_LSS_PAGES,
         "IMO Resolution A.1116(30)",
         "https://wwwcdn.imo.org/localresources/en/KnowledgeCentre/IndexofIMOResolutions/AssemblyDocuments/A.1116%2830%29.pdf", 200,
         "imo-a1116-lss"),
        (assets / "curated-imo-symbols", "imo-a760-", IMO_A760_PAGES,
         "IMO Resolution A.760(18)",
         "https://wwwcdn.imo.org/localresources/en/KnowledgeCentre/IndexofIMOResolutions/AssemblyDocuments/A.760%2818%29.pdf", 100,
         "imo-a760"),
    )


def curated_symbol_query(value: str, limit: int) -> list[dict]:
    normalized = value.casefold()
    if not any(token in normalized for token in ("symbol", "sembol", "işaret", "isaret", "pictogram", "piktogram")):
        return []
    needles = set(re.findall(r"[^\W\d_][\w-]{2,}", normalized, re.UNICODE))
    preferred = set()
    for phrase, canonical in IMO_A760_ALIASES.items():
        if phrase in normalized:
            needles.update(canonical.split("-"))
            preferred.add(canonical)
    scored = []
    for root, prefix, pages, title, source_url, priority, collection_id in curated_symbol_collections():
        for path in root.glob(f"{prefix}*.webp"):
            name = path.stem.removeprefix(prefix)
            score = len(needles.intersection(name.split("-"))) + (1000 if name in preferred else 0)
            if score:
                scored.append((score + priority, name, path, pages, title, source_url, collection_id))
    result = []
    for _score, name, path, pages, title, source_url, collection_id in sorted(scored, key=lambda item: (-item[0], item[1]))[:limit]:
        digest = __import__("hashlib").sha256(path.read_bytes()).hexdigest()
        page = pages[name]
        resolution = collection_id
        document_hash = "imo-resolution-a760-18" if collection_id == "imo-a760" else "imo-resolution-a1116-30"
        result.append({
            "visual_key": f"curated:{resolution}:{name}", "visual_type": "object",
            "document_hash": document_hash, "page_number": page,
            "image_number": None, "asset_hash": digest,
            "file": str(path), "title": title, "volume": None,
            "heading": name.replace("-", " ").title(),
            "context": "Official IMO shipboard safety, life-saving or fire-control-plan symbol.",
            "topics": [name, title, "shipboard safety symbol"],
            "sourcePaths": [source_url],
            "rank": -1000.0,
            "assetUrl": f"http://127.0.0.1:31983/visuals/assets/{digest}.webp",
        })
    return result


def curated_navigation_query(value: str, limit: int) -> list[dict]:
    root = Path(__file__).resolve().parents[1] / "assets" / "curated-navigation-verified"
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        return []
    normalized = value.casefold()
    phrase_groups = {
        "anchor-detail-preparation": ("demir hazırlığı", "demir hazirligi", "halat manevrası", "halat manevrasi", "sea and anchor detail"),
        "bridge-radar-console": ("radar konsolu", "radar ekranı", "radar ekrani", "gemi radarı", "gemi radari", "spa-25g"),
        "sextant-sun-sight": ("sekstant", "sextant", "güneş rasadı", "gunes rasadi", "göksel seyir", "goksel seyir"),
        "bridge-to-bridge-communications": ("köprüüstü haberleşme", "kopruustu haberlesme", "telsiz vardiyası", "telsiz vardiyasi", "bridge-to-bridge communications"),
        "magnetic-compass-binnacle": ("manyetik pusula", "pusula dolabı", "pusula dolabi", "binnacle", "gemi pusulası", "gemi pusulasi"),
        "integrated-navigation-bridge": ("ecdis", "elektronik harita konsolu", "elektronik harita ekranı", "elektronik harita ekrani", "entegre köprüüstü", "entegre kopruustu", "integrated navigation bridge"),
        "ais-ship-tracking-display": ("ais ekranı", "ais ekrani", "ais cihazı", "ais cihazi", "otomatik tanımlama sistemi", "otomatik tanimlama sistemi", "automatic identification system", "ship tracking display"),
        "gyrocompass-bearing-operation": ("cayro pusula", "cayro tekrarlayıcı", "cayro tekrarlayici", "gyrocompass", "gyro compass", "kerteriz alma"),
    }
    preferred = {key for key, phrases in phrase_groups.items() if any(phrase in normalized for phrase in phrases)}
    if re.search(r"\bais\b", normalized):
        preferred.add("ais-ship-tracking-display")
    if not preferred:
        return []
    visuals = json.loads(manifest_path.read_text(encoding="utf-8"))["visuals"]
    result = []
    for item in visuals:
        if item["id"] not in preferred:
            continue
        path = root / item["file"]
        digest = __import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({
            "visual_key": f"curated:navigation:{item['id']}", "visual_type": "object",
            "document_hash": "curated-navigation-verified", "page_number": None,
            "image_number": None, "asset_hash": digest, "file": str(path),
            "title": item["credit"], "volume": None, "heading": item["heading"],
            "context": f"Verified navigation photograph. {item['license']}",
            "topics": item["topics"], "sourcePaths": [item["sourceUrl"]], "rank": -2000.0,
            "assetUrl": f"http://127.0.0.1:31983/visuals/assets/{digest}.webp",
        })
    return result[:limit]


def curated_safety_query(value: str, limit: int) -> list[dict]:
    root = Path(__file__).resolve().parents[1] / "assets" / "curated-safety"
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        return []
    normalized = value.casefold()
    phrase_groups = {
        "lifebuoy-scarborough.jpg": ("can simid", "can simit", "lifebuoy", "life buoy", "life ring"),
        "inflatable-life-raft-us-navy.jpg": ("can sal", "liferaft", "life raft", "şişme sal", "sisme sal"),
        "inflated-life-raft-us-navy-historic.jpg": ("açılmış can sal", "acilmis can sal", "şişirilmiş can sal", "sisirilmis can sal", "open life raft"),
        "fully-enclosed-lifeboat.jpg": ("tam kapalı filika", "tam kapali filika", "fully enclosed lifeboat"),
        "lifeboats-ready-to-launch.jpg": ("filika indirme", "filikaları indir", "filikalari indir", "lifeboat launching", "lifeboats ready"),
        "life-jacket-inspection-uscg.jpg": ("can yeleğ", "can yeleg", "life jacket", "lifejacket", "personal flotation device"),
        "epirb-ferry-vi.jpg": ("epirb", "emergency position indicating radio beacon"),
        "sart-radar-transponder.jpg": ("sart", "search and rescue transponder", "radar transponder"),
        "marine-evacuation-life-raft-pod.jpg": ("can salı pod", "can sali pod", "can salı konteyner", "can sali konteyner", "marine evacuation system"),
        "mob-distress-marker-lights.jpg": ("can simidi ış", "can simidi is", "mob işaret", "mob isaret", "distress marker light"),
        "rescue-boat-retrieval.jpg": ("kurtarma bot", "rescue boat", "arama kurtarma bot"),
        "immersion-suit-uscg.jpg": ("dalma giysi", "terk giysi", "immersion suit", "survival suit"),
        "eebd-training-us-navy.jpg": ("eebd", "acil kaçış solunum", "acil kacis solunum", "escape breathing device"),
        "helicopter-rescue-hoist.jpg": ("helikopterle kurtarma", "helikopter tahliye", "kurtarma vinci", "rescue hoist"),
        "shipboard-firefighting-drill.jpg": ("gemi yangın ekib", "gemi yangin ekib", "yangıncı teçhizat", "yanginci techizat", "shipboard firefighting", "firefighting team"),
    }
    matches = {
        filename: max((len(phrase) for phrase in phrases if phrase in normalized), default=0)
        for filename, phrases in phrase_groups.items()
    }
    if not any(matches.values()):
        return []
    visuals = json.loads(manifest_path.read_text(encoding="utf-8"))["visuals"]
    ranked = sorted(
        (item for item in visuals if matches.get(item["file"], 0)),
        key=lambda item: (-matches[item["file"]], item["file"]),
    )
    result = []
    for item in ranked[:limit]:
        path = root / item["file"]
        occurrence = item["occurrences"][0]
        digest = __import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({
            "visual_key": f"curated:safety:{path.stem}", "visual_type": "object",
            "document_hash": "curated-safety-verified", "page_number": None,
            "image_number": None, "asset_hash": digest, "file": str(path),
            "title": occurrence["sourceLabel"], "volume": None,
            "heading": occurrence["headings"][0], "context": occurrence["context"],
            "topics": occurrence["topics"], "sourcePaths": [item["sourceUrl"]],
            "rank": -3000.0,
            "assetUrl": f"http://127.0.0.1:31983/visuals/assets/{digest}.webp",
        })
    return result


def curated_weather_query(value: str, limit: int) -> list[dict]:
    root = Path(__file__).resolve().parents[1] / "assets" / "curated-weather-verified"
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        return []
    normalized = value.casefold()
    phrase_groups = {
        "marine-fog-harbor": ("deniz sisi", "limanda sis", "kısıtlı görüş", "kisitli gorus", "marine fog", "harbor fog", "restricted visibility"),
        "marine-thunderstorm-lightning": ("denizde yıldırım", "denizde yildirim", "denizde şimşek", "denizde simsek", "gök gürültülü fırtına", "gok gurultulu firtina", "marine thunderstorm", "lightning at sea"),
        "ship-heavy-seas": ("ağır deniz", "agir deniz", "kaba deniz", "büyük dalga", "buyuk dalga", "heavy seas", "rough sea", "sea state"),
    }
    preferred = {key for key, phrases in phrase_groups.items() if any(phrase in normalized for phrase in phrases)}
    if not preferred:
        return []
    visuals = json.loads(manifest_path.read_text(encoding="utf-8"))["visuals"]
    result = []
    for item in visuals:
        if item["id"] not in preferred:
            continue
        path = root / item["file"]
        digest = __import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({
            "visual_key": f"curated:weather:{item['id']}", "visual_type": "object",
            "document_hash": "curated-weather-verified", "page_number": None,
            "image_number": None, "asset_hash": digest, "file": str(path),
            "title": item["credit"], "volume": None, "heading": item["heading"],
            "context": f"Verified marine-weather photograph. {item['license']}",
            "topics": item["topics"], "sourcePaths": [item["sourceUrl"]], "rank": -2500.0,
            "assetUrl": f"http://127.0.0.1:31983/visuals/assets/{digest}.webp",
        })
    return result[:limit]


def curated_aids_query(value: str, limit: int) -> list[dict]:
    root = Path(__file__).resolve().parents[1] / "assets" / "curated-aids-verified"
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        return []
    normalized = value.casefold()
    phrase_groups = {
        "cardinal-buoys-deployment": ("kardinal şamandıra", "kardinal samandira", "kuzey kardinal", "batı kardinal", "bati kardinal", "cardinal buoy", "north cardinal", "west cardinal"),
        "south-cardinal-buoy": ("güney kardinal", "guney kardinal", "south cardinal", "düdüklü şamandıra", "duduklu samandira"),
        "port-hand-lateral-buoy": ("iskele şamandıra", "iskele samandira", "iskele lateral", "kırmızı lateral", "kirmizi lateral", "port hand buoy", "port lateral"),
        "starboard-hand-lateral-buoy": ("sancak şamandıra", "sancak samandira", "sancak lateral", "yeşil lateral", "yesil lateral", "starboard hand buoy", "starboard lateral"),
        "safe-water-mark": ("emniyetli su işareti", "emniyetli su isareti", "güvenli su şamandıra", "guvenli su samandira", "orta kanal şamandıra", "orta kanal samandira", "safe water mark", "mid-channel mark"),
        "isolated-danger-mark": ("izole tehlike işareti", "izole tehlike isareti", "münferit tehlike", "munferit tehlike", "isolated danger mark", "isolated danger beacon"),
    }
    preferred = {key for key, phrases in phrase_groups.items() if any(phrase in normalized for phrase in phrases)}
    if "south-cardinal-buoy" in preferred:
        preferred.discard("cardinal-buoys-deployment")
    if not preferred:
        return []
    result = []
    for item in json.loads(manifest_path.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:
            continue
        path = root / item["file"]
        digest = __import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({
            "visual_key": f"curated:aids:{item['id']}", "visual_type": "object",
            "document_hash": "curated-aids-verified", "page_number": None,
            "image_number": None, "asset_hash": digest, "file": str(path),
            "title": item["credit"], "volume": None, "heading": item["heading"],
            "context": f"Verified aid-to-navigation photograph. {item['license']}",
            "topics": item["topics"], "sourcePaths": [item["sourceUrl"]], "rank": -2500.0,
            "assetUrl": f"http://127.0.0.1:31983/visuals/assets/{digest}.webp",
        })
    return result[:limit]


def curated_lighthouse_query(value: str, limit: int) -> list[dict]:
    root = Path(__file__).resolve().parents[1] / "assets" / "curated-lighthouse-verified"
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        return []
    normalized = value.casefold()
    phrase_groups = {
        "harbor-lighthouse": ("deniz feneri", "liman feneri", "seyir feneri", "lighthouse", "harbor light"),
        "lighthouse-optics": ("fener merceği", "fener mercegi", "deniz feneri merceği", "deniz feneri mercegi", "fener optiği", "fener optigi", "fresnel lens", "lighthouse lens", "lighthouse optics"),
        "lightship-carpentaria": ("fener gemisi", "yüzer deniz feneri", "yuzer deniz feneri", "lightship", "floating lighthouse"),
    }
    preferred = {key for key, phrases in phrase_groups.items() if any(phrase in normalized for phrase in phrases)}
    if "lighthouse-optics" in preferred or "lightship-carpentaria" in preferred:
        preferred.discard("harbor-lighthouse")
    if not preferred:
        return []
    result = []
    for item in json.loads(manifest_path.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:
            continue
        path = root / item["file"]
        digest = __import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({
            "visual_key": f"curated:lighthouse:{item['id']}", "visual_type": "object",
            "document_hash": "curated-lighthouse-verified", "page_number": None,
            "image_number": None, "asset_hash": digest, "file": str(path),
            "title": item["credit"], "volume": None, "heading": item["heading"],
            "context": f"Verified lighthouse photograph. {item['license']}",
            "topics": item["topics"], "sourcePaths": [item["sourceUrl"]], "rank": -2500.0,
            "assetUrl": f"http://127.0.0.1:31983/visuals/assets/{digest}.webp",
        })
    return result[:limit]


def curated_deck_query(value: str, limit: int) -> list[dict]:
    root = Path(__file__).resolve().parents[1] / "assets" / "curated-deck-verified"
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        return []
    normalized = value.casefold()
    phrase_groups = {
        "anchor-windlass": ("demir ırgat", "demir irgat", "zincir ırgat", "zincir irgat", "demir makinesi", "anchor windlass"),
        "mooring-winch": ("bağlama vinci", "baglama vinci", "halat vinci", "ırgat freni", "irgat freni", "mooring winch"),
        "ship-bitts": ("gemi babası", "gemi babasi", "bağlama babası", "baglama babasi", "halat volta", "ship bitts", "mooring bitts"),
        "adjustable-fairlead": ("ayarlanabilir kurtağzı", "ayarlanabilir kurtagzi", "halat kılavuzu", "halat kilavuzu", "iskota arabası", "iskota arabasi", "adjustable fairlead", "sheet lead"),
    }
    preferred = {key for key, phrases in phrase_groups.items() if any(phrase in normalized for phrase in phrases)}
    if not preferred:
        return []
    result = []
    for item in json.loads(manifest_path.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:
            continue
        path = root / item["file"]
        digest = __import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({
            "visual_key": f"curated:deck:{item['id']}", "visual_type": "object",
            "document_hash": "curated-deck-verified", "page_number": None,
            "image_number": None, "asset_hash": digest, "file": str(path),
            "title": item["credit"], "volume": None, "heading": item["heading"],
            "context": f"Verified deck-equipment photograph. {item['license']}",
            "topics": item["topics"], "sourcePaths": [item["sourceUrl"]], "rank": -2500.0,
            "assetUrl": f"http://127.0.0.1:31983/visuals/assets/{digest}.webp",
        })
    return result[:limit]


def curated_engine_room_query(value: str, limit: int) -> list[dict]:
    root = Path(__file__).resolve().parents[1] / "assets" / "curated-engine-room-verified"
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        return []
    normalized = value.casefold()
    phrase_groups = {
        "main-engine": ("gemi ana makine", "ana makine silindir", "ship main engine", "marine diesel engine"),
        "engine-room": ("gemi makine dairesi", "makine dairesi genel", "ship engine room", "machinery space"),
        "boiler-opening": ("kazan muayene kapağı", "kazan muayene kapagi", "gemi kazanı açıklığı", "gemi kazani acikligi", "boiler opening", "boiler inspection access"),
        "steam-engine-room": ("gemi buhar makinesi", "buharlı gemi makine", "buharli gemi makine", "marine steam engine", "steamship engine room"),
    }
    preferred = {key for key, phrases in phrase_groups.items() if any(phrase in normalized for phrase in phrases)}
    if not preferred:
        return []
    result = []
    for item in json.loads(manifest_path.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:
            continue
        path = root / item["file"]
        digest = __import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({
            "visual_key": f"curated:engine-room:{item['id']}", "visual_type": "object",
            "document_hash": "curated-engine-room-verified", "page_number": None,
            "image_number": None, "asset_hash": digest, "file": str(path),
            "title": item["credit"], "volume": None, "heading": item["heading"],
            "context": f"Verified engine-room photograph. {item['license']}",
            "topics": item["topics"], "sourcePaths": [item["sourceUrl"]], "rank": -2500.0,
            "assetUrl": f"http://127.0.0.1:31983/visuals/assets/{digest}.webp",
        })
    return result[:limit]


def curated_cargo_query(value: str, limit: int) -> list[dict]:
    root = Path(__file__).resolve().parents[1] / "assets" / "curated-cargo-verified"
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        return []
    normalized = value.casefold()
    phrase_groups = {
        "container-twistlock": ("konteyner twistlock", "konteyner kilidi", "twistlock", "container twistlock"),
        "ship-cargo-crane": ("gemi yük vinci", "gemi yuk vinci", "güverte yük vinci", "guverte yuk vinci", "ship cargo crane", "deck cargo crane"),
        "folding-hatch-covers": ("katlanır ambar kapağı", "katlanir ambar kapagi", "ambar kapakları", "ambar kapaklari", "folding hatch cover", "cargo hatch cover"),
        "container-loading": ("konteyner yükleme operasyonu", "konteyner yukleme operasyonu", "konteyner yükleme", "container loading operation", "loading container ship"),
    }
    preferred = {key for key, phrases in phrase_groups.items() if any(phrase in normalized for phrase in phrases)}
    if not preferred:
        return []
    result = []
    for item in json.loads(manifest_path.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:
            continue
        path = root / item["file"]
        digest = __import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({
            "visual_key": f"curated:cargo:{item['id']}", "visual_type": "object",
            "document_hash": "curated-cargo-verified", "page_number": None,
            "image_number": None, "asset_hash": digest, "file": str(path),
            "title": item["credit"], "volume": None, "heading": item["heading"],
            "context": f"Verified cargo-equipment photograph. {item['license']}",
            "topics": item["topics"], "sourcePaths": [item["sourceUrl"]], "rank": -2500.0,
            "assetUrl": f"http://127.0.0.1:31983/visuals/assets/{digest}.webp",
        })
    return result[:limit]


def curated_bridge_electronics_query(value: str, limit: int) -> list[dict]:
    root = Path(__file__).resolve().parents[1] / "assets" / "curated-bridge-electronics-verified"
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        return []
    normalized = value.casefold()
    phrase_groups = {
        "ais-display": ("ais cihaz", "ais ekran", "otomatik tanımlama sistemi", "otomatik tanimlama sistemi", "automatic identification system", "ship ais display"),
        "radar-display": ("gemi radarı", "gemi radari", "radar ekranı", "radar ekrani", "köprüüstü radarı", "kopruustu radari", "marine radar display", "ship radar display"),
        "ecdis-display": ("ecdis ekran", "ecdis cihaz", "elektronik harita sistemi", "electronic chart display", "ecdis display"),
        "vhf-radio": ("deniz vhf telsiz", "vhf cihaz", "dsc telsiz", "gmdss telsiz", "marine vhf radio", "vhf dsc radio"),
    }
    preferred = {key for key, phrases in phrase_groups.items() if any(phrase in normalized for phrase in phrases)}
    if not preferred:
        return []
    result = []
    for item in json.loads(manifest_path.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:
            continue
        path = root / item["file"]
        digest = __import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({
            "visual_key": f"curated:bridge-electronics:{item['id']}", "visual_type": "object",
            "document_hash": "curated-bridge-electronics-verified", "page_number": None,
            "image_number": None, "asset_hash": digest, "file": str(path),
            "title": item["credit"], "volume": None, "heading": item["heading"],
            "context": f"Verified bridge-electronics photograph. {item['license']}",
            "topics": item["topics"], "sourcePaths": [item["sourceUrl"]], "rank": -2500.0,
            "assetUrl": f"http://127.0.0.1:31983/visuals/assets/{digest}.webp",
        })
    return result[:limit]


def curated_bridge_controls_query(value: str, limit: int) -> list[dict]:
    root = Path(__file__).resolve().parents[1] / "assets" / "curated-bridge-controls-verified"
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file(): return []
    normalized = value.casefold()
    groups = {
        "engine-order-telegraph": ("makine telgraf", "gemi telgraf", "engine order telegraph", "ship telegraph"),
        "modern-helm-console": ("modern dümen konsolu", "modern dumen konsolu", "entegre köprüüstü kumanda", "integrated bridge helm", "modern helm console"),
        "traditional-ship-wheel": ("klasik gemi dümeni", "klasik gemi dumeni", "ahşap gemi dümeni", "ahsap gemi dumeni", "traditional ship wheel", "wooden ship wheel"),
        "helmsman-watch": ("dümen vardiyası", "dumen vardiyasi", "dümen tutmak", "dumen tutmak", "dümenci", "dumenci", "helmsman watch", "steering a ship"),
    }
    preferred = {key for key, phrases in groups.items() if any(p in normalized for p in phrases)}
    if not preferred: return []
    result = []
    for item in json.loads(manifest_path.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred: continue
        path = root / item["file"]
        digest = __import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({"visual_key":f"curated:bridge-controls:{item['id']}","visual_type":"object","document_hash":"curated-bridge-controls-verified","page_number":None,"image_number":None,"asset_hash":digest,"file":str(path),"title":item["credit"],"volume":None,"heading":item["heading"],"context":f"Verified bridge-control photograph. {item['license']}","topics":item["topics"],"sourcePaths":[item["sourceUrl"]],"rank":-2500.0,"assetUrl":f"http://127.0.0.1:31983/visuals/assets/{digest}.webp"})
    return result[:limit]


def curated_firefighting_query(value: str, limit: int) -> list[dict]:
    root = Path(__file__).resolve().parents[1] / "assets" / "curated-firefighting-verified"
    manifest = root / "manifest.json"
    if not manifest.is_file(): return []
    normalized = value.casefold()
    groups = {
        "portable-extinguisher": ("taşınabilir yangın söndürücü", "tasinabilir yangin sondurucu", "yangın tüpü kullanımı", "yangin tupu kullanimi", "portable fire extinguisher"),
        "fire-hose-station": ("gemi yangın hortumu", "gemi yangin hortumu", "yangın hortumu istasyonu", "yangin hortumu istasyonu", "ship fire hose station", "fire hose rack"),
        "fire-nozzle-operation": ("yangın nozulu", "yangin nozulu", "yangın lansı", "yangin lansi", "fire hose nozzle operation", "charged fire hose"),
        "cargo-hold-drenching": ("yük ambarı drencher", "yuk ambari drencher", "ambar sprinkler", "cargo hold drenching", "cargo hold sprinkler"),
    }
    preferred = {k for k, phrases in groups.items() if any(p in normalized for p in phrases)}
    if not preferred: return []
    result=[]
    for item in json.loads(manifest.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred: continue
        path=root/item["file"]; digest=__import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({"visual_key":f"curated:firefighting:{item['id']}","visual_type":"object","document_hash":"curated-firefighting-verified","page_number":None,"image_number":None,"asset_hash":digest,"file":str(path),"title":item["credit"],"volume":None,"heading":item["heading"],"context":f"Verified shipboard-firefighting photograph. {item['license']}","topics":item["topics"],"sourcePaths":[item["sourceUrl"]],"rank":-2500.0,"assetUrl":f"http://127.0.0.1:31983/visuals/assets/{digest}.webp"})
    return result[:limit]


def curated_damage_control_query(value: str, limit: int) -> list[dict]:
    root=Path(__file__).resolve().parents[1]/"assets"/"curated-damage-control-verified"; manifest=root/"manifest.json"
    if not manifest.is_file(): return []
    normalized=value.casefold(); groups={
        "watertight-door":("su geçirmez kapı","su gecirmez kapi","gemi bölme kapısı","gemi bolme kapisi","watertight door"),
        "dewatering-pump":("susuzlandırma pompası","susuzlandirma pompasi","taşınabilir sintine pompası","tasinabilir sintine pompasi","p-100 dewatering pump","portable dewatering pump"),
        "steel-shoring":("çelik shoring","celik shoring","yarılmış bölme desteği","yarilmis bolme destegi","steel shoring","ruptured bulkhead support"),
        "flooded-compartment":("su basmış kompartıman","su basmis kompartiman","gemi su alma eğitimi","gemi su alma egitimi","flooded compartment evacuation","ship flooding training")}
    preferred={k for k,phrases in groups.items() if any(p in normalized for p in phrases)}
    if not preferred:return []
    result=[]
    for item in json.loads(manifest.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:continue
        path=root/item["file"]; digest=__import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({"visual_key":f"curated:damage-control:{item['id']}","visual_type":"object","document_hash":"curated-damage-control-verified","page_number":None,"image_number":None,"asset_hash":digest,"file":str(path),"title":item["credit"],"volume":None,"heading":item["heading"],"context":f"Verified shipboard damage-control photograph. {item['license']}","topics":item["topics"],"sourcePaths":[item["sourceUrl"]],"rank":-2500.0,"assetUrl":f"http://127.0.0.1:31983/visuals/assets/{digest}.webp"})
    return result[:limit]


def curated_pilotage_access_query(value: str, limit: int) -> list[dict]:
    root=Path(__file__).resolve().parents[1]/"assets"/"curated-pilotage-access-verified"; manifest=root/"manifest.json"
    if not manifest.is_file(): return []
    normalized=value.casefold(); groups={
        "pilot-ladder-operation":("loçman çarmıhı","locman carmihi","pilot merdiveni","loçman transferi","locman transferi","pilot ladder","pilot embarkation"),
        "pilot-boat-limassol":("pilot botu","loçman botu","locman botu","pilot boat","pilot transfer craft"),
        "accommodation-ladder-operation":("borda merdiveni","gemi giriş merdiveni","gemi giris merdiveni","iskele kurulumu","accommodation ladder","ship gangway"),
        "harbor-tug-line-operation":("römorkör halatı","romorkor halati","liman römorkörü","liman romorkoru","gemi yedekleme","harbor tug","tug line operation")}
    preferred={k for k,phrases in groups.items() if any(p in normalized for p in phrases)}
    if not preferred:return []
    result=[]
    for item in json.loads(manifest.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:continue
        path=root/item["file"]; digest=__import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({"visual_key":f"curated:pilotage-access:{item['id']}","visual_type":"object","document_hash":"curated-pilotage-access-verified","page_number":None,"image_number":None,"asset_hash":digest,"file":str(path),"title":item["credit"],"volume":None,"heading":item["heading"],"context":f"Verified pilotage and ship-access photograph. {item['license']}","topics":item["topics"],"sourcePaths":[item["sourceUrl"]],"rank":-2500.0,"assetUrl":f"http://127.0.0.1:31983/visuals/assets/{digest}.webp"})
    return result[:limit]


def curated_distress_signals_query(value: str, limit: int) -> list[dict]:
    root=Path(__file__).resolve().parents[1]/"assets"/"curated-distress-signals-verified"; manifest=root/"manifest.json"
    if not manifest.is_file(): return []
    normalized=value.casefold(); groups={
        "mk124-distress-signal":("mk-124","mk 124","kırmızı imdat fişeği","kirmizi imdat fisegi","gece işaret fişeği","gece isaret fisegi","red night distress signal","marine flare"),
        "orange-smoke-signal":("turuncu duman işareti","turuncu duman isareti","gündüz imdat işareti","gunduz imdat isareti","denizde duman kandili","orange smoke signal","day distress signal"),
        "line-throwing-appliance":("halat atma cihazı","halat atma cihazi","roketli halat atıcı","roketli halat atici","gemi kurtarma halatı","gemi kurtarma halati","line throwing appliance","bridger line thrower")}
    preferred={k for k,phrases in groups.items() if any(p in normalized for p in phrases)}
    if not preferred:return []
    result=[]
    for item in json.loads(manifest.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:continue
        path=root/item["file"]; digest=__import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({"visual_key":f"curated:distress-signals:{item['id']}","visual_type":"object","document_hash":"curated-distress-signals-verified","page_number":None,"image_number":None,"asset_hash":digest,"file":str(path),"title":item["credit"],"volume":None,"heading":item["heading"],"context":f"Verified maritime distress-signal photograph. {item['license']}","topics":item["topics"],"sourcePaths":[item["sourceUrl"]],"rank":-2500.0,"assetUrl":f"http://127.0.0.1:31983/visuals/assets/{digest}.webp"})
    return result[:limit]


def curated_oil_spill_response_query(value: str, limit: int) -> list[dict]:
    root=Path(__file__).resolve().parents[1]/"assets"/"curated-oil-spill-response-verified"; manifest=root/"manifest.json"
    if not manifest.is_file(): return []
    normalized=value.casefold(); groups={
        "containment-boom-deployment":("petrol bariyeri","yağ bariyeri","yag bariyeri","döküntü bariyeri","dokuntu bariyeri","oil containment boom","spill boom deployment"),
        "weir-skimmer-operation":("weir skimmer","savaklı petrol skimmer","savakli petrol skimmer","petrol sıyırıcı","petrol siyirici","yağ toplama cihazı","yag toplama cihazi"),
        "voss-skimming-vessel":("voss","vessel of opportunity skimming system","gemi petrol toplama sistemi","petrol müdahale gemisi","petrol mudahale gemisi"),
        "dynamic-inclined-plane-skimmer":("dip 600","dynamic inclined plane skimmer","eğik düzlemli skimmer","egik duzlemli skimmer","petrol toplama tatbikatı","petrol toplama tatbikati")}
    preferred={k for k,phrases in groups.items() if any(p in normalized for p in phrases)}
    if not preferred:return []
    result=[]
    for item in json.loads(manifest.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:continue
        path=root/item["file"]; digest=__import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({"visual_key":f"curated:oil-spill-response:{item['id']}","visual_type":"object","document_hash":"curated-oil-spill-response-verified","page_number":None,"image_number":None,"asset_hash":digest,"file":str(path),"title":item["credit"],"volume":None,"heading":item["heading"],"context":f"Verified marine oil-spill-response photograph. {item['license']}","topics":item["topics"],"sourcePaths":[item["sourceUrl"]],"rank":-2500.0,"assetUrl":f"http://127.0.0.1:31983/visuals/assets/{digest}.webp"})
    return result[:limit]


def curated_hull_underwater_query(value: str, limit: int) -> list[dict]:
    root=Path(__file__).resolve().parents[1]/"assets"/"curated-hull-underwater-verified"; manifest=root/"manifest.json"
    if not manifest.is_file(): return []
    normalized=value.casefold(); groups={
        "bulbous-bow-underway":("yumrubaş","yumrubas","balbımsı baş","balbimsi bas","gemi baş formu","bulbous bow","ship bow wave"),
        "propeller-installation":("gemi pervanesi","pervane şaftı","pervane safti","kuru havuz pervane montajı","kuru havuz pervane montaji","ship propeller","propeller shaft"),
        "rudder-propeller-inspection":("gemi dümeni","gemi dumeni","dümen denetimi","dumen denetimi","pervane dümen kontrolü","pervane dumen kontrolu","ship rudder","rudder inspection"),
        "underwater-hull-inspection":("su hattı altı gövde","su hatti alti govde","karina denetimi","gövde sacı kontrolü","govde saci kontrolu","underwater hull","dry dock hull inspection")}
    preferred={k for k,phrases in groups.items() if any(p in normalized for p in phrases)}
    if not preferred:return []
    result=[]
    for item in json.loads(manifest.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:continue
        path=root/item["file"]; digest=__import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({"visual_key":f"curated:hull-underwater:{item['id']}","visual_type":"object","document_hash":"curated-hull-underwater-verified","page_number":None,"image_number":None,"asset_hash":digest,"file":str(path),"title":item["credit"],"volume":None,"heading":item["heading"],"context":f"Verified ship hull and underwater-gear photograph. {item['license']}","topics":item["topics"],"sourcePaths":[item["sourceUrl"]],"rank":-2500.0,"assetUrl":f"http://127.0.0.1:31983/visuals/assets/{digest}.webp"})
    return result[:limit]


def curated_vessel_types_query(value: str, limit: int) -> list[dict]:
    root=Path(__file__).resolve().parents[1]/"assets"/"curated-vessel-types-verified"; manifest=root/"manifest.json"
    if not manifest.is_file(): return []
    normalized=value.casefold(); groups={
        "container-ship-underway":("konteyner gemisi","konteyner taşıyan gemi","konteyner tasiyan gemi","container ship","containership","container vessel"),
        "oil-tanker-underway":("petrol tankeri","ham petrol tankeri","tanker gemisi","oil tanker","tanker ship"),
        "bulk-carrier-moored":("dökme yük gemisi","dokme yuk gemisi","kuru yük gemisi","kuru yuk gemisi","bulk carrier","dry bulk carrier","bulk cargo ship"),
        "ro-ro-ship-ramp-deployed":("ro-ro gemisi","roro gemisi","tekerlekli yük gemisi","tekerlekli yuk gemisi","ro-ro ship","roro ship","roll-on roll-off ship")}
    preferred={k for k,phrases in groups.items() if any(p in normalized for p in phrases)}
    if not preferred:return []
    result=[]
    for item in json.loads(manifest.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:continue
        path=root/item["file"]; digest=__import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({"visual_key":f"curated:vessel-types:{item['id']}","visual_type":"object","document_hash":"curated-vessel-types-verified","page_number":None,"image_number":None,"asset_hash":digest,"file":str(path),"title":item["credit"],"volume":None,"heading":item["heading"],"context":f"Verified vessel-type photograph. {item['license']}","topics":item["topics"],"sourcePaths":[item["sourceUrl"]],"rank":-2500.0,"assetUrl":f"http://127.0.0.1:31983/visuals/assets/{digest}.webp"})
    return result[:limit]


def curated_specialized_vessels_query(value: str, limit: int) -> list[dict]:
    root=Path(__file__).resolve().parents[1]/"assets"/"curated-specialized-vessels-verified"; manifest=root/"manifest.json"
    if not manifest.is_file(): return []
    normalized=value.casefold(); groups={
        "lng-carriers-under-construction":("lng gemisi","lng tankeri","sıvılaştırılmış doğal gaz gemisi","sivilastirilmis dogal gaz gemisi","küresel lng tankı","kuresel lng tanki","lng carrier","liquefied natural gas carrier"),
        "chemical-tanker-doris":("kimyasal tanker","kimyasal madde tankeri","ürün tankeri","urun tankeri","chemical tanker","product tanker"),
        "car-carrier-tosca":("araç taşıyıcı gemi","arac tasiyici gemi","otomobil taşıma gemisi","otomobil tasima gemisi","araba gemisi","car carrier","vehicle carrier","pctc"),
        "semi-submersible-heavy-lift-ship":("ağır yük gemisi","agir yuk gemisi","yarı batabilir gemi","yari batabilir gemi","proje yükü gemisi","proje yuku gemisi","heavy lift ship","semi-submersible vessel","heavy transport vessel")}
    preferred={k for k,phrases in groups.items() if any(p in normalized for p in phrases)}
    if not preferred:return []
    result=[]
    for item in json.loads(manifest.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:continue
        path=root/item["file"]; digest=__import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({"visual_key":f"curated:specialized-vessels:{item['id']}","visual_type":"object","document_hash":"curated-specialized-vessels-verified","page_number":None,"image_number":None,"asset_hash":digest,"file":str(path),"title":item["credit"],"volume":None,"heading":item["heading"],"context":f"Verified specialized-vessel photograph. {item['license']}","topics":item["topics"],"sourcePaths":[item["sourceUrl"]],"rank":-2500.0,"assetUrl":f"http://127.0.0.1:31983/visuals/assets/{digest}.webp"})
    return result[:limit]


def curated_passenger_work_vessels_query(value: str, limit: int) -> list[dict]:
    root=Path(__file__).resolve().parents[1]/"assets"/"curated-passenger-work-vessels-verified"; manifest=root/"manifest.json"
    if not manifest.is_file(): return []
    normalized=value.casefold(); groups={
        "cruise-ship-underway":("kruvaziyer gemisi","yolcu gemisi","turistik gemi","cruise ship","passenger liner"),
        "passenger-ferry-underway":("yolcu feribotu","arabalı vapur","arabali vapur","feribot","passenger ferry","ferry boat"),
        "fishing-trawler-underway":("balıkçı gemisi","balikci gemisi","balıkçı trolü","balikci trolu","trol teknesi","fishing trawler","commercial fishing vessel"),
        "dredger-viking":("tarak gemisi","deniz dibi tarama gemisi","kum tarama gemisi","dredger","dredge vessel")}
    preferred={k for k,phrases in groups.items() if any(p in normalized for p in phrases)}
    if not preferred:return []
    result=[]
    for item in json.loads(manifest.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:continue
        path=root/item["file"];digest=__import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({"visual_key":f"curated:passenger-work-vessels:{item['id']}","visual_type":"object","document_hash":"curated-passenger-work-vessels-verified","page_number":None,"image_number":None,"asset_hash":digest,"file":str(path),"title":item["credit"],"volume":None,"heading":item["heading"],"context":f"Verified passenger or work-vessel photograph. {item['license']}","topics":item["topics"],"sourcePaths":[item["sourceUrl"]],"rank":-2500.0,"assetUrl":f"http://127.0.0.1:31983/visuals/assets/{digest}.webp"})
    return result[:limit]


def curated_naval_support_vessels_query(value: str, limit: int) -> list[dict]:
    root=Path(__file__).resolve().parents[1]/"assets"/"curated-naval-support-vessels-verified";manifest=root/"manifest.json"
    if not manifest.is_file():return []
    normalized=value.casefold();groups={
        "virginia-class-submarine-underway":("denizaltı","denizalti","nükleer denizaltı","nukleer denizalti","submarine","attack submarine"),
        "aircraft-carrier-turning":("uçak gemisi","ucak gemisi","uçak taşıyan savaş gemisi","ucak tasiyan savas gemisi","aircraft carrier","carrier flight deck"),
        "noaa-research-ship":("araştırma gemisi","arastirma gemisi","oşinografi gemisi","osinografi gemisi","bilim gemisi","research vessel","oceanographic ship"),
        "offshore-supply-vessel-underway":("açık deniz ikmal gemisi","acik deniz ikmal gemisi","platform destek gemisi","offshore supply vessel","platform supply vessel")}
    preferred={k for k,phrases in groups.items() if any(p in normalized for p in phrases)}
    if not preferred:return []
    result=[]
    for item in json.loads(manifest.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:continue
        path=root/item["file"];digest=__import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({"visual_key":f"curated:naval-support-vessels:{item['id']}","visual_type":"object","document_hash":"curated-naval-support-vessels-verified","page_number":None,"image_number":None,"asset_hash":digest,"file":str(path),"title":item["credit"],"volume":None,"heading":item["heading"],"context":f"Verified naval or support-vessel photograph. {item['license']}","topics":item["topics"],"sourcePaths":[item["sourceUrl"]],"rank":-2500.0,"assetUrl":f"http://127.0.0.1:31983/visuals/assets/{digest}.webp"})
    return result[:limit]


def curated_shipyard_port_query(value: str, limit: int) -> list[dict]:
    root=Path(__file__).resolve().parents[1]/"assets"/"curated-shipyard-port-verified";manifest=root/"manifest.json"
    if not manifest.is_file():return []
    normalized=value.casefold();groups={
        "ship-on-drydock-blocks":("kuru havuz","havuz takozları","havuz takozlari","gemi havuzlama","dry dock","keel blocks"),
        "floating-drydock-resourceful":("yüzer havuz","yuzer havuz","yüzer kuru havuz","yuzer kuru havuz","floating dry dock","auxiliary dry dock"),
        "container-terminal-aerial":("konteyner terminali","konteyner sahası","konteyner sahasi","liman vinçleri","liman vincleri","container terminal","container yard"),
        "ship-slipway-launch":("gemi denize indirme","gemi kızağı","gemi kizagi","tersane kızak sistemi","tersane kizak sistemi","ship launch","shipyard slipway")}
    preferred={k for k,phrases in groups.items() if any(p in normalized for p in phrases)}
    if not preferred:return []
    result=[]
    for item in json.loads(manifest.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:continue
        path=root/item["file"];digest=__import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({"visual_key":f"curated:shipyard-port:{item['id']}","visual_type":"object","document_hash":"curated-shipyard-port-verified","page_number":None,"image_number":None,"asset_hash":digest,"file":str(path),"title":item["credit"],"volume":None,"heading":item["heading"],"context":f"Verified shipyard or port photograph. {item['license']}","topics":item["topics"],"sourcePaths":[item["sourceUrl"]],"rank":-2500.0,"assetUrl":f"http://127.0.0.1:31983/visuals/assets/{digest}.webp"})
    return result[:limit]


def curated_survival_craft_gear_query(value: str, limit: int) -> list[dict]:
    root=Path(__file__).resolve().parents[1]/"assets"/"curated-survival-craft-gear-verified";manifest=root/"manifest.json"
    if not manifest.is_file():return []
    normalized=value.casefold();groups={
        "fully-enclosed-lifeboat":("filika","kapalı filika","kapali filika","tam kapalı filika","tam kapali filika","gemi filikası","gemi filikasi","fully enclosed lifeboat","enclosed lifeboat"),
        "life-jacket-inspection":("can yeleği","can yelegi","can yeleği kontrolü","can yelegi kontrolu","life jacket","lifejacket","personal flotation device","pfd"),
        "immersion-suit-training":("immersion suit","survival suit","dalma giysisi","dalma kıyafeti","dalma kiyafeti","termo koruyucu giysi","soğuk su hayatta kalma giysisi","soguk su hayatta kalma giysisi"),
        "shipboard-rescue-boat":("kurtarma botu","arama kurtarma botu","hızlı kurtarma botu","hizli kurtarma botu","denize adam düştü botu","denize adam dustu botu","rescue boat","search and rescue boat","shipboard rescue boat","fast rescue boat")}
    preferred={k for k,phrases in groups.items() if any(p in normalized for p in phrases)}
    if not preferred:return []
    result=[]
    for item in json.loads(manifest.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:continue
        path=root/item["file"];digest=__import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({"visual_key":f"curated:survival-craft-gear:{item['id']}","visual_type":"object","document_hash":"curated-survival-craft-gear-verified","page_number":None,"image_number":None,"asset_hash":digest,"file":str(path),"title":item["credit"],"volume":None,"heading":item["heading"],"context":f"Verified survival-craft or personal-survival-equipment photograph. {item['license']}","topics":item["topics"],"sourcePaths":[item["sourceUrl"]],"rank":-2500.0,"assetUrl":f"http://127.0.0.1:31983/visuals/assets/{digest}.webp"})
    return result[:limit]


def curated_maritime_knots_query(value: str, limit: int) -> list[dict]:
    root=Path(__file__).resolve().parents[1]/"assets"/"curated-maritime-knots-verified";manifest=root/"manifest.json"
    if not manifest.is_file():return []
    normalized=value.casefold();groups={
        "bowline-knot":("izbarço","izbarco","izbarço bağı","izbarco bagi","bowline","bowline knot","sabit halka düğümü","sabit halka dugumu"),
        "clove-hitch":("kazık bağı","kazik bagi","kazık düğümü","kazik dugumu","clove hitch","direğe bağlama","direge baglama")}
    preferred={k for k,phrases in groups.items() if any(p in normalized for p in phrases)}
    if not preferred:return []
    result=[]
    for item in json.loads(manifest.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:continue
        path=root/item["file"];digest=__import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({"visual_key":f"curated:maritime-knots:{item['id']}","visual_type":"object","document_hash":"curated-maritime-knots-verified","page_number":None,"image_number":None,"asset_hash":digest,"file":str(path),"title":item["credit"],"volume":None,"heading":item["heading"],"context":f"Verified maritime-knot photograph. {item['license']}","topics":item["topics"],"sourcePaths":[item["sourceUrl"]],"rank":-2500.0,"assetUrl":f"http://127.0.0.1:31983/visuals/assets/{digest}.webp"})
    return result[:limit]


def curated_maritime_knots_advanced_query(value: str, limit: int) -> list[dict]:
    root=Path(__file__).resolve().parents[1]/"assets"/"curated-maritime-knots-advanced-verified";manifest=root/"manifest.json"
    if not manifest.is_file():return []
    normalized=value.casefold();groups={
        "reef-knot":("camadan bağı","camadan bagi","düz düğüm","duz dugum","reef knot","square knot"),
        "sheet-bend":("sancak bağı","sancak bagi","iskota bağı","iskota bagi","sheet bend","farklı çaplı halatları bağlama","farkli capli halatlari baglama"),
        "eye-splice":("halat gözü","halat gozu","halat dikişi","halat dikisi","kasa yapmak","eye splice","rope eye splice")}
    preferred={k for k,phrases in groups.items() if any(p in normalized for p in phrases)}
    if not preferred:return []
    result=[]
    for item in json.loads(manifest.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:continue
        path=root/item["file"];digest=__import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({"visual_key":f"curated:maritime-knots-advanced:{item['id']}","visual_type":"object","document_hash":"curated-maritime-knots-advanced-verified","page_number":None,"image_number":None,"asset_hash":digest,"file":str(path),"title":item["credit"],"volume":None,"heading":item["heading"],"context":f"Verified maritime ropework photograph. {item['license']}","topics":item["topics"],"sourcePaths":[item["sourceUrl"]],"rank":-2500.0,"assetUrl":f"http://127.0.0.1:31983/visuals/assets/{digest}.webp"})
    return result[:limit]


def curated_shipboard_ppe_query(value: str, limit: int) -> list[dict]:
    root=Path(__file__).resolve().parents[1]/"assets"/"curated-shipboard-ppe-verified";manifest=root/"manifest.json"
    if not manifest.is_file():return []
    normalized=value.casefold();groups={
        "hard-hat-chin-strap":("baret çene bağı","baret cene bagi","gemi bareti","iş güvenliği bareti","is guvenligi bareti","hard hat","hard-hat chin strap","safety helmet"),
        "safety-harness-connection":("emniyet kemeri","düşüş durdurma kemeri","dusus durdurma kemeri","yüksekte çalışma","yuksekte calisma","safety harness","fall arrest harness","working aloft")}
    preferred={k for k,phrases in groups.items() if any(p in normalized for p in phrases)}
    if not preferred:return []
    result=[]
    for item in json.loads(manifest.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:continue
        path=root/item["file"];digest=__import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({"visual_key":f"curated:shipboard-ppe:{item['id']}","visual_type":"object","document_hash":"curated-shipboard-ppe-verified","page_number":None,"image_number":None,"asset_hash":digest,"file":str(path),"title":item["credit"],"volume":None,"heading":item["heading"],"context":f"Verified shipboard PPE photograph. {item['license']}","topics":item["topics"],"sourcePaths":[item["sourceUrl"]],"rank":-2500.0,"assetUrl":f"http://127.0.0.1:31983/visuals/assets/{digest}.webp"})
    return result[:limit]


def curated_shipboard_industrial_ppe_query(value: str, limit: int) -> list[dict]:
    root=Path(__file__).resolve().parents[1]/"assets"/"curated-shipboard-industrial-ppe-verified";manifest=root/"manifest.json"
    if not manifest.is_file():return []
    normalized=value.casefold();groups={
        "welding-face-protection":("gemi kaynak ppe","kaynakçı maskesi","kaynakci maskesi","kaynak yüz siperi","kaynak yuz siperi","kaynakçı yüz koruması","kaynakci yuz korumasi","welding helmet","welding face shield","shipboard welding"),
        "respirator-fit-test":("respiratör fit testi","respirator fit testi","respiratör uyum testi","respirator uyum testi","gemi respiratörü","gemi respiratoru","solunum maskesi","half-face respirator","respirator fit test")}
    preferred={k for k,phrases in groups.items() if any(p in normalized for p in phrases)}
    if not preferred:return []
    result=[]
    for item in json.loads(manifest.read_text(encoding="utf-8"))["visuals"]:
        if item["id"] not in preferred:continue
        path=root/item["file"];digest=__import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({"visual_key":f"curated:shipboard-industrial-ppe:{item['id']}","visual_type":"object","document_hash":"curated-shipboard-industrial-ppe-verified","page_number":None,"image_number":None,"asset_hash":digest,"file":str(path),"title":item["credit"],"volume":None,"heading":item["heading"],"context":f"Verified shipboard industrial PPE photograph. {item['license']}","topics":item["topics"],"sourcePaths":[item["sourceUrl"]],"rank":-2500.0,"assetUrl":f"http://127.0.0.1:31983/visuals/assets/{digest}.webp"})
    return result[:limit]


def curated_kaiyodai_navigation_schematics_query(value: str, limit: int) -> list[dict]:
    root=Path(__file__).resolve().parents[1]/"assets"/"curated-kaiyodai-navigation-schematics";manifest=root/"manifest.json"
    if not manifest.is_file():return []
    normalized=value.casefold();groups={
        "imu-dvl-integration":("imu dvl entegrasyonu","imu/dvl entegrasyonu","imu dvl integration","doppler hız kütüğü","doppler hiz kutugu","dzupt"),
        "heading-track-slip-angle":("baş yönü iz yönü","bas yonu iz yonu","sürüklenme açısı","suruklenme acisi","heading track slip angle","heading and track","rüzgar dalga sürüklenmesi","ruzgar dalga suruklenmesi"),
        "ins-dvl-ekf-integration":("ins dvl ekf","ins/dvl ekf","ins dvl entegrasyonu","extended kalman filter","tamamlayıcı filtre","tamamlayici filtre")}
    preferred={k for k,phrases in groups.items() if any(p in normalized for p in phrases)}
    if not preferred:return []
    data=json.loads(manifest.read_text(encoding="utf-8"));result=[]
    for item in data["visuals"]:
        if item["id"] not in preferred:continue
        path=root/item["file"];digest=__import__("hashlib").sha256(path.read_bytes()).hexdigest()
        result.append({"visual_key":f"curated:kaiyodai-navigation:{item['id']}","visual_type":"diagram","document_hash":"curated-kaiyodai-navigation-schematics","page_number":item["page"],"image_number":item["figure"],"asset_hash":digest,"file":str(path),"title":data["sourceTitle"],"volume":None,"heading":item["heading"],"context":f"TUMSAT-OACIS {item['figure']}. {data['license']}. Attribution: {data['sourceAuthors']}.","topics":item["topics"],"sourcePaths":[data["sourceUrl"]],"rank":-2600.0,"assetUrl":f"http://127.0.0.1:31983/visuals/assets/{digest}.webp"})
    return result[:limit]


def render_chart_table_highlight(path: Path, box: list[float] | None,
                                 column: str | None) -> tuple[Path, str] | None:
    """Render a deterministic whole-table image with the matching row/cell marked."""
    if not box or len(box) != 4:
        return None
    from PIL import Image, ImageDraw

    cache = path.parent / "highlight-cache"
    cache.mkdir(exist_ok=True)
    identity = f"{hashlib.sha256(path.read_bytes()).hexdigest()}:{box}:{column or 'row'}:v1"
    cache_key = hashlib.sha256(identity.encode("utf-8")).hexdigest()
    cached = cache / f"{cache_key}.webp"
    if not cached.is_file():
        with Image.open(path).convert("RGBA") as source:
            left = max(0, min(source.width - 1, round(box[0] * source.width)))
            top = max(0, min(source.height - 1, round(box[1] * source.height)))
            right = max(left + 1, min(source.width, round(box[2] * source.width)))
            bottom = max(top + 1, min(source.height, round(box[3] * source.height)))
            overlay = Image.new("RGBA", source.size, (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)
            draw.rectangle((left, top, right, bottom), fill=(255, 214, 64, 58),
                           outline=(229, 139, 0, 255), width=max(4, source.width // 220))
            rendered = Image.alpha_composite(source, overlay).convert("RGB")
            rendered.save(cached, "WEBP", quality=94, method=6)
    return cached, hashlib.sha256(cached.read_bytes()).hexdigest()


def chart_no_1_table_page_query(value: str, limit: int) -> list[dict]:
    root = Path(__file__).resolve().parents[1] / "assets" / "nga-chart-no-1"
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        return []
    normalized = value.casefold()
    sections = (
        (("harita numarası", "harita basligi", "harita başlığı", "kenar notu", "chart number", "marginal note"), (9, 10)),
        (("mevki", "pozisyon", "mesafe", "yön", "yon", "pusula", "position", "distance", "direction", "compass"), tuple(range(11, 17))),
        (("doğal özellik", "dogal ozellik", "kıyı", "kiyi", "sahil", "natural feature", "coastline", "shoreline"), tuple(range(17, 22))),
        (("kültürel özellik", "kulturel ozellik", "bina", "yol", "cultural feature", "building", "road"), tuple(range(22, 27))),
        (("belirgin özellik", "belirgin ozellik", "conspicuous", "non-conspicuous"), (27,)),
        (("nirengi", "landmark", "kule", "tower", "baca", "chimney", "kilise", "church"), tuple(range(28, 32))),
        (("liman", "port", "harbour", "harbor", "rıhtım", "rihtim", "quay", "iskele", "pier", "marina"), tuple(range(32, 39))),
        (("gelgit", "gel git", "akıntı", "akinti", "tide", "current", "stream"), tuple(range(39, 43))),
        (("derinlik", "depth", "iskandil", "sounding", "eş derinlik", "es derinlik", "contour"), tuple(range(43, 48))),
        (("deniz dibi", "dip cinsi", "seabed", "bottom characteristic", "kum", "sand", "çamur", "camur", "mud"), tuple(range(48, 52))),
        (("batık", "batik", "wreck", "kaya", "rock", "engel", "obstruction", "su ürünleri", "aquaculture"), tuple(range(52, 60))),
        (("açık deniz tesisi", "acik deniz tesisi", "offshore installation", "platform", "boru hattı", "boru hatti", "pipeline", "kablo", "cable"), tuple(range(60, 64))),
        (("rota", "route", "iz", "track", "trafik ayrım", "trafik ayrim", "traffic separation", "tss", "önerilen yol", "onerilen yol"), tuple(range(64, 71))),
        (("alan", "sınır", "sinir", "area", "limit", "demirleme", "anchorage", "yasak bölge", "yasak bolge", "restricted area"), tuple(range(71, 78))),
        (("fener", "light", "ışık", "isik", "lighthouse", "sektör ışığı", "sektor isigi", "sector light"), tuple(range(78, 89))),
        (("ecdis renk", "ecdis sembol", "ecdis symbol", "simplified symbol", "paper chart symbol"), (89,)),
        (("şamandıra", "şamandırası", "samandira", "samandirasi", "buoy", "beacon", "tecrit edilmiş", "tescil edilmiş", "isolated danger", "kardinal", "cardinal", "lateral", "topmark", "tepe işareti", "tepe isareti"), tuple(range(90, 103))),
        (("sis işareti", "sis isareti", "fog signal", "düdük", "duduk", "whistle", "siren"), (103,)),
        (("radar", "radio", "radyo", "uydu seyri", "satellite navigation", "ais", "racons", "racon"), tuple(range(104, 107))),
        (("hizmet", "service", "pilot", "kılavuz", "kilavuz", "sahil güvenlik", "sahil guvenlik", "coastguard"), tuple(range(107, 109))),
        (("küçük tekne", "kucuk tekne", "yat", "small craft", "leisure", "tekne tesisi"), (109,)),
        (("kısaltma", "kisaltma", "abbreviation"), tuple(range(110, 115))),
        (("indeks", "index", "terim"), tuple(range(115, 126))),
    )
    def contains_alias(alias: str) -> bool:
        return re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", normalized, re.UNICODE) is not None

    pages = next((page_numbers for aliases, page_numbers in sections if any(contains_alias(alias) for alias in aliases)), ())
    # Only explicit chart/symbol/table requests belong here. A generic photo or
    # device request (for example an AIS display) must remain in the object atlas.
    if not pages or not any(term in normalized for term in
                            ("harita", "sembol", "işaret", "isaret", "chart", "tablo")):
        return []
    table_root = Path(__file__).resolve().parents[1] / "assets" / "nga-chart-no-1-table-atlas"
    table_manifest_path = table_root / "manifest.json"
    if table_manifest_path.is_file():
        table_manifest = json.loads(table_manifest_path.read_text(encoding="utf-8"))
        table_by_page = {table["page"]: table for table in table_manifest.get("tables", [])}
        aliases = {"kaya": "rock", "batık": "wreck", "batik": "wreck", "sığlık": "shoal",
                   "siglik": "shoal", "fener": "light", "ışık": "light", "isik": "light",
                   "şamandıra": "buoy", "şamandırası": "buoy", "samandira": "buoy", "samandirasi": "buoy",
                   "sığlık": "danger", "siglik": "danger", "tecrit": "isolated", "tescil": "isolated",
                   "akıntı": "current", "akinti": "current",
                   "gelgit": "tide", "kablo": "cable", "boru": "pipeline", "demirleme": "anchorage"}
        ignored = {"harita", "sembol", "işaret", "isaret", "göster", "goster", "görsel", "gorsel", "tablo"}
        needles = set(re.findall(r"[^\W\d_][\w-]{2,}", normalized, re.UNICODE)) - ignored
        needles.update(aliases[word] for word in tuple(needles) if word in aliases)
        requested_column = next((column for term, column in (("ecdis", "ecdis"), ("noaa", "noaa"),
                                ("other nga", "other-nga"), ("nga", "nga"), ("int", "int"))
                                 if contains_alias(term)), None)
        candidates = []
        for page in pages:
            table = table_by_page.get(page)
            if not table:
                continue
            best_row, best_score = None, 0
            for row in table.get("rows", []):
                haystack = f"{row.get('description', '')} {row.get('context', '')} {' '.join(row.get('topics', []))}".casefold()
                score = sum(1 for needle in needles if needle in haystack)
                if score > best_score:
                    best_row, best_score = row, score
            candidates.append((best_score, page, table, best_row))
        if candidates:
            result = []
            for score, page, table, row in sorted(candidates, key=lambda item: (-item[0], item[1]))[:limit]:
                path = table_root / table["file"]
                highlight = None if not row else row["cellBoxes"].get(requested_column) if requested_column else row["rowBox"]
                highlighted = render_chart_table_highlight(path, highlight, requested_column)
                selected_path = highlighted[0] if highlighted else path
                selected_hash = highlighted[1] if highlighted else table["sha256"]
                result.append({
                    "visual_key": f"nga-chart-no-1:table:{page}:{selected_hash}",
                    "visual_type": "chart-table-highlight" if highlighted else "chart-table",
                    "document_hash": table_manifest["sourceDocumentSha256"], "page_number": page,
                    "image_number": row.get("symbolNumber") if row else None, "asset_hash": selected_hash,
                    "file": str(selected_path), "title": "U.S. Chart No. 1 - Whole Table Atlas", "volume": None,
                    "heading": table["headings"][0], "context": row.get("context", "") if row else "",
                    "topics": row.get("topics", []) if row else [], "highlightBox": highlight,
                    "highlightColumn": requested_column, "sourcePaths": [table_manifest["sourceUrl"]],
                    "rank": -3200.0 - score,
                    "assetUrl": f"http://127.0.0.1:31983/visuals/assets/{selected_hash}.webp",
                })
            return result
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    by_page = {visual["occurrences"][0]["pdfPage"]: visual for visual in manifest.get("visuals", [])}
    result = []
    for page in pages[:limit]:
        visual = by_page.get(page)
        if not visual:
            continue
        occurrence = visual["occurrences"][0]
        path = root / visual["file"]
        result.append({
            "visual_key": visual["visualId"], "visual_type": "chart-table-page",
            "document_hash": manifest["sourceDocumentSha256"], "page_number": page,
            "image_number": None, "asset_hash": visual["sha256"], "file": str(path),
            "title": manifest["collection"], "volume": None,
            "heading": " / ".join(occurrence.get("headings", [])) or f"Chart No. 1 table page {page}",
            "context": occurrence.get("context", ""), "topics": occurrence.get("topics", []),
            "sourcePaths": [manifest["sourceUrl"]], "rank": -3000.0,
            "assetUrl": f"http://127.0.0.1:31983/visuals/assets/{visual['sha256']}.webp",
        })
    return result


def terms(value: str) -> list[str]:
    aliases = {
        "şamandıra": "buoy", "samandira": "buoy",
        "akıntı": "current", "akinti": "current", "gelgit": "tide", "fener": "light",
        "ışık": "light", "isik": "light", "pusula": "compass", "harita": "chart",
        "sembol": "symbol", "kardinal": "cardinal", "batık": "wreck", "batik": "wreck",
        "kerteriz": "bearing", "işaret": "mark", "isaret": "mark", "kısaltma": "abbreviation",
        "kisaltma": "abbreviation", "yangın": "fire", "yangin": "fire", "çapa": "anchor",
        "capa": "anchor", "halat": "rope", "dümen": "rudder", "dumen": "rudder",
    }
    request_words = {
        "göster", "goster", "gösterin", "gosterin", "gösterir", "gosterir",
        "gösterme", "gosterme", "görsel", "gorsel", "görseli", "gorseli",
        "görselini", "gorselini", "resim", "resmi", "resmini", "fotoğraf",
        "fotograf", "fotoğrafı", "fotografi", "fotoğrafını", "fotografini",
        "cihaz", "cihazı", "cihazi", "cihazını", "cihazini", "ekipman",
        "show", "display", "image", "picture", "photo", "photograph", "please",
    }
    normalized = value.casefold()
    found: list[str] = []
    lifebuoy_phrase = bool(re.search(r"\bcan\s+simid[uiı]\w*", normalized))
    if lifebuoy_phrase:
        result = ["lifebuoy", "life ring", "life-saving appliance"]
        if "sembol" in normalized or "symbol" in normalized:
            result.append("symbol")
        return result
    for word in re.findall(r"[^\W\d_][\w-]{2,}", normalized, re.UNICODE):
        if word in request_words:
            continue
        if lifebuoy_phrase and word in {"can", "simidi", "simidu", "simidı"}:
            continue
        for candidate in (word, aliases.get(word)):
            if candidate and candidate not in found:
                found.append(candidate)
    return found[:16]


def table_exists(db: sqlite3.Connection, name: str) -> bool:
    return db.execute("select 1 from sqlite_master where name=?", (name,)).fetchone() is not None


def semantic_visual_score(row: dict, wanted: list[str], query_text: str) -> tuple[float, dict]:
    """Fast, explainable second-stage score for text-bound visual retrieval."""
    fields = {
        "title": (row.get("title") or "").casefold(),
        "heading": (row.get("heading") or "").casefold(),
        "context": (row.get("context") or "").casefold(),
        "topics": (row.get("topics") or "").casefold(),
    }
    hits = {name: sum(token in value for token in wanted) for name, value in fields.items()}
    coverage = len({token for token in wanted if any(token in value for value in fields.values())})
    phrase = " ".join(terms(query_text))
    phrase_hit = bool(phrase and any(phrase in value for value in fields.values()))
    visual_type = row.get("visual_type") or "page"
    type_bonus = {"object": 4.0, "table": 3.0, "vector": 3.0, "diagram": 3.0,
                  "chart-table": 3.0, "chart-table-highlight": 4.0}.get(visual_type, 0.0)
    provenance = 2.0 if row.get("document_hash") and row.get("page_number") is not None else 0.0
    bound_context = 3.0 if fields["context"] and (hits["context"] or hits["heading"]) else 0.0
    score = (8.0 * hits["heading"] + 6.0 * hits["topics"] +
             3.0 * hits["context"] + hits["title"] +
             10.0 * phrase_hit + 4.0 * coverage + type_bonus + provenance + bound_context)
    explanation = {"headingHits": hits["heading"], "topicHits": hits["topics"],
                   "contextHits": hits["context"], "titleHits": hits["title"],
                   "coverage": coverage, "phraseHit": phrase_hit,
                   "typeBonus": type_bonus, "provenanceBonus": provenance,
                   "boundContextBonus": bound_context}
    return score, explanation


def rerank_visual_rows(rows: list, wanted: list[str], query_text: str, limit: int) -> list[dict]:
    ranked = []
    for row in rows:
        item = dict(row)
        semantic_score, explanation = semantic_visual_score(item, wanted, query_text)
        item["semanticScore"] = semantic_score
        item["scoreExplanation"] = explanation
        ranked.append(item)
    ranked.sort(key=lambda item: (-item["semanticScore"], float(item.get("rank") or 0),
                                  0 if item.get("visual_type") == "object" else 1,
                                  item.get("visual_key") or ""))
    return ranked[:limit]


def query(db: sqlite3.Connection, value: str, limit: int, object_only: bool = False) -> list[dict]:
    curated = curated_symbol_query(value, limit)
    if curated:
        return curated
    curated = chart_no_1_table_page_query(value, limit)
    if curated:
        return curated
    curated = curated_bridge_electronics_query(value, limit)
    if curated:
        return curated
    curated = curated_bridge_controls_query(value, limit)
    if curated:
        return curated
    curated = curated_firefighting_query(value, limit)
    if curated:
        return curated
    curated = curated_damage_control_query(value, limit)
    if curated:
        return curated
    curated = curated_pilotage_access_query(value, limit)
    if curated:
        return curated
    curated = curated_distress_signals_query(value, limit)
    if curated:
        return curated
    curated = curated_oil_spill_response_query(value, limit)
    if curated:
        return curated
    curated = curated_hull_underwater_query(value, limit)
    if curated:
        return curated
    curated = curated_vessel_types_query(value, limit)
    if curated:
        return curated
    curated = curated_specialized_vessels_query(value, limit)
    if curated:
        return curated
    curated = curated_passenger_work_vessels_query(value, limit)
    if curated:
        return curated
    curated = curated_naval_support_vessels_query(value, limit)
    if curated:
        return curated
    curated = curated_shipyard_port_query(value, limit)
    if curated:
        return curated
    curated = curated_survival_craft_gear_query(value, limit)
    if curated:
        return curated
    curated = curated_maritime_knots_query(value, limit)
    if curated:
        return curated
    curated = curated_maritime_knots_advanced_query(value, limit)
    if curated:
        return curated
    curated = curated_shipboard_ppe_query(value, limit)
    if curated:
        return curated
    curated = curated_shipboard_industrial_ppe_query(value, limit)
    if curated:
        return curated
    curated = curated_kaiyodai_navigation_schematics_query(value, limit)
    if curated:
        return curated
    curated = curated_navigation_query(value, limit)
    if curated:
        return curated
    curated = curated_safety_query(value, limit)
    if curated:
        return curated
    curated = curated_weather_query(value, limit)
    if curated:
        return curated
    curated = curated_aids_query(value, limit)
    if curated:
        return curated
    curated = curated_lighthouse_query(value, limit)
    if curated:
        return curated
    curated = curated_deck_query(value, limit)
    if curated:
        return curated
    curated = curated_engine_room_query(value, limit)
    if curated:
        return curated
    curated = curated_cargo_query(value, limit)
    if curated:
        return curated
    wanted = terms(value)
    if not wanted:
        return []
    indexed = table_exists(db, "visual_search")
    if indexed:
        expression = " OR ".join(f'"{word.replace(chr(34), chr(34) * 2)}"' for word in wanted)
        type_clause = " and visual_type='object'" if object_only else ""
        candidate_limit = min(200, max(40, limit * 12))
        rows = db.execute(
            """select visual_key,visual_type,document_hash,page_number,image_number,asset_hash,file,
                      title,volume,heading,context,topics,source_paths,
                      bm25(visual_search,0,0,0,0,0,0,0,2,1,8,3,6,0) rank
               from visual_search where visual_search match ?""" + type_clause + """
               order by rank,case visual_type when 'object' then 0 when 'table' then 1 when 'vector' then 1 else 2 end limit ?""",
            (expression, candidate_limit),
        ).fetchall()
        rows = rerank_visual_rows(rows, wanted, value, limit - len(curated))
    else:
        clauses = " or ".join("lower(coalesce(p.heading,'')||' '||p.context||' '||p.topics) like ?" for _ in wanted)
        params = [f"%{word}%" for word in wanted]
        rows = db.execute(
            f"""select 'page:'||p.document_hash||':'||p.page_number visual_key,'page' visual_type,
                       p.document_hash,p.page_number,null image_number,p.asset_hash,p.file,
                       l.path title,null volume,p.heading,p.context,p.topics,
                       json_array(l.path) source_paths,0 rank
                from page_plates p
                join locations l on l.document_hash=p.document_hash
                 and l.rowid=(select min(x.rowid) from locations x where x.document_hash=p.document_hash)
                where {clauses} order by p.document_hash,p.page_number limit ?""",
            (*params, min(1000, max(200, limit * 100))),
        ).fetchall()
        rows = rerank_visual_rows(rows, wanted, value, limit - len(curated))
    result = []
    for row in rows:
        item = dict(row)
        item["sourcePaths"] = json.loads(item.pop("source_paths"))
        item["topics"] = json.loads(item["topics"] or "[]")
        item["assetUrl"] = f"http://127.0.0.1:31983/visuals/assets/{item['asset_hash']}.webp"
        result.append(item)
    return curated + result[:limit - len(curated)]


def resolve_asset(db: sqlite3.Connection, atlas: Path, digest: str) -> dict:
    if not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise RuntimeError("INVALID_ASSET_HASH")
    for root, prefix, _pages, _title, _source_url, _priority, _collection_id in curated_symbol_collections():
        for path in root.glob(f"{prefix}*.webp"):
            if __import__("hashlib").sha256(path.read_bytes()).hexdigest() == digest:
                return {"asset_hash": digest, "file": str(path), "width": None, "height": None,
                        "visual_type": "object", "absolutePath": str(path.resolve())}
    chart_pages_root = Path(__file__).resolve().parents[1] / "assets" / "nga-chart-no-1"
    for path in chart_pages_root.glob("*.png"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest() == digest:
            return {"asset_hash": digest, "file": str(path), "width": None, "height": None,
                    "visual_type": "chart-table-page", "absolutePath": str(path.resolve())}
    chart_tables_root = Path(__file__).resolve().parents[1] / "assets" / "nga-chart-no-1-table-atlas"
    for path in chart_tables_root.glob("table-page-*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest() == digest:
            return {"asset_hash": digest, "file": str(path), "width": None, "height": None,
                    "visual_type": "chart-table", "absolutePath": str(path.resolve())}
    for path in (chart_tables_root / "highlight-cache").glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest() == digest:
            return {"asset_hash": digest, "file": str(path), "width": None, "height": None,
                    "visual_type": "chart-table-highlight", "absolutePath": str(path.resolve())}
    navigation_root = Path(__file__).resolve().parents[1] / "assets" / "curated-navigation-verified"
    for path in navigation_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest() == digest:
            return {"asset_hash": digest, "file": str(path), "width": None, "height": None,
                    "visual_type": "object", "absolutePath": str(path.resolve())}
    safety_root = Path(__file__).resolve().parents[1] / "assets" / "curated-safety"
    for path in safety_root.glob("*.jpg"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest() == digest:
            return {"asset_hash": digest, "file": str(path), "width": None, "height": None,
                    "visual_type": "object", "absolutePath": str(path.resolve())}
    weather_root = Path(__file__).resolve().parents[1] / "assets" / "curated-weather-verified"
    for path in weather_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest() == digest:
            return {"asset_hash": digest, "file": str(path), "width": None, "height": None,
                    "visual_type": "object", "absolutePath": str(path.resolve())}
    aids_root = Path(__file__).resolve().parents[1] / "assets" / "curated-aids-verified"
    for path in aids_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest() == digest:
            return {"asset_hash": digest, "file": str(path), "width": None, "height": None,
                    "visual_type": "object", "absolutePath": str(path.resolve())}
    lighthouse_root = Path(__file__).resolve().parents[1] / "assets" / "curated-lighthouse-verified"
    for path in lighthouse_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest() == digest:
            return {"asset_hash": digest, "file": str(path), "width": None, "height": None,
                    "visual_type": "object", "absolutePath": str(path.resolve())}
    deck_root = Path(__file__).resolve().parents[1] / "assets" / "curated-deck-verified"
    for path in deck_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest() == digest:
            return {"asset_hash": digest, "file": str(path), "width": None, "height": None,
                    "visual_type": "object", "absolutePath": str(path.resolve())}
    engine_room_root = Path(__file__).resolve().parents[1] / "assets" / "curated-engine-room-verified"
    for path in engine_room_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest() == digest:
            return {"asset_hash": digest, "file": str(path), "width": None, "height": None,
                    "visual_type": "object", "absolutePath": str(path.resolve())}
    cargo_root = Path(__file__).resolve().parents[1] / "assets" / "curated-cargo-verified"
    for path in cargo_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest() == digest:
            return {"asset_hash": digest, "file": str(path), "width": None, "height": None,
                    "visual_type": "object", "absolutePath": str(path.resolve())}
    bridge_electronics_root = Path(__file__).resolve().parents[1] / "assets" / "curated-bridge-electronics-verified"
    for path in bridge_electronics_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest() == digest:
            return {"asset_hash": digest, "file": str(path), "width": None, "height": None,
                    "visual_type": "object", "absolutePath": str(path.resolve())}
    bridge_controls_root = Path(__file__).resolve().parents[1] / "assets" / "curated-bridge-controls-verified"
    for path in bridge_controls_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest() == digest:
            return {"asset_hash":digest,"file":str(path),"width":None,"height":None,"visual_type":"object","absolutePath":str(path.resolve())}
    firefighting_root = Path(__file__).resolve().parents[1] / "assets" / "curated-firefighting-verified"
    for path in firefighting_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest() == digest:
            return {"asset_hash":digest,"file":str(path),"width":None,"height":None,"visual_type":"object","absolutePath":str(path.resolve())}
    damage_control_root=Path(__file__).resolve().parents[1]/"assets"/"curated-damage-control-verified"
    for path in damage_control_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest()==digest:
            return {"asset_hash":digest,"file":str(path),"width":None,"height":None,"visual_type":"object","absolutePath":str(path.resolve())}
    pilotage_access_root=Path(__file__).resolve().parents[1]/"assets"/"curated-pilotage-access-verified"
    for path in pilotage_access_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest()==digest:
            return {"asset_hash":digest,"file":str(path),"width":None,"height":None,"visual_type":"object","absolutePath":str(path.resolve())}
    distress_signals_root=Path(__file__).resolve().parents[1]/"assets"/"curated-distress-signals-verified"
    for path in distress_signals_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest()==digest:
            return {"asset_hash":digest,"file":str(path),"width":None,"height":None,"visual_type":"object","absolutePath":str(path.resolve())}
    oil_spill_root=Path(__file__).resolve().parents[1]/"assets"/"curated-oil-spill-response-verified"
    for path in oil_spill_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest()==digest:
            return {"asset_hash":digest,"file":str(path),"width":None,"height":None,"visual_type":"object","absolutePath":str(path.resolve())}
    hull_underwater_root=Path(__file__).resolve().parents[1]/"assets"/"curated-hull-underwater-verified"
    for path in hull_underwater_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest()==digest:
            return {"asset_hash":digest,"file":str(path),"width":None,"height":None,"visual_type":"object","absolutePath":str(path.resolve())}
    vessel_types_root=Path(__file__).resolve().parents[1]/"assets"/"curated-vessel-types-verified"
    for path in vessel_types_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest()==digest:
            return {"asset_hash":digest,"file":str(path),"width":None,"height":None,"visual_type":"object","absolutePath":str(path.resolve())}
    specialized_vessels_root=Path(__file__).resolve().parents[1]/"assets"/"curated-specialized-vessels-verified"
    for path in specialized_vessels_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest()==digest:
            return {"asset_hash":digest,"file":str(path),"width":None,"height":None,"visual_type":"object","absolutePath":str(path.resolve())}
    passenger_work_root=Path(__file__).resolve().parents[1]/"assets"/"curated-passenger-work-vessels-verified"
    for path in passenger_work_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest()==digest:
            return {"asset_hash":digest,"file":str(path),"width":None,"height":None,"visual_type":"object","absolutePath":str(path.resolve())}
    naval_support_root=Path(__file__).resolve().parents[1]/"assets"/"curated-naval-support-vessels-verified"
    for path in naval_support_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest()==digest:
            return {"asset_hash":digest,"file":str(path),"width":None,"height":None,"visual_type":"object","absolutePath":str(path.resolve())}
    shipyard_port_root=Path(__file__).resolve().parents[1]/"assets"/"curated-shipyard-port-verified"
    for path in shipyard_port_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest()==digest:
            return {"asset_hash":digest,"file":str(path),"width":None,"height":None,"visual_type":"object","absolutePath":str(path.resolve())}
    survival_craft_gear_root=Path(__file__).resolve().parents[1]/"assets"/"curated-survival-craft-gear-verified"
    for path in survival_craft_gear_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest()==digest:
            return {"asset_hash":digest,"file":str(path),"width":None,"height":None,"visual_type":"object","absolutePath":str(path.resolve())}
    maritime_knots_root=Path(__file__).resolve().parents[1]/"assets"/"curated-maritime-knots-verified"
    for path in maritime_knots_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest()==digest:
            return {"asset_hash":digest,"file":str(path),"width":None,"height":None,"visual_type":"object","absolutePath":str(path.resolve())}
    maritime_knots_advanced_root=Path(__file__).resolve().parents[1]/"assets"/"curated-maritime-knots-advanced-verified"
    for path in maritime_knots_advanced_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest()==digest:
            return {"asset_hash":digest,"file":str(path),"width":None,"height":None,"visual_type":"object","absolutePath":str(path.resolve())}
    shipboard_ppe_root=Path(__file__).resolve().parents[1]/"assets"/"curated-shipboard-ppe-verified"
    for path in shipboard_ppe_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest()==digest:
            return {"asset_hash":digest,"file":str(path),"width":None,"height":None,"visual_type":"object","absolutePath":str(path.resolve())}
    shipboard_industrial_ppe_root=Path(__file__).resolve().parents[1]/"assets"/"curated-shipboard-industrial-ppe-verified"
    for path in shipboard_industrial_ppe_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest()==digest:
            return {"asset_hash":digest,"file":str(path),"width":None,"height":None,"visual_type":"object","absolutePath":str(path.resolve())}
    kaiyodai_navigation_root=Path(__file__).resolve().parents[1]/"assets"/"curated-kaiyodai-navigation-schematics"
    for path in kaiyodai_navigation_root.glob("*.webp"):
        if __import__("hashlib").sha256(path.read_bytes()).hexdigest()==digest:
            return {"asset_hash":digest,"file":str(path),"width":None,"height":None,"visual_type":"diagram","absolutePath":str(path.resolve())}
    statements = [
        "select asset_hash,file,width,height,'page' visual_type from page_plates where asset_hash=?",
        "select asset_hash,file,width,height,'object' visual_type from embedded_visuals where asset_hash=? and status='ready'",
    ]
    params = [digest, digest]
    if table_exists(db, "visual_regions"):
        statements.append("select asset_hash,file,width,height,kind visual_type from visual_regions where asset_hash=? and status='ready'")
        params.append(digest)
    row = db.execute(" union all ".join(statements) + " limit 1", params).fetchone()
    if not row:
        raise RuntimeError("ASSET_NOT_INDEXED")
    path = (atlas / row["file"]).resolve()
    if atlas not in path.parents or not path.is_file():
        raise RuntimeError("ASSET_FILE_UNAVAILABLE")
    return {**dict(row), "absolutePath": str(path)}


def status(db: sqlite3.Connection) -> dict:
    statuses = dict(db.execute("select status,count(*) from documents group by status"))
    total_pages = db.execute("select coalesce(sum(page_count),0) from documents").fetchone()[0]
    page_plates = db.execute("select count(*) from page_plates").fetchone()[0]
    result = {
        "schemaVersion": db.execute("select value from meta where key='schema_version'").fetchone()[0],
        "documents": db.execute("select count(*) from documents").fetchone()[0],
        "locations": db.execute("select count(*) from locations").fetchone()[0],
        "totalPages": total_pages,
        "pagePlates": page_plates,
        "pageProgressPercent": round(100 * page_plates / total_pages, 2) if total_pages else 100.0,
        "embeddedVisuals": db.execute("select count(*) from embedded_visuals where status='ready'").fetchone()[0],
        "inventoryFailures": db.execute("select count(*) from inventory_failures").fetchone()[0],
        "statuses": statuses,
    }
    result["visualRegions"] = db.execute("select count(*) from visual_regions where status='ready'").fetchone()[0] if table_exists(db, "visual_regions") else 0
    result["regionScannedPages"] = db.execute("select count(*) from region_scans where status='complete'").fetchone()[0] if table_exists(db, "region_scans") else 0
    result["regionExpectedPages"] = db.execute("select coalesce(sum(page_count),0) from documents where status='complete'").fetchone()[0]
    result["finalized"] = table_exists(db, "visual_search")
    return result


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--atlas", type=Path, required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--query")
    mode.add_argument("--query-base64")
    mode.add_argument("--asset-hash")
    mode.add_argument("--status", action="store_true")
    parser.add_argument("--limit", type=int, default=3)
    parser.add_argument("--object-only", action="store_true")
    args = parser.parse_args()
    atlas = args.atlas.resolve()
    catalog = (atlas / "catalog.sqlite").resolve().as_posix()
    db = sqlite3.connect(f"file:{catalog}?mode=ro&immutable=1", uri=True)
    db.row_factory = sqlite3.Row
    if args.status:
        output = status(db)
    elif args.asset_hash:
        output = resolve_asset(db, atlas, args.asset_hash)
    else:
        query_value = args.query
        if args.query_base64:
            query_value = base64.b64decode(args.query_base64, validate=True).decode("utf-8")
        output = {"visuals": query(db, query_value, max(1, min(args.limit, 10)), args.object_only)}
    print(json.dumps(output, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
