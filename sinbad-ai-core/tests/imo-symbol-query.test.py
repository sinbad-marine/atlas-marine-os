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


def test_chart_no_1_questions_use_complete_public_domain_table_pages():
    results = MODULE.chart_no_1_table_page_query("batık harita sembolünü göster", 3)
    assert results
    assert results[0]["page_number"] == 52
    assert all(item["visual_type"] == "chart-table-highlight" for item in results)
    assert all(item["document_hash"] == "247f548eaa45db815e1c49fea9785e966a6e8dd9e4771abc26d4dad473488a1e" for item in results)
    resolved = MODULE.resolve_asset(None, Path("."), results[0]["asset_hash"])
    assert resolved["visual_type"] == "chart-table-highlight"
    assert Path(resolved["absolutePath"]).is_file()
    assert results[0]["highlightBox"] is not None
    assert MODULE.chart_no_1_table_page_query("şamandıra harita sembolünü göster", 1)[0]["page_number"] in range(90, 103)
    assert MODULE.chart_no_1_table_page_query("radar harita sembolünü göster", 1)[0]["page_number"] in range(104, 107)
    assert MODULE.chart_no_1_table_page_query("gelgit akıntı tablosunu göster", 1)[0]["page_number"] in range(39, 43)
    assert MODULE.chart_no_1_table_page_query("liman rıhtım sembollerini göster", 1)[0]["page_number"] in range(32, 39)
    assert MODULE.chart_no_1_table_page_query("pilot hizmet sembolünü göster", 1)[0]["page_number"] in range(107, 109)
    isolated = MODULE.chart_no_1_table_page_query(
        "tescil edilmiş sığlık şamandırası sembolünü göster", 1
    )[0]
    assert isolated["page_number"] == 101
    assert isolated["image_number"] == "130.4"
    assert isolated["visual_type"] == "chart-table-highlight"


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


def test_verified_pilotage_access_photos_match_exact_operations():
    ladder=MODULE.curated_pilotage_access_query("loçman çarmıhı kullanımı",3)
    boat=MODULE.curated_pilotage_access_query("pilot botu fotoğrafı",3)
    gangway=MODULE.curated_pilotage_access_query("borda merdiveni kurulumu",3)
    tug=MODULE.curated_pilotage_access_query("römorkör halatı operasyonu",3)
    assert ladder[0]["visual_key"]=="curated:pilotage-access:pilot-ladder-operation"
    assert boat[0]["visual_key"]=="curated:pilotage-access:pilot-boat-limassol"
    assert gangway[0]["visual_key"]=="curated:pilotage-access:accommodation-ladder-operation"
    assert tug[0]["visual_key"]=="curated:pilotage-access:harbor-tug-line-operation"
    assert MODULE.curated_pilotage_access_query("can salı fotoğrafı",3)==[]


def test_verified_distress_signal_photos_match_exact_equipment():
    flare=MODULE.curated_distress_signals_query("MK-124 kırmızı imdat fişeği",3)
    smoke=MODULE.curated_distress_signals_query("turuncu duman işareti nasıl görünür",3)
    thrower=MODULE.curated_distress_signals_query("halat atma cihazı fotoğrafı",3)
    assert flare[0]["visual_key"]=="curated:distress-signals:mk124-distress-signal"
    assert smoke[0]["visual_key"]=="curated:distress-signals:orange-smoke-signal"
    assert thrower[0]["visual_key"]=="curated:distress-signals:line-throwing-appliance"
    assert MODULE.curated_distress_signals_query("radar ekranı fotoğrafı",3)==[]


def test_verified_oil_spill_response_photos_match_exact_systems():
    boom=MODULE.curated_oil_spill_response_query("petrol bariyeri yerleştirme",3)
    weir=MODULE.curated_oil_spill_response_query("Weir skimmer fotoğrafı",3)
    voss=MODULE.curated_oil_spill_response_query("VOSS gemi petrol toplama sistemi",3)
    dip=MODULE.curated_oil_spill_response_query("DIP 600 skimmer tatbikatı",3)
    assert boom[0]["visual_key"]=="curated:oil-spill-response:containment-boom-deployment"
    assert weir[0]["visual_key"]=="curated:oil-spill-response:weir-skimmer-operation"
    assert voss[0]["visual_key"]=="curated:oil-spill-response:voss-skimming-vessel"
    assert dip[0]["visual_key"]=="curated:oil-spill-response:dynamic-inclined-plane-skimmer"
    assert MODULE.curated_oil_spill_response_query("can simidi fotoğrafı",3)==[]


