"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const wgs84 = require("../src/wgs84-geodesy.js");

test("matches the published GeographicLib Wellington-Salamanca inverse example", () => {
  const result = wgs84.inverse(-41.32, 174.81, 40.96, -5.50);
  assert.ok(Math.abs(result.distanceNm * 1852 - 19959679.267) < 0.001);
  assert.equal(result.metadata.earthModel, "WGS84");
  assert.equal(result.metadata.method, "ellipsoidal-geodesic");
});

test("matches the published GeographicLib Perth direct example", () => {
  const result = wgs84.direct(-32.06, 115.74, 225, 20000e3 / 1852);
  assert.ok(Math.abs(result.lat - 32.11195529) < 1e-8);
  assert.ok(Math.abs(result.lon - -63.95925278) < 1e-8);
});

test("direct and inverse round-trip across the antimeridian", () => {
  const inverse = wgs84.inverse(35, 179.8, 35.2, -179.7);
  const destination = wgs84.direct(35, 179.8, inverse.initialCourse, inverse.distanceNm);
  assert.ok(Math.abs(destination.lat - 35.2) < 1e-10);
  assert.ok(Math.abs(destination.lon - -179.7) < 1e-10);
});

test("handles a nearly antipodal inverse without NaN", () => {
  const result = wgs84.inverse(0.1, 0, -0.1, 179.999);
  assert.ok(Number.isFinite(result.distanceNm));
  assert.ok(Number.isFinite(result.initialCourse));
  assert.ok(result.distanceNm > 10000);
});

test("rejects invalid coordinates and negative distances", () => {
  assert.throws(() => wgs84.inverse(91, 0, 0, 0), RangeError);
  assert.throws(() => wgs84.inverse(0, 181, 0, 0), RangeError);
  assert.throws(() => wgs84.direct(0, 0, 90, -1), RangeError);
  assert.throws(() => wgs84.direct("unknown", 0, 90, 1), TypeError);
});

test("returns zero distance for coincident points", () => {
  const result = wgs84.inverse(41, 29, 41, 29);
  assert.equal(result.distanceNm, 0);
});
