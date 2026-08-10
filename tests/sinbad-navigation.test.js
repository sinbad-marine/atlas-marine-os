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

test("computes great-circle inverse", () => {
  const result = nav.greatCircleInverse(0, 0, 0, 90);
  assert.ok(Math.abs(result.distanceNm - 5403.64) < 0.1);
  assert.ok(Math.abs(result.initialCourse - 90) < 0.001);
});

test("keeps unsafe or incomplete calculations bounded", () => {
  const response = nav.answer("DR pozisyonumu hesapla", "tr");
  assert.match(response, /eksik bilgiler/i);
});