def test_verified_hull_underwater_photos_match_exact_components():
    bow=MODULE.curated_hull_underwater_query("yumrubaş fotoğrafı",3)
    propeller=MODULE.curated_hull_underwater_query("gemi pervanesi montajı",3)
    rudder=MODULE.curated_hull_underwater_query("gemi dümeni denetimi",3)
    hull=MODULE.curated_hull_underwater_query("karina denetimi fotoğrafı",3)
    assert bow[0]["visual_key"]=="curated:hull-underwater:bulbous-bow-underway"
    assert propeller[0]["visual_key"]=="curated:hull-underwater:propeller-installation"
    assert rudder[0]["visual_key"]=="curated:hull-underwater:rudder-propeller-inspection"
    assert hull[0]["visual_key"]=="curated:hull-underwater:underwater-hull-inspection"
    assert MODULE.curated_hull_underwater_query("radar ekranı",3)==[]


def test_verified_vessel_type_photos_match_exact_ship_classes():
    container=MODULE.curated_vessel_types_query("konteyner gemisinin fotoğrafını göster",3)
    tanker=MODULE.curated_vessel_types_query("petrol tankeri nasıl görünür",3)
    bulk=MODULE.curated_vessel_types_query("dökme yük gemisi fotoğrafı",3)
    roro=MODULE.curated_vessel_types_query("Ro-Ro gemisinin rampasını göster",3)
    assert container[0]["visual_key"]=="curated:vessel-types:container-ship-underway"
    assert tanker[0]["visual_key"]=="curated:vessel-types:oil-tanker-underway"
    assert bulk[0]["visual_key"]=="curated:vessel-types:bulk-carrier-moored"
    assert roro[0]["visual_key"]=="curated:vessel-types:ro-ro-ship-ramp-deployed"
    assert MODULE.curated_vessel_types_query("can simidi fotoğrafı",3)==[]


def test_verified_specialized_vessel_photos_match_exact_ship_classes():
    lng=MODULE.curated_specialized_vessels_query("LNG tankerinin küresel tanklarını göster",3)
    chemical=MODULE.curated_specialized_vessels_query("kimyasal tanker fotoğrafı",3)
    car=MODULE.curated_specialized_vessels_query("araç taşıyıcı gemi nasıl görünür",3)
    heavy=MODULE.curated_specialized_vessels_query("yarı batabilir ağır yük gemisi",3)
    assert lng[0]["visual_key"]=="curated:specialized-vessels:lng-carriers-under-construction"
    assert chemical[0]["visual_key"]=="curated:specialized-vessels:chemical-tanker-doris"
    assert car[0]["visual_key"]=="curated:specialized-vessels:car-carrier-tosca"
    assert heavy[0]["visual_key"]=="curated:specialized-vessels:semi-submersible-heavy-lift-ship"
    assert MODULE.curated_specialized_vessels_query("can salı fotoğrafı",3)==[]


def test_verified_passenger_and_work_vessel_photos_match_exact_classes():
    cruise=MODULE.curated_passenger_work_vessels_query("kruvaziyer gemisinin fotoğrafını göster",3)
    ferry=MODULE.curated_passenger_work_vessels_query("yolcu feribotu nasıl görünür",3)
    trawler=MODULE.curated_passenger_work_vessels_query("balıkçı trolü fotoğrafı",3)
    dredger=MODULE.curated_passenger_work_vessels_query("deniz dibi tarama gemisi görseli",3)
    assert cruise[0]["visual_key"]=="curated:passenger-work-vessels:cruise-ship-underway"
    assert ferry[0]["visual_key"]=="curated:passenger-work-vessels:passenger-ferry-underway"
    assert trawler[0]["visual_key"]=="curated:passenger-work-vessels:fishing-trawler-underway"
    assert dredger[0]["visual_key"]=="curated:passenger-work-vessels:dredger-viking"
    assert MODULE.curated_passenger_work_vessels_query("radar ekranı",3)==[]


