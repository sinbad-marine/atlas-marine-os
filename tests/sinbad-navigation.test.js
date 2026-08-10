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

test("keeps unsafe or incomplete calculations bounded", () => {
  const response = nav.answer("DR pozisyonumu hesapla", "tr");
  assert.match(response, /eksik bilgiler/i);
});
