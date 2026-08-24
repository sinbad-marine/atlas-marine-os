import importlib.util
import sqlite3
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
    plain_ais_queries = (
        "AIS nedir ve fotoğrafını göster",
        "AIS nasıl çalışır görseli var mı",
        "Bana AIS fotoğrafı göster",
        "Gemilerde AIS ne işe yarar? Fotoğrafını da göster",
    )
    plain_ais = [MODULE.curated_navigation_query(question, 3) for question in plain_ais_queries]
    gyro = MODULE.curated_navigation_query("cayro pusula ile kerteriz alma fotoğrafı", 3)
    assert radar[0]["visual_key"] == "curated:navigation:bridge-radar-console"
    assert sextant[0]["visual_key"] == "curated:navigation:sextant-sun-sight"
    assert lines[0]["visual_key"] == "curated:navigation:anchor-detail-preparation"
    assert communications[0]["visual_key"] == "curated:navigation:bridge-to-bridge-communications"
    assert compass[0]["visual_key"] == "curated:navigation:magnetic-compass-binnacle"
    assert ecdis[0]["visual_key"] == "curated:navigation:integrated-navigation-bridge"
    assert ais[0]["visual_key"] == "curated:navigation:ais-ship-tracking-display"
    assert all(result[0]["visual_key"] == "curated:navigation:ais-ship-tracking-display" for result in plain_ais)
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


def test_verified_cardinal_buoy_photos_match_real_object_queries():
    cardinal = MODULE.curated_aids_query("kardinal şamandıra fotoğrafını göster", 3)
    south = MODULE.curated_aids_query("güney kardinal şamandıra nasıl görünür", 3)
    assert cardinal[0]["visual_key"] == "curated:aids:cardinal-buoys-deployment"
    assert south[0]["visual_key"] == "curated:aids:south-cardinal-buoy"
    assert all(item[0]["sourcePaths"][0].startswith("https://") for item in (cardinal, south))


def test_verified_lateral_and_special_aids_match_exact_queries():
    port = MODULE.curated_aids_query("iskele lateral şamandırasının fotoğrafını göster", 3)
    starboard = MODULE.curated_aids_query("sancak lateral şamandırası nasıl görünür", 3)
    safe = MODULE.curated_aids_query("emniyetli su işaretinin fotoğrafını göster", 3)
    danger = MODULE.curated_aids_query("izole tehlike işareti nasıl görünür", 3)
    assert port[0]["visual_key"] == "curated:aids:port-hand-lateral-buoy"
    assert starboard[0]["visual_key"] == "curated:aids:starboard-hand-lateral-buoy"
    assert safe[0]["visual_key"] == "curated:aids:safe-water-mark"
    assert danger[0]["visual_key"] == "curated:aids:isolated-danger-mark"
    assert all(item[0]["sourcePaths"][0].startswith("https://") for item in (port, starboard, safe, danger))


def test_verified_lighthouse_photos_match_distinct_object_queries():
    lighthouse = MODULE.curated_lighthouse_query("deniz feneri fotoğrafını göster", 3)
    optics = MODULE.curated_lighthouse_query("deniz feneri merceği nasıl görünür", 3)
    lightship = MODULE.curated_lighthouse_query("fener gemisi fotoğrafını göster", 3)
    assert lighthouse[0]["visual_key"] == "curated:lighthouse:harbor-lighthouse"
    assert optics[0]["visual_key"] == "curated:lighthouse:lighthouse-optics"
    assert lightship[0]["visual_key"] == "curated:lighthouse:lightship-carpentaria"
    assert all(item[0]["sourcePaths"][0].startswith("https://") for item in (lighthouse, optics, lightship))


def test_verified_deck_equipment_photos_match_exact_hardware_queries():
    windlass = MODULE.curated_deck_query("demir ırgatının fotoğrafını göster", 3)
    winch = MODULE.curated_deck_query("bağlama vinci nasıl görünür", 3)
    bitts = MODULE.curated_deck_query("gemi babasına halat volta fotoğrafı", 3)
    fairlead = MODULE.curated_deck_query("ayarlanabilir kurtağzı görseli", 3)
    assert windlass[0]["visual_key"] == "curated:deck:anchor-windlass"
    assert winch[0]["visual_key"] == "curated:deck:mooring-winch"
    assert bitts[0]["visual_key"] == "curated:deck:ship-bitts"
    assert fairlead[0]["visual_key"] == "curated:deck:adjustable-fairlead"
    assert all(item[0]["sourcePaths"][0].startswith("https://") for item in (windlass, winch, bitts, fairlead))


def test_verified_engine_room_photos_keep_equipment_scopes_distinct():
    main = MODULE.curated_engine_room_query("gemi ana makinesinin fotoğrafını göster", 3)
    room = MODULE.curated_engine_room_query("gemi makine dairesi genel görünümü", 3)
    boiler = MODULE.curated_engine_room_query("kazan muayene kapağı nasıl görünür", 3)
    steam = MODULE.curated_engine_room_query("gemi buhar makinesi fotoğrafı", 3)
    assert main[0]["visual_key"] == "curated:engine-room:main-engine"
    assert room[0]["visual_key"] == "curated:engine-room:engine-room"
    assert boiler[0]["visual_key"] == "curated:engine-room:boiler-opening"
    assert steam[0]["visual_key"] == "curated:engine-room:steam-engine-room"
    assert MODULE.curated_engine_room_query("pürifayer fotoğrafı", 3) == []


