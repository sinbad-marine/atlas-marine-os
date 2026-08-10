const test = require("node:test");
const assert = require("node:assert/strict");

require("../sinbad-navigation.js");
const nav = globalThis.SinbadNavigation;

test("parses Turkish coordinates", () => {
  assert.equal(nav.parseCoordinate("43 derece 15 dakika Kuzey", "lat"), 43.25);
  assert.equal(nav.parseCoordinate("010 derece bat\u0131", "lon"), -10);
});

test("computes distance run", () => {
  assert.equal(nav.distanceRun(15, 2.75), 41.25);
});

test("computes rhumb-line destination", () => {
  const result = nav.rhumbDestination(43.25, -10, 125, 41.25);
  assert.ok(Math.abs(result.lat - 42.8557) < 0.001);
  assert.ok(Math.abs(result.lon - -9.2295) < 0.001);
});

test("asks for clarification when west is used as a course", () => {
  const response = nav.answer(
    "43 derece 15 dakika kuzey 010 derece bat\u0131 boylam\u0131ndan 15 knot h\u0131zla 2 saat 45 dakika 125 derece bat\u0131 y\u00F6n\u00FCnde DR mevkii",
    "tr"
  );
  assert.match(response, /Rota belirsiz/);
});

test("answers an explicit Turkish DR calculation", () => {
  const response = nav.answer(
    "43 derece 15 dakika kuzey 010 derece bat\u0131 boylam\u0131ndan rota 125 derece, 15 knot h\u0131zla 2 saat 45 dakika sonra DR pozisyonu",
    "T\u00FCrk\u00E7e"
  );
  assert.match(response, /41\.25/);
  assert.match(response, /42\u00B0/);
  assert.match(response, /009\u00B0/);
});

test("computes current set and drift", () => {
  const result = nav.currentResult(0, 10, 90, 5);
  assert.ok(Math.abs(result.set - 26.565) < 0.01);
  assert.ok(Math.abs(result.drift - 11.18) < 0.01);
});

test("computes course to steer", () => {
  const result = nav.courseToSteer(90, 10, 180, 2);
  assert.ok(Math.abs(result.course - 78.690) < 0.01);
  assert.ok(Math.abs(result.speed - 10.198) < 0.01);
});

test("answers a Turkish current set and drift question", () => {
  const response = nav.answer(
    "Suya göre rota 000 derece, suya göre hız 10 knot, akıntı seti 090 derece ve akıntı hızı 5 knot. Yere göre sonucu hesapla",
    "tr"
  );
  assert.match(response, /26\.6°T/);
  assert.match(response, /11\.18 knot/);
});

test("answers a Turkish course-to-steer question", () => {
  const response = nav.answer(
    "İstenen rota 090 derece, istenen hız 10 knot, akıntı seti 180 derece ve drift 2 knot. Tutulacak rota nedir?",
    "tr"
  );
  assert.match(response, /78\.7°T/);
  assert.match(response, /10\.20 knot/);
});

test("asks for missing current inputs", () => {
  const response = nav.answer("Akıntı seti 090 derece, tutulacak rota nedir?", "tr");
  assert.match(response, /eksik bilgiler/i);
  assert.match(response, /akıntı hızı/);
});

test("computes great-circle inverse", () => {
  const result = nav.greatCircleInverse(0, 0, 0, 90);
  assert.ok(Math.abs(result.distanceNm - 5403.64) < 0.1);
  assert.ok(Math.abs(result.initialCourse - 90) < 0.001);
});

test("computes great-circle destination and midpoint", () => {
  const destination = nav.greatCircleDestination(0, 0, 90, 5403.64);
  assert.ok(Math.abs(destination.lat) < 0.001);
  assert.ok(Math.abs(destination.lon - 90) < 0.001);
  const midpoint = nav.intermediateGreatCirclePoint(0, 0, 0, 90, 0.5);
  assert.ok(Math.abs(midpoint.lon - 45) < 0.001);
});

test("computes rhumb-line inverse", () => {
  const inverse = nav.rhumbInverse(43.25, -10, 42.8557, -9.2295);
  assert.ok(Math.abs(inverse.distanceNm - 41.25) < 0.05);
  assert.ok(Math.abs(inverse.course - 125) < 0.05);
});