def test_verified_naval_and_support_vessel_photos_match_exact_classes():
    submarine=MODULE.curated_naval_support_vessels_query("nükleer denizaltı fotoğrafı",3)
    carrier=MODULE.curated_naval_support_vessels_query("uçak gemisi nasıl görünür",3)
    research=MODULE.curated_naval_support_vessels_query("oşinografi araştırma gemisini göster",3)
    osv=MODULE.curated_naval_support_vessels_query("açık deniz ikmal gemisi fotoğrafı",3)
    assert submarine[0]["visual_key"]=="curated:naval-support-vessels:virginia-class-submarine-underway"
    assert carrier[0]["visual_key"]=="curated:naval-support-vessels:aircraft-carrier-turning"
    assert research[0]["visual_key"]=="curated:naval-support-vessels:noaa-research-ship"
    assert osv[0]["visual_key"]=="curated:naval-support-vessels:offshore-supply-vessel-underway"
    assert MODULE.curated_naval_support_vessels_query("can simidi",3)==[]


def test_verified_shipyard_and_port_photos_match_exact_operations():
    dry=MODULE.curated_shipyard_port_query("kuru havuz takozlarını göster",3)
    floating=MODULE.curated_shipyard_port_query("yüzer havuz fotoğrafı",3)
    terminal=MODULE.curated_shipyard_port_query("konteyner terminali havadan görünüş",3)
    launch=MODULE.curated_shipyard_port_query("gemi denize indirme kızağı",3)
    assert dry[0]["visual_key"]=="curated:shipyard-port:ship-on-drydock-blocks"
    assert floating[0]["visual_key"]=="curated:shipyard-port:floating-drydock-resourceful"
    assert terminal[0]["visual_key"]=="curated:shipyard-port:container-terminal-aerial"
    assert launch[0]["visual_key"]=="curated:shipyard-port:ship-slipway-launch"
    assert MODULE.curated_shipyard_port_query("can salı",3)==[]


def test_verified_survival_craft_and_personal_gear_match_exact_equipment():
    lifeboat=MODULE.curated_survival_craft_gear_query("tam kapalı filika fotoğrafı",3)
    lifejacket=MODULE.curated_survival_craft_gear_query("can yeleği kontrolünü göster",3)
    immersion=MODULE.curated_survival_craft_gear_query("immersion suit nasıl görünür",3)
    rescue=MODULE.curated_survival_craft_gear_query("gemi kurtarma botu fotoğrafı",3)
    assert lifeboat[0]["visual_key"]=="curated:survival-craft-gear:fully-enclosed-lifeboat"
    assert lifejacket[0]["visual_key"]=="curated:survival-craft-gear:life-jacket-inspection"
    assert immersion[0]["visual_key"]=="curated:survival-craft-gear:immersion-suit-training"
    assert rescue[0]["visual_key"]=="curated:survival-craft-gear:shipboard-rescue-boat"
    assert MODULE.curated_survival_craft_gear_query("konteyner terminali",3)==[]


def test_verified_maritime_knot_photos_match_exact_knots():
    bowline=MODULE.curated_maritime_knots_query("izbarço bağı nasıl görünür",3)
    clove=MODULE.curated_maritime_knots_query("kazık bağı fotoğrafını göster",3)
    assert bowline[0]["visual_key"]=="curated:maritime-knots:bowline-knot"
    assert clove[0]["visual_key"]=="curated:maritime-knots:clove-hitch"
    assert MODULE.curated_maritime_knots_query("konteyner twistlock",3)==[]