def test_verified_cargo_photos_match_exact_operations_and_hardware():
    twistlock = MODULE.curated_cargo_query("konteyner twistlock fotoğrafını göster", 3)
    crane = MODULE.curated_cargo_query("gemi yük vinci nasıl görünür", 3)
    hatch = MODULE.curated_cargo_query("katlanır ambar kapağı fotoğrafı", 3)
    loading = MODULE.curated_cargo_query("konteyner yükleme operasyonu görseli", 3)
    assert twistlock[0]["visual_key"] == "curated:cargo:container-twistlock"
    assert crane[0]["visual_key"] == "curated:cargo:ship-cargo-crane"
    assert hatch[0]["visual_key"] == "curated:cargo:folding-hatch-covers"
    assert loading[0]["visual_key"] == "curated:cargo:container-loading"
    assert MODULE.curated_cargo_query("dökme yük kepçesi fotoğrafı", 3) == []


def test_verified_bridge_electronics_match_exact_device_queries():
    ais = MODULE.curated_bridge_electronics_query("AIS cihazı ve fotoğrafını göster", 3)
    radar = MODULE.curated_bridge_electronics_query("gemi radarı ekranı nasıl görünür", 3)
    ecdis = MODULE.curated_bridge_electronics_query("ECDIS ekran fotoğrafını göster", 3)
    vhf = MODULE.curated_bridge_electronics_query("deniz VHF telsiz cihazı görseli", 3)
    assert ais[0]["visual_key"] == "curated:bridge-electronics:ais-display"
    assert radar[0]["visual_key"] == "curated:bridge-electronics:radar-display"
    assert ecdis[0]["visual_key"] == "curated:bridge-electronics:ecdis-display"
    assert vhf[0]["visual_key"] == "curated:bridge-electronics:vhf-radio"
    assert MODULE.curated_bridge_electronics_query("manyetik pusula fotoğrafı", 3) == []
    integrated = MODULE.query(sqlite3.connect(":memory:"), "AIS cihazı ve fotoğrafını göster", 3, True)
    assert integrated[0]["visual_key"] == "curated:bridge-electronics:ais-display"


def test_verified_bridge_controls_keep_hardware_and_operation_distinct():
    telegraph = MODULE.curated_bridge_controls_query("makine telgrafı fotoğrafını göster", 3)
    modern = MODULE.curated_bridge_controls_query("modern dümen konsolu görseli", 3)
    wheel = MODULE.curated_bridge_controls_query("klasik gemi dümeni fotoğrafı", 3)
    watch = MODULE.curated_bridge_controls_query("dümen vardiyası nasıl görünür", 3)
    assert telegraph[0]["visual_key"] == "curated:bridge-controls:engine-order-telegraph"
    assert modern[0]["visual_key"] == "curated:bridge-controls:modern-helm-console"
    assert wheel[0]["visual_key"] == "curated:bridge-controls:traditional-ship-wheel"
    assert watch[0]["visual_key"] == "curated:bridge-controls:helmsman-watch"
    assert MODULE.curated_bridge_controls_query("manyetik pusula fotoğrafı", 3) == []


def test_verified_firefighting_photos_match_exact_equipment_and_operations():
    extinguisher=MODULE.curated_firefighting_query("taşınabilir yangın söndürücü fotoğrafı",3)
    hose=MODULE.curated_firefighting_query("gemi yangın hortumu istasyonu",3)
    nozzle=MODULE.curated_firefighting_query("yangın nozulu kullanımı görseli",3)
    drench=MODULE.curated_firefighting_query("yük ambarı drencher sistemi fotoğrafı",3)
    assert extinguisher[0]["visual_key"]=="curated:firefighting:portable-extinguisher"
    assert hose[0]["visual_key"]=="curated:firefighting:fire-hose-station"
    assert nozzle[0]["visual_key"]=="curated:firefighting:fire-nozzle-operation"
    assert drench[0]["visual_key"]=="curated:firefighting:cargo-hold-drenching"
    assert MODULE.curated_firefighting_query("yangın alarm paneli",3)==[]


def test_verified_damage_control_photos_match_exact_hardware_and_actions():
    door=MODULE.curated_damage_control_query("su geçirmez kapı fotoğrafı",3)
    pump=MODULE.curated_damage_control_query("P-100 dewatering pump görseli",3)
    shore=MODULE.curated_damage_control_query("çelik shoring uygulaması",3)
    flood=MODULE.curated_damage_control_query("su basmış kompartıman tahliyesi",3)
    assert door[0]["visual_key"]=="curated:damage-control:watertight-door"
    assert pump[0]["visual_key"]=="curated:damage-control:dewatering-pump"
    assert shore[0]["visual_key"]=="curated:damage-control:steel-shoring"
    assert flood[0]["visual_key"]=="curated:damage-control:flooded-compartment"
    assert MODULE.curated_damage_control_query("yangın nozulu",3)==[]


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
    test_verified_cardinal_buoy_photos_match_real_object_queries()
    test_verified_lateral_and_special_aids_match_exact_queries()
    test_verified_lighthouse_photos_match_distinct_object_queries()
    test_verified_deck_equipment_photos_match_exact_hardware_queries()
    test_verified_engine_room_photos_keep_equipment_scopes_distinct()
    test_verified_cargo_photos_match_exact_operations_and_hardware()
    test_verified_bridge_electronics_match_exact_device_queries()
    test_verified_bridge_controls_keep_hardware_and_operation_distinct()
    test_verified_firefighting_photos_match_exact_equipment_and_operations()
    test_verified_damage_control_photos_match_exact_hardware_and_actions()
    print("20 curated visual query tests passed")