test("solves speed distance and time", () => {
  assert.deepEqual(nav.speedDistanceTime({ speedKnots: 12, hours: 5 }), { distanceNm: 60, speedKnots: 12, hours: 5 });
  assert.equal(nav.speedDistanceTime({ distanceNm: 120, speedKnots: 10 }).hours, 12);
  assert.equal(nav.speedDistanceTime({ distanceNm: 120, hours: 8 }).speedKnots, 15);
});

test("converts compass and true courses using signed east-positive corrections", () => {
  assert.equal(nav.compassToTrue(100, 2, -5), 97);
  assert.equal(nav.trueToCompass(97, 2, -5), 100);
});

test("computes CPA and TCPA for crossing traffic", () => {
  const result = nav.cpaTcpa(
    { lat: 0, lon: 0, course: 90, speed: 10 },
    { lat: 10 / 60, lon: 10 / 60, course: 180, speed: 10 }
  );
  assert.ok(Math.abs(result.tcpaHours - 1) < 0.001);
  assert.ok(result.cpaNm < 0.01);
  assert.equal(result.past, false);
});

test("computes cross-track error and passage fuel reserve", () => {
  const track = nav.crossTrackError(0, 0, 0, 10, 1, 5);
  assert.ok(Math.abs(Math.abs(track.crossTrackNm) - 60.04) < 0.1);
  const fuel = nav.passageFuel(100, 10, 20, 15);
  assert.equal(fuel.hours, 10);
  assert.equal(fuel.baseFuel, 200);
  assert.ok(Math.abs(fuel.totalFuel - 230) < 1e-9);
});

test("answers Turkish speed distance and time questions", () => {
  assert.match(nav.answer("12 knot hızla 5 saatte kaç deniz mili giderim?", "tr"), /60\.00 deniz mili/);
  assert.match(nav.answer("120 deniz mili mesafeyi 10 knot ile kaç saatte giderim?", "tr"), /12\.00 saat/);
  assert.match(nav.answer("120 deniz milini 8 saatte tamamlamak için gerekli hız kaç knot?", "tr"), /15\.00 knot/);
});

test("estimates tidal height with the rule of twelfths", () => {
  assert.equal(nav.ruleOfTwelfths(1, 7, 3, 6).height, 4);
  assert.equal(nav.ruleOfTwelfths(1, 7, 6, 6).height, 7);
});

test("computes under-keel clearance", () => {
  assert.deepEqual(nav.underKeelClearance(4, 1.5, 4.2, 0.3, 0.5), {
    availableDepth: 5.5, requiredDepth: 5, clearance: 0.5, safe: true
  });
});

test("applies basic sextant index dip and refraction corrections", () => {
  const result = nav.correctedSextantAltitude(45, 2, 9);
  assert.ok(result.correctedAltitude < 45);
  assert.equal(result.indexCorrectionMinutes, -2);
  assert.ok(Math.abs(result.dipMinutes + 5.28) < 0.001);
});

test("returns meridian latitude candidates and converts time to longitude", () => {
  const latitude = nav.meridianLatitudeCandidates(70, 10);
  assert.deepEqual(latitude.candidates, [30, -10]);
  assert.equal(nav.timeDifferenceToLongitude(3600, "west"), -15);
});

test("solves radar relative motion from two observations", () => {
  const result = nav.radarRelativeMotion(10, 0, 5, 0, 30);
  assert.ok(Math.abs(result.relativeCourse - 180) < 0.001);
  assert.ok(Math.abs(result.relativeSpeed - 10) < 0.001);
  assert.ok(Math.abs(result.tcpaHours - 0.5) < 0.001);
  assert.ok(result.cpaNm < 0.001);
});

test("evaluates a radar trial maneuver", () => {
  const result = nav.trialManeuver(
    { lat: 0, lon: 0, course: 90, speed: 10 },
    { lat: 10 / 60, lon: 10 / 60, course: 180, speed: 10 },
    0,
    10
  );
  assert.ok(result.cpaNm > 5);
});

test("solves plane and middle-latitude sailing", () => {
  const plane = nav.planeSailing(30, 40);
  assert.equal(plane.distanceNm, 50);
  assert.ok(Math.abs(plane.course - 53.1301) < 0.001);
  const middle = nav.middleLatitudeSailing(40, 20, 41, 21);
  assert.ok(middle.distanceNm > 74 && middle.distanceNm < 76);
});

