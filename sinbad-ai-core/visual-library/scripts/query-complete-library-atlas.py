"""Query or resolve immutable assets from the private SINBAD visual atlas."""

from __future__ import annotations

import argparse
import base64
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


def query(db: sqlite3.Connection, value: str, limit: int, object_only: bool = False) -> list[dict]:
    curated = curated_symbol_query(value, limit)
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
        rows = db.execute(
            """select visual_key,visual_type,document_hash,page_number,image_number,asset_hash,file,
                      title,volume,heading,context,topics,source_paths,bm25(visual_search) rank
               from visual_search where visual_search match ?""" + type_clause + """
               order by rank,case visual_type when 'object' then 0 when 'table' then 1 when 'vector' then 1 else 2 end limit ?""",
            (expression, limit - len(curated)),
        ).fetchall()
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
        rows = sorted(
            rows,
            key=lambda row: sum(
                token in f"{row['heading'] or ''} {row['context'] or ''} {row['topics'] or ''}".casefold()
                for token in wanted
            ),
            reverse=True,
        )[:limit]
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
