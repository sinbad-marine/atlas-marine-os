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


def test_fire_control_plan_queries_route_to_exact_sis_catalogue_signs():
    hydrant = MODULE.curated_symbol_query("yangın hidrantı sembolü", 3)
    co2 = MODULE.curated_symbol_query("CO2 söndürme sistemi işareti", 3)
    panel = MODULE.curated_symbol_query("yangın alarm paneli sembolü", 3)
    assert hydrant[0]["visual_key"] == "curated:imo-a1116-sis:sis-034-fire-hydrant"
    assert co2[0]["visual_key"] == "curated:imo-a1116-sis:sis-046-co2-fire-extinguishing-system"
    assert panel[0]["visual_key"] == "curated:imo-a1116-sis:sis-052-fire-detection-alarm-control-panel"
    assert {hydrant[0]["page_number"], co2[0]["page_number"], panel[0]["page_number"]} == {13, 14}


def test_verified_navigation_photos_have_exact_topics_and_provenance():
    radar = MODULE.curated_navigation_query("gemi radarı fotoğrafını göster", 3)
    sextant = MODULE.curated_navigation_query("sekstant nasıl kullanılır", 3)
    lines = MODULE.curated_navigation_query("halat manevrası görseli", 3)
    communications = MODULE.curated_navigation_query("köprüüstü haberleşme fotoğrafı", 3)
    compass = MODULE.curated_navigation_query("manyetik pusula fotoğrafını göster", 3)
    ecdis = MODULE.curated_navigation_query("ECDIS ekranını göster", 3)
    ais = MODULE.curated_navigation_query("AIS cihazının görselini göster", 3)
    plain_ais = MODULE.curated_navigation_query("AIS nedir ve fotoğrafını göster", 3)
    gyro = MODULE.curated_navigation_query("cayro pusula ile kerteriz alma fotoğrafı", 3)
    assert radar[0]["visual_key"] == "curated:navigation:bridge-radar-console"
    assert sextant[0]["visual_key"] == "curated:navigation:sextant-sun-sight"
    assert lines[0]["visual_key"] == "curated:navigation:anchor-detail-preparation"
    assert communications[0]["visual_key"] == "curated:navigation:bridge-to-bridge-communications"
    assert compass[0]["visual_key"] == "curated:navigation:magnetic-compass-binnacle"
    assert ecdis[0]["visual_key"] == "curated:navigation:integrated-navigation-bridge"
    assert ais[0]["visual_key"] == "curated:navigation:ais-ship-tracking-display"
    assert plain_ais[0]["visual_key"] == "curated:navigation:ais-ship-tracking-display"
    assert gyro[0]["visual_key"] == "curated:navigation:gyrocompass-bearing-operation"
    assert all(item[0]["sourcePaths"][0].startswith("https://") for item in (radar, sextant, lines, communications, compass, ecdis, ais, gyro))
    assert MODULE.curated_navigation_query("can salının fotoğrafını göster", 3) == []


def test_verified_safety_photos_are_connected_to_exact_equipment_queries():
    lifebuoy = MODULE.curated_safety_query("can simidinin fotoğrafını göster", 3)
    liferaft = MODULE.curated_safety_query("can salının fotoğrafını göster", 3)
    epirb = MODULE.curated_safety_query("EPIRB cihazının fotoğrafı", 3)
    eebd = MODULE.curated_safety_query("EEBD nasıl takılır", 3)
    assert lifebuoy[0]["visual_key"] == "curated:safety:lifebuoy-scarborough"
    assert liferaft[0]["visual_key"] == "curated:safety:inflatable-life-raft-us-navy"
    assert epirb[0]["visual_key"] == "curated:safety:epirb-ferry-vi"
    assert eebd[0]["visual_key"] == "curated:safety:eebd-training-us-navy"
    assert all(item[0]["sourcePaths"][0].startswith("https://") for item in (lifebuoy, liferaft, epirb, eebd))


def test_verified_marine_weather_photos_match_exact_conditions():
    fog = MODULE.curated_weather_query("limanda sis fotoğrafını göster", 3)
    lightning = MODULE.curated_weather_query("denizde yıldırım görseli", 3)
    heavy_seas = MODULE.curated_weather_query("ağır denizde büyük dalga fotoğrafı", 3)
    assert fog[0]["visual_key"] == "curated:weather:marine-fog-harbor"
    assert lightning[0]["visual_key"] == "curated:weather:marine-thunderstorm-lightning"
    assert heavy_seas[0]["visual_key"] == "curated:weather:ship-heavy-seas"
    assert all(item[0]["sourcePaths"][0].startswith("https://") for item in (fog, lightning, heavy_seas))


if __name__ == "__main__":
    test_turkish_lifebuoy_symbol_prefers_exact_official_crop()
    test_object_photo_request_does_not_route_to_symbol_collection()
    test_epirb_and_sart_resolve_to_distinct_official_symbols()
    test_escape_emergency_and_fire_queries_stay_in_their_categories()
    test_prohibition_warning_and_mandatory_queries_use_exact_current_symbols()
    test_lifeboat_launch_sequence_symbol_is_available_without_displacing_photos()
    test_fire_control_plan_queries_route_to_exact_sis_catalogue_signs()
    test_verified_navigation_photos_have_exact_topics_and_provenance()
    test_verified_safety_photos_are_connected_to_exact_equipment_queries()
    test_verified_marine_weather_photos_match_exact_conditions()
    print("10 curated visual query tests passed")