test("resolves a multi-leg traverse", () => {
  const result = nav.traverse([{ course: 0, distanceNm: 10 }, { course: 90, distanceNm: 10 }]);
  assert.ok(Math.abs(result.distanceMadeGoodNm - Math.sqrt(200)) < 0.001);
  assert.ok(Math.abs(result.courseMadeGood - 45) < 0.001);
  assert.equal(result.runNm, 20);
});

test("applies leeway and computes turn geometry", () => {
  assert.equal(nav.applyLeeway(90, 5, "sancak"), 95);
  assert.equal(nav.applyLeeway(90, 5, "iskele"), 85);
  const turn = nav.turnGeometry(12, 3, 90);
  assert.ok(Math.abs(turn.turnMinutes - 30) < 0.001);
  assert.ok(turn.radiusNm > 3.8 && turn.radiusNm < 3.9);
});

test("estimates Barrass squat and ETA", () => {
  assert.equal(nav.barrassSquat(10, 0.8, false), 0.8);
  assert.equal(nav.barrassSquat(10, 0.8, true), 1.6);
  const eta = nav.etaFromDeparture("2026-08-10T00:00:00Z", 100, 10, 2);
  assert.equal(eta.passageHours, 12);
  assert.equal(eta.etaIso, "2026-08-10T12:00:00.000Z");
});

test("checks whether an ETA speed profile is feasible", () => {
  assert.deepEqual(nav.requiredSpeedProfile(120, 10, 5, 15), { requiredSpeed: 12, feasible: true, belowMinimum: false, aboveMaximum: false });
  assert.equal(nav.requiredSpeedProfile(120, 6, 5, 15).aboveMaximum, true);
});

test("ranks multiple collision risks", () => {
  const own = { lat: 0, lon: 0, course: 90, speed: 10 };
  const risks = nav.rankCollisionRisks(own, [
    { id: "crossing", lat: 10 / 60, lon: 10 / 60, course: 180, speed: 10 },
    { id: "distant", lat: 2, lon: 2, course: 0, speed: 5 }
  ], { cpaNm: 1, tcpaHours: 2 });
  assert.equal(risks[0].id, "crossing");
  assert.equal(risks[0].severity, "danger");
});

test("summarizes route legs fuel and duration", () => {
  const summary = nav.routeSummary([{ name: "A", lat: 0, lon: 0 }, { name: "B", lat: 0, lon: 1 }], 10, 20, 10);
  assert.ok(Math.abs(summary.totalDistanceNm - 60.04) < 0.1);
  assert.ok(Math.abs(summary.totalFuel - summary.hours * 22) < 1e-9);
});

test("builds a waypoint turn plan", () => {
  const plan = nav.waypointTurnPlan({ lat: -1, lon: 0 }, { lat: 0, lon: 0 }, { lat: 0, lon: 1 }, 12, 3);
  assert.equal(plan.turnDirection, "starboard");
  assert.ok(Math.abs(plan.courseChange - 90) < 0.01);
  assert.ok(plan.wheelOverDistanceNm > 3.8);
});

test("intersects two visual bearings and reports fix quality", () => {
  const fix = nav.bearingFix(
    { lat: 0, lon: -1 / 60, bearing: 270 },
    { lat: -1 / 60, lon: 0, bearing: 180 }
  );
  assert.ok(Math.abs(fix.lat) < 1e-9);
  assert.ok(Math.abs(fix.lon) < 1e-9);
  assert.ok(Math.abs(fix.crossingAngle - 90) < 1e-9);
  assert.equal(fix.reliable, true);
});

test("advances a line of position for a running fix", () => {
  const fix = nav.runningFix(
    { lat: 0, lon: 0 }, 270,
    { lat: -1 / 60, lon: 1 / 60 }, 180,
    90, 10, 0.1
  );
  assert.ok(Math.abs(fix.lat) < 1e-9);
  assert.ok(Math.abs(fix.lon - 1 / 60) < 1e-9);
  assert.equal(fix.runNm, 1);
});

test("computes an estimated position with current", () => {
  const ep = nav.estimatedPosition({ lat: 0, lon: 0 }, 90, 10, 1, 0, 2);
  assert.ok(Math.abs(ep.courseMadeGood - 78.6901) < 0.001);
  assert.ok(Math.abs(ep.speedMadeGood - Math.sqrt(104)) < 1e-9);
  assert.ok(ep.lat > 0 && ep.lon > 0);
});