def test_verified_advanced_maritime_ropework_matches_exact_knots_and_splice():
    reef=MODULE.curated_maritime_knots_advanced_query("camadan bağı fotoğrafı",3)
    sheet=MODULE.curated_maritime_knots_advanced_query("farklı çaplı halatları sheet bend ile bağlama",3)
    splice=MODULE.curated_maritime_knots_advanced_query("halat gözü dikişi nasıl görünür",3)
    assert reef[0]["visual_key"]=="curated:maritime-knots-advanced:reef-knot"
    assert sheet[0]["visual_key"]=="curated:maritime-knots-advanced:sheet-bend"
    assert splice[0]["visual_key"]=="curated:maritime-knots-advanced:eye-splice"
    assert MODULE.curated_maritime_knots_advanced_query("can yeleği",3)==[]


def test_verified_shipboard_ppe_photos_match_exact_protection():
    hardhat=MODULE.curated_shipboard_ppe_query("gemi baret çene bağını göster",3)
    harness=MODULE.curated_shipboard_ppe_query("yüksekte çalışma emniyet kemeri fotoğrafı",3)
    assert hardhat[0]["visual_key"]=="curated:shipboard-ppe:hard-hat-chin-strap"
    assert harness[0]["visual_key"]=="curated:shipboard-ppe:safety-harness-connection"
    assert MODULE.curated_shipboard_ppe_query("can salı",3)==[]


def test_verified_shipboard_industrial_ppe_matches_exact_protection():
    welding=MODULE.curated_shipboard_industrial_ppe_query("gemide kaynakçı maskesi ve kaynak PPE fotoğrafı",3)
    respirator=MODULE.curated_shipboard_industrial_ppe_query("gemi respiratör fit testi fotoğrafı",3)
    assert welding[0]["visual_key"]=="curated:shipboard-industrial-ppe:welding-face-protection"
    assert respirator[0]["visual_key"]=="curated:shipboard-industrial-ppe:respirator-fit-test"
    assert all(item[0]["sourcePaths"][0].startswith("https://") for item in (welding,respirator))
    assert MODULE.curated_shipboard_industrial_ppe_query("can salı",3)==[]


def test_kaiyodai_navigation_schematics_match_exact_concepts():
    fusion=MODULE.curated_kaiyodai_navigation_schematics_query("IMU DVL entegrasyonu şeması",3)
    slip=MODULE.curated_kaiyodai_navigation_schematics_query("baş yönü iz yönü ve sürüklenme açısı",3)
    ekf=MODULE.curated_kaiyodai_navigation_schematics_query("INS DVL EKF tamamlayıcı filtre",3)
    assert fusion[0]["visual_key"]=="curated:kaiyodai-navigation:imu-dvl-integration"
    assert slip[0]["visual_key"]=="curated:kaiyodai-navigation:heading-track-slip-angle"
    assert ekf[0]["visual_key"]=="curated:kaiyodai-navigation:ins-dvl-ekf-integration"
    assert all("TUMSAT-OACIS" in item[0]["context"] for item in (fusion,slip,ekf))
    assert MODULE.curated_kaiyodai_navigation_schematics_query("can salı",3)==[]


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
    test_verified_pilotage_access_photos_match_exact_operations()
    test_verified_distress_signal_photos_match_exact_equipment()
    test_verified_oil_spill_response_photos_match_exact_systems()
    test_verified_hull_underwater_photos_match_exact_components()
    test_verified_vessel_type_photos_match_exact_ship_classes()
    test_verified_specialized_vessel_photos_match_exact_ship_classes()
    test_verified_passenger_and_work_vessel_photos_match_exact_classes()
    test_verified_naval_and_support_vessel_photos_match_exact_classes()
    test_verified_shipyard_and_port_photos_match_exact_operations()
    test_verified_survival_craft_and_personal_gear_match_exact_equipment()
    test_verified_maritime_knot_photos_match_exact_knots()
    test_verified_advanced_maritime_ropework_matches_exact_knots_and_splice()
    test_verified_shipboard_ppe_photos_match_exact_protection()
    test_verified_shipboard_industrial_ppe_matches_exact_protection()
    test_kaiyodai_navigation_schematics_match_exact_concepts()
    print("35 curated visual query tests passed")
