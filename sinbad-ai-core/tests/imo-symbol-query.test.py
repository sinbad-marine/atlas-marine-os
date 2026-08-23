import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "visual-library" / "scripts" / "query-complete-library-atlas.py"
SPEC = importlib.util.spec_from_file_location("visual_atlas_query", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_turkish_lifebuoy_symbol_prefers_exact_official_crop():
    results = MODULE.curated_symbol_query("can simidi sembolünü göster", 3)
    assert results[0]["visual_key"] == "curated:imo-a760:lifebuoy"
    assert all(item["title"] == "IMO Resolution A.760(18)" for item in results)


def test_object_photo_request_does_not_route_to_symbol_collection():
    assert MODULE.curated_symbol_query("can simidinin fotoğrafını göster", 3) == []


def test_epirb_and_sart_resolve_to_distinct_official_symbols():
    epirb = MODULE.curated_symbol_query("EPIRB sembolü", 3)
    sart = MODULE.curated_symbol_query("SART işareti", 3)
    assert epirb[0]["visual_key"] == "curated:imo-a760:epirb"
    assert sart[0]["visual_key"] == "curated:imo-a760:radar-transponder-sart"
    assert epirb[0]["asset_hash"] != sart[0]["asset_hash"]


if __name__ == "__main__":
    test_turkish_lifebuoy_symbol_prefers_exact_official_crop()
    test_object_photo_request_does_not_route_to_symbol_collection()
    test_epirb_and_sart_resolve_to_distinct_official_symbols()
    print("3 IMO symbol query tests passed")