test("builds a bounded DR position uncertainty circle", () => {
  const uncertainty = nav.positionUncertainty(0.5, 0.2, 2, 10, 3);
  assert.equal(uncertainty.runNm, 30);
  assert.ok(uncertainty.radiusNm > 1.2 && uncertainty.radiusNm < 1.4);
});

test("computes a celestial altitude intercept", () => {
  assert.deepEqual(nav.celestialIntercept(45.2, 45, 120), {
    interceptNm: 12.00000000000017,
    distanceNm: 12.00000000000017,
    direction: "toward",
    azimuth: 120
  });
  assert.equal(nav.celestialIntercept(30, 30.1, 270).direction, "away");
});

test("intersects two celestial lines of position", () => {
  const fix = nav.celestialFix({ lat: 40, lon: 20 }, [
    { observedAltitude: 30 + 1 / 60, computedAltitude: 30, azimuth: 90 },
    { observedAltitude: 45 + 2 / 60, computedAltitude: 45, azimuth: 0 }
  ]);
  assert.ok(Math.abs(fix.offsetEastNm - 1) < 1e-9);
  assert.ok(Math.abs(fix.offsetNorthNm - 2) < 1e-9);
  assert.equal(fix.reliable, true);
});

test("estimates distance from a vertical sextant angle", () => {
  const result = nav.distanceByVerticalAngle(100, 5, 10);
  assert.ok(result.distanceNm > 0.55 && result.distanceNm < 0.56);
  assert.throws(() => nav.distanceByVerticalAngle(10, 5, 10), /object height/);
});

test("interpolates compass deviation across north", () => {
  const table = [{ heading: 350, deviation: -2 }, { heading: 10, deviation: 2 }, { heading: 90, deviation: 4 }];
  assert.ok(Math.abs(nav.interpolateCompassDeviation(table, 0)) < 1e-9);
  assert.equal(nav.interpolateCompassDeviation(table, 50), 3);
});

test("computes the minimum tide needed for safe clearance", () => {
  assert.deepEqual(nav.minimumTideForClearance(4, 4.2, 0.3, 0.5), {
    requiredDepth: 5,
    minimumTideHeight: 1,
    driesAtChartDatum: true
  });
});

test("applies secondary-port time and height corrections", () => {
  const result = nav.secondaryPortTide(
    { timeIso: "2026-08-10T10:00:00Z", height: 4 },
    { timeMinutes: 35, heightRatio: 0.9, heightAddition: 0.2 }
  );
  assert.equal(result.timeIso, "2026-08-10T10:35:00.000Z");
  assert.ok(Math.abs(result.height - 3.8) < 1e-9);
});

test("interpolates tidal stream rate from springs to neaps", () => {
  assert.deepEqual(nav.interpolateSpringNeapRate(4, 2, 0), { rate: 4, fraction: 0, phase: "spring" });
  const middle = nav.interpolateSpringNeapRate(4, 2, 3.69);
  assert.ok(Math.abs(middle.rate - 3) < 1e-9);
  assert.equal(middle.phase, "intermediate");
});

test("derives tidal set and drift from DR and observed fixes", () => {
  const result = nav.setAndDriftFromFixes({ lat: 40, lon: 20 }, { lat: 40, lon: 20 + 2 / (60 * Math.cos(40 * Math.PI / 180)) }, 2);
  assert.ok(Math.abs(result.set - 90) < 0.01);
  assert.ok(Math.abs(result.drift - 1) < 0.001);
});

test("inverts the Barrass formula for a safe squat speed", () => {
  const speed = nav.maximumSpeedForSquat(0.8, 0.8, false);
  assert.ok(Math.abs(speed - 10) < 1e-9);
  assert.ok(nav.maximumSpeedForSquat(0.8, 0.8, true) < speed);
});

test("computes advance transfer and arc distance for a turn", () => {
  const turn = nav.turnAdvanceTransfer(1, 90);
  assert.ok(Math.abs(turn.advanceNm - 1) < 1e-9);
  assert.ok(Math.abs(turn.transferNm - 1) < 1e-9);
  assert.ok(Math.abs(turn.arcDistanceNm - Math.PI / 2) < 1e-9);
});

