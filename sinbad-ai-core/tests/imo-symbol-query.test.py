import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "visual-library" / "scripts" / "query-complete-library-atlas.py"
SPEC = importlib.util.spec_from_file_location("visual_atlas_query", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_turkish_lifebuoy_symbol_prefers_exact_official_crop():
    results = MODULE.curated_symbol_query("can simidi sembolünü göster", 3)
    assert results[0]["visual_key"] == "curated:imo-a1116-lss:lifebuoy"
    assert results[0]["title"] == "IMO Resolution A.1116(30)"


def test_object_photo_request_does_not_route_to_symbol_collection():
    assert MODULE.curated_symbol_query("can simidinin fotoğrafını göster", 3) == []


def test_epirb_and_sart_resolve_to_distinct_official_symbols():
    epirb = MODULE.curated_symbol_query("EPIRB sembolü", 3)
    sart = MODULE.curated_symbol_query("SART işareti", 3)
    assert epirb[0]["visual_key"] == "curated:imo-a1116-lss:epirb"
    assert sart[0]["visual_key"] == "curated:imo-a1116-lss:search-and-rescue-transponder"
    assert epirb[0]["asset_hash"] != sart[0]["asset_hash"]


def test_escape_emergency_and_fire_queries_stay_in_their_categories():
    assembly = MODULE.curated_symbol_query("toplanma istasyonu sembolü", 3)
    eebd = MODULE.curated_symbol_query("EEBD işareti", 3)
    extinguisher = MODULE.curated_symbol_query("yangın söndürücü sembolü", 3)
    assert assembly[0]["visual_key"] == "curated:imo-a1116-safety:mes-shipboard-assembly-station"
    assert eebd[0]["visual_key"] == "curated:imo-a1116-safety:ees-emergency-escape-breathing-device"
    assert extinguisher[0]["visual_key"] == "curated:imo-a1116-safety:fes-fire-extinguisher"


def test_prohibition_warning_and_mandatory_queries_use_exact_current_symbols():
    no_smoking = MODULE.curated_symbol_query("sigara içilmez işareti", 3)
    flammable = MODULE.curated_symbol_query("yanıcı madde sembolü", 3)
    helmet = MODULE.curated_symbol_query("baret tak işareti", 3)
    assert no_smoking[0]["visual_key"] == "curated:imo-a1116-operational:pss-no-smoking"
    assert flammable[0]["visual_key"] == "curated:imo-a1116-operational:wss-flammable-material"
    assert helmet[0]["visual_key"] == "curated:imo-a1116-operational:mss-wear-head-protection"


def test_lifeboat_launch_sequence_symbol_is_available_without_displacing_photos():
    symbol = MODULE.curated_symbol_query("filikayı suya indir sembolü", 3)
    assert symbol[0]["visual_key"] == "curated:imo-a1116-operational:mss-lower-lifeboat-to-water"
    assert MODULE.curated_symbol_query("filikanın fotoğrafını göster", 3) == []


if __name__ == "__main__":
    test_turkish_lifebuoy_symbol_prefers_exact_official_crop()
    test_object_photo_request_does_not_route_to_symbol_collection()
    test_epirb_and_sart_resolve_to_distinct_official_symbols()
    test_escape_emergency_and_fire_queries_stay_in_their_categories()
    test_prohibition_warning_and_mandatory_queries_use_exact_current_symbols()
    test_lifeboat_launch_sequence_symbol_is_available_without_displacing_photos()
    print("6 IMO symbol query tests passed")
