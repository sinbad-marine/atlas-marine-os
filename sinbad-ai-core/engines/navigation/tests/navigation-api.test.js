"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const navigation = require("../src/index.js");

test("requires an explicit earth model", () => {
  assert.throws(
    () => navigation.inverseRoute({ lat1: 0, lon1: 0, lat2: 0, lon2: 1 }),
    /earthModel must be explicitly set/
  );
});

test("routes WGS84 inverse calculations through the ellipsoidal engine", () => {
  const result = navigation.inverseRoute({
    earthModel: navigation.EARTH_MODELS.WGS84,
    lat1: -41.32,
    lon1: 174.81,
    lat2: 40.96,
    lon2: -5.50
  });
  assert.equal(result.metadata.earthModel, "WGS84");
  assert.ok(Math.abs(result.distanceNm * 1852 - 19959679.267) < 0.001);
});

test("keeps spherical calculations explicitly labelled as approximations", () => {
  const result = navigation.inverseRoute({
    earthModel: navigation.EARTH_MODELS.SPHERE,
    lat1: 0,
    lon1: 0,
    lat2: 0,
    lon2: 90
  });
  assert.equal(result.metadata.earthModel, "SPHERE");
  assert.equal(result.metadata.validationStatus, "unit-tested-approximation");
  assert.match(result.metadata.warnings.join(" "), /not equivalent to a WGS84/i);
});

test("compares spherical and ellipsoidal results without hiding the difference", () => {
  const result = navigation.compareEarthModels({ lat1: 60, lon1: 0, lat2: 60, lon2: 90 });
  assert.equal(result.spherical.metadata.earthModel, "SPHERE");
  assert.equal(result.ellipsoidal.metadata.earthModel, "WGS84");
  assert.ok(Math.abs(result.difference.distanceNm) > 1);
  assert.ok(Number.isFinite(result.difference.distancePercent));
});

test("direct route preserves the selected earth model", () => {
  const result = navigation.directRoute({
    earthModel: navigation.EARTH_MODELS.WGS84,
    lat: 41,
    lon: 29,
    initialCourse: 270,
    distanceNm: 100
  });
  assert.equal(result.metadata.earthModel, "WGS84");
  assert.ok(Number.isFinite(result.lat));
  assert.ok(Number.isFinite(result.lon));
});