test("estimates reaction and braking distance", () => {
  const stop = nav.stoppingPerformance(10, 0.2, 30);
  assert.ok(stop.stoppingSeconds > 55 && stop.stoppingSeconds < 56);
  assert.ok(stop.stoppingDistanceMeters > 220 && stop.stoppingDistanceMeters < 221);
  assert.ok(Math.abs(stop.stoppingDistanceNm - stop.stoppingDistanceMeters / 1852) < 1e-12);
});

test("calculates anchor cable and swing radius", () => {
  const plan = nav.anchorScope(10, 2, 3, 5, 40);
  assert.equal(plan.verticalDistanceMeters, 15);
  assert.equal(plan.cableLengthMeters, 75);
  assert.ok(Math.abs(plan.cableLengthShackles - 75 / 27.5) < 1e-12);
  assert.equal(plan.swingRadiusMeters, 115);
});

test("builds geographic bounds for an anchor swing circle", () => {
  const bounds = nav.anchorSwingBounds({ lat: 40, lon: 20 }, 1852);
  assert.equal(bounds.radiusNm, 1);
  assert.ok(bounds.north > 40 && bounds.south < 40);
  assert.ok(bounds.east > 20 && bounds.west < 20);
});

test("tracks progress remaining distance and ETA on a route leg", () => {
  const progress = nav.routeLegProgress(
    { lat: 0, lon: 0 }, { lat: 0, lon: 2 }, { lat: 0, lon: 1 }, 10
  );
  assert.ok(progress.percentComplete > 49.9 && progress.percentComplete < 50.1);
  assert.ok(progress.remainingNm > 60 && progress.remainingNm < 60.1);
  assert.ok(progress.hoursRemaining > 6 && progress.hoursRemaining < 6.01);
});

test("detects route corridor exceedance and side", () => {
  const status = nav.routeCorridorStatus(
    { lat: 0, lon: 0 }, { lat: 0, lon: 2 }, { lat: 0.1, lon: 1 }, 2
  );
  assert.equal(status.withinCorridor, false);
  assert.ok(status.exceedanceNm > 4);
  assert.notEqual(status.side, "on-track");
});

test("converts relative and true bearings", () => {
  assert.equal(nav.relativeToTrueBearing(40, 350), 30);
  assert.deepEqual(nav.trueToRelativeBearing(30, 350), { clockwise: 40, signed: 40 });
  assert.deepEqual(nav.trueToRelativeBearing(330, 10), { clockwise: 320, signed: -40 });
});

test("raises a wheel-over trigger near a waypoint", () => {
  const status = nav.wheelOverStatus(
    { lat: 0, lon: -0.01 }, { lat: 0, lon: 0 }, { lat: 0.1, lon: 0 }, 12, 3, 0.1
  );
  assert.equal(status.turnDirection, "port");
  assert.equal(status.turnNow, true);
  assert.ok(status.triggerDistanceNm > status.distanceToWaypointNm);
});

test("projects a search datum from current and leeway", () => {
  const datum = nav.driftedDatum({ lat: 0, lon: 0 }, 2, 90, 1, 0, 1);
  assert.ok(Math.abs(datum.set - 45) < 1e-9);
  assert.ok(Math.abs(datum.drift - Math.sqrt(2)) < 1e-9);
  assert.ok(Math.abs(datum.distanceNm - 2 * Math.sqrt(2)) < 1e-9);
});

test("solves an intercept course to a moving target", () => {
  const intercept = nav.movingTargetIntercept(
    { lat: 0, lon: 0 }, 10,
    { lat: 0, lon: 10 / 60, course: 0, speed: 0 }
  );
  assert.equal(intercept.possible, true);
  assert.ok(Math.abs(intercept.interceptHours - 1) < 0.001);
  assert.ok(Math.abs(intercept.course - 90) < 0.001);
});

test("builds an expanding-square search pattern", () => {
  const pattern = nav.expandingSquarePattern({ lat: 0, lon: 0 }, 0, 1, 4);
  assert.equal(pattern.length, 5);
  assert.deepEqual(pattern.slice(1).map(point => point.distanceNm), [1, 1, 2, 2]);
  assert.deepEqual(pattern.slice(1).map(point => point.course), [0, 90, 180, 270]);
});

test("grows search datum uncertainty with drift time", () => {
  const uncertainty = nav.searchDatumUncertainty(0.5, 0.4, 3, 0.3);
  assert.equal(uncertainty.driftErrorNm, 1.2000000000000002);
  assert.ok(uncertainty.radiusNm > 1.33 && uncertainty.radiusNm < 1.34);
});

test("generates equally spaced great-circle waypoints", () => {
  const points = nav.greatCircleWaypoints({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }, 3);
  assert.equal(points.length, 4);
  assert.ok(Math.abs(points[1].lon - 30) < 0.001);
  assert.ok(Math.abs(points[2].fraction - 2 / 3) < 1e-12);
});

test("compares rhumb-line and great-circle ocean routes", () => {
  const comparison = nav.compareOceanRoutes({ lat: 40, lon: -70 }, { lat: 40, lon: 10 });
  assert.ok(comparison.rhumbDistanceNm > comparison.greatCircleDistanceNm);
  assert.ok(comparison.savingNm > 100);
  assert.ok(comparison.savingPercent > 0);
});

test("updates charted magnetic variation by annual change", () => {
  const result = nav.magneticVariationAtDate(2, 6, 2020, "2025-01-01T00:00:00Z");
  assert.ok(Math.abs(result.variation - 2.5) < 0.001);
  assert.ok(Math.abs(result.changeDegrees - 0.5) < 0.001);
});

test("computes combined geographic range of observer and light", () => {
  const range = nav.geographicRange(9, 25);
  assert.ok(Math.abs(range.observerHorizonNm - 6.24) < 1e-9);
  assert.ok(Math.abs(range.objectHorizonNm - 10.4) < 1e-9);
  assert.ok(Math.abs(range.geographicRangeNm - 16.64) < 1e-9);
});

test("converts true wind to apparent wind and back", () => {
  const apparent = nav.apparentWind(20, 0, 90, 10);
  assert.ok(Math.abs(apparent.speedKnots - Math.sqrt(500)) < 0.001);
  const restored = nav.trueWindFromApparent(apparent.speedKnots, apparent.from, 90, 10);
  assert.ok(Math.abs(restored.speedKnots - 20) < 0.001);
  assert.ok(Math.abs(restored.from) < 0.001 || Math.abs(restored.from - 360) < 0.001);
});

test("classifies wind speed on the Beaufort scale", () => {
  assert.equal(nav.beaufortForce(0), 0);
  assert.equal(nav.beaufortForce(15), 4);
  assert.equal(nav.beaufortForce(64), 12);
});

test("computes wave encounter period", () => {
  const stationary = nav.waveEncounterPeriod(10, 0, 0, 0);
  assert.ok(Math.abs(stationary.encounterPeriodSeconds - 10) < 1e-9);
  const intoSeas = nav.waveEncounterPeriod(10, 0, 0, 10);
  assert.ok(intoSeas.encounterPeriodSeconds < 10);
  const following = nav.waveEncounterPeriod(10, 180, 0, 10);
  assert.ok(following.encounterPeriodSeconds > 10);
});

test("answers a Turkish UKC question", () => {
  const response = nav.answer("UKC hesapla: harita derinliği 4 m, gelgit 1.5 m, su çekimi 4.2 m, squat 0.3 m, emniyet payı 0.5 m", "tr");
  assert.match(response, /0\.50 m/);
  assert.match(response, /uygun/);
});

test("answers a minimum tide question", () => {
  const response = nav.answer("Gerekli minimum gelgit nedir? harita derinliği 4 m, su çekimi 4.2 m, squat 0.3 m, emniyet payı 0.5 m", "tr");
  assert.match(response, /1\.00 m/);
});

test("answers a Turkish passage fuel question", () => {
  const response = nav.answer("100 deniz mili için 10 knot hız, saatlik tüketim 20 litre ve rezerv yüzde 10 yakıt hesapla", "tr");
  assert.match(response, /10\.00 saat/);
  assert.match(response, /220\.00 litre/);
});

test("answers a Turkish Beaufort question", () => {
  const response = nav.answer("15 knot rüzgar kaç bofor?", "tr");
  assert.match(response, /Beaufort 4/);
});

test("keeps unsafe or incomplete calculations bounded", () => {
  const response = nav.answer("DR pozisyonumu hesapla", "tr");
  assert.match(response, /eksik bilgiler/i);
});

test("answers a Turkish compass-to-true conversion", () => {
  const response = nav.answer("Pusula rotas\u0131 100 derece, deviasyon 2 derece, varyasyon -3 derece; hakiki rota nedir?", "tr");
  assert.match(response, /Hakiki rota: 99\.0/);
  assert.match(response, /do\u011frulay\u0131n/i);
});

test("answers a Turkish true-to-compass conversion", () => {
  const response = nav.answer("Hakiki rota 99 derece, deviasyon 2 derece, varyasyon -3 derece; pusula nedir?", "tr");
  assert.match(response, /Pusula rotas\u0131: 100\.0/);
});

test("answers an ETA question with delay", () => {
  const response = nav.answer("ETA hesapla: kalk\u0131\u015f 2026-08-10T10:00:00Z, mesafe 100 deniz mili, h\u0131z 10 knot, gecikme 2 saat", "tr");
  assert.match(response, /2026-08-10T22:00:00\.000Z/);
  assert.match(response, /12\.00 saat/);
});

test("answers a head-on CPA and TCPA question", () => {
  const response = nav.answer("CPA TCPA hesapla: kendi enlem 0 derece boylam 0 derece rota 90 derece h\u0131z 10 knot; hedef enlem 0 derece boylam 0.1666667 derece rota 270 derece h\u0131z 10 knot", "tr");
  assert.match(response, /CPA 0\.00/);
  assert.match(response, /TCPA 30\.0 dakika/);
  assert.match(response, /ARPA\/AIS/);
});

test("asks for missing CPA target inputs", () => {
  const response = nav.answer("CPA hesapla: kendi enlem 0 derece boylam 0 derece rota 90 derece h\u0131z 10 knot", "tr");
  assert.match(response, /kendi ve hedef geminin/i);
});

test("answers a confined-water squat question", () => {
  const response = nav.answer("Dar suda squat hesapla: h\u0131z 10 knot, blok katsay\u0131s\u0131 0.8", "tr");
  assert.match(response, /1\.60 m/);
  assert.match(response, /dar\/s\u0131\u011f su/);
});

test("answers a maximum safe speed for squat question", () => {
  const response = nav.answer("Maksimum h\u0131z squat hesab\u0131: izin verilen squat 0.8 m, blok katsay\u0131s\u0131 0.8", "tr");
  assert.match(response, /10\.00 knot/);
});

test("answers an anchoring scope and swing question", () => {
  const response = nav.answer("Demirleme kaloma hesapla: su derinli\u011fi 10 m, gelgit 2 m, ba\u015f y\u00fcksekli\u011fi 3 m, kaloma oran\u0131 5, gemi boyu 40 m", "tr");
  assert.match(response, /75\.0 m/);
  assert.match(response, /2\.73 kilit/);
  assert.match(response, /115\.0 m/);
});

test("answers a stopping distance question", () => {
  const response = nav.answer("Durma mesafesi hesapla: h\u0131z 10 knot, yava\u015flama 0.2 m\/s2, reaksiyon 30 saniye", "tr");
  assert.match(response, /220\.5 m/);
  assert.match(response, /55\.7 saniye/);
});

test("asks for missing anchoring inputs", () => {
  const response = nav.answer("Demirleme kaloma hesapla", "tr");
  assert.match(response, /su derinli\u011fi, kaloma oran\u0131/);
});

test("answers a wheel-over and turn geometry question", () => {
  const response = nav.answer("Wheel-over hesapla: h\u0131z 12 knot, d\u00f6n\u00fc\u015f oran\u0131 3 derece/dakika, rota de\u011fi\u015fimi 90 derece", "tr");
  assert.match(response, /3\.82 deniz mili/);
  assert.match(response, /30\.0 dakika/);
});

test("answers a lighthouse geographic-range question", () => {
  const response = nav.answer("Co\u011frafi menzil hesapla: g\u00f6z y\u00fcksekli\u011fi 9 m, fener y\u00fcksekli\u011fi 25 m", "tr");
  assert.match(response, /16\.64 deniz mili/);
  assert.match(response, /Meteorolojik g\u00f6r\u00fc\u015f/);
});

test("updates magnetic variation conversationally", () => {
  const response = nav.answer("Y\u0131ll\u0131k varyasyon g\u00fcncelle: harita varyasyonu 2 derece, y\u0131ll\u0131k de\u011fi\u015fim 6 dakika, harita y\u0131l\u0131 2020, hedef y\u0131l 2025", "tr");
  assert.match(response, /2\.50\u00b0/);
});

test("supports westward annual magnetic change", () => {
  const response = nav.answer("Y\u0131ll\u0131k varyasyon g\u00fcncelle: harita varyasyonu 2 derece, y\u0131ll\u0131k de\u011fi\u015fim -6 dakika, harita y\u0131l\u0131 2020, hedef y\u0131l 2025", "tr");
  assert.match(response, /1\.50\u00b0/);
});

test("asks for missing turn inputs", () => {
  const response = nav.answer("Wheel-over mesafesini hesapla", "tr");
  assert.match(response, /h\u0131z, d\u00f6n\u00fc\u015f oran\u0131, rota de\u011fi\u015fimi/);
});

test("answers a radar relative-motion question", () => {
  const response = nav.answer("Radar nispi hareket: ilk menzil 10 NM, ilk kerteriz 0 derece, ikinci menzil 5 NM, ikinci kerteriz 0 derece, aral\u0131k 30 dakika", "tr");
  assert.match(response, /Nispi rota 180\.0/);
  assert.match(response, /CPA 0\.00/);
  assert.match(response, /TCPA 30\.0 dakika/);
});

test("answers a rule-of-twelfths tide question", () => {
  const response = nav.answer("12'ler kural\u0131: al\u00e7ak su 1 m, y\u00fcksek su 7 m, al\u00e7ak sudan sonra 3 saat, gelgit s\u00fcresi 6 saat", "tr");
  assert.match(response, /4\.00 m/);
  assert.match(response, /yakla\u015f\u0131md\u0131r/);
});

test("answers a secondary-port tide correction question", () => {
  const response = nav.answer("Tali liman hesab\u0131: referans zaman\u0131 2026-08-10T10:00:00Z, referans y\u00fcksekli\u011fi 4 m, zaman d\u00fczeltmesi 35 dakika, y\u00fckseklik oran\u0131 0.9, y\u00fckseklik ilavesi 0.2 m", "tr");
  assert.match(response, /2026-08-10T10:35:00\.000Z/);
  assert.match(response, /3\.80 m/);
});

test("asks for missing radar observations", () => {
  const response = nav.answer("Radar nispi hareket hesapla", "tr");
  assert.match(response, /ilk menzil, ilk kerteriz, ikinci menzil, ikinci kerteriz, zaman aral\u0131\u011f\u0131/);
});

test("asks for missing rule-of-twelfths inputs", () => {
  const response = nav.answer("12'ler kural\u0131yla gelgit hesapla", "tr");
  assert.match(response, /al\u00e7ak su, y\u00fcksek su/);
});

test("answers a sextant altitude correction question", () => {
  const response = nav.answer("Sekstant irtifas\u0131 d\u00fczelt: sekstant irtifas\u0131 45 derece, indeks hatas\u0131 2 dakika, g\u00f6z y\u00fcksekli\u011fi 9 m", "tr");
  assert.match(response, /D\u00fczeltilmi\u015f irtifa 44\./);
  assert.match(response, /dip -5\.28'/);
  assert.match(response, /Almanak/);
});

test("answers a meridian latitude question", () => {
  const response = nav.answer("Meridyen enlemi hesapla: g\u00f6zlenen irtifa 70 derece, deklinasyon 10 derece", "tr");
  assert.match(response, /Zenit mesafesi 20\.00/);
  assert.match(response, /30\.00\u00b0 veya -10\.00\u00b0/);
});

test("answers a celestial intercept question", () => {
  const response = nav.answer("Intercept hesapla: g\u00f6zlenen irtifa 45.2 derece, hesaplanan irtifa 45 derece, azimut 120 derece", "tr");
  assert.match(response, /Intercept 12\.00 deniz mili/);
  assert.match(response, /azimuta do\u011fru/);
});

test("answers an away celestial intercept question", () => {
  const response = nav.answer("Intercept hesapla: g\u00f6zlenen irtifa 30 derece, hesaplanan irtifa 30.1 derece, azimut 270 derece", "tr");
  assert.match(response, /6\.00 deniz mili, azimuttan uza\u011fa/);
});

test("asks for missing celestial intercept inputs", () => {
  const response = nav.answer("Intercept ve azimut hesab\u0131 yap", "tr");
  assert.match(response, /g\u00f6zlenen irtifa, hesaplanan irtifa, azimut/);
});
