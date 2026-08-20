"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const navigation = require("..");

function samplePlan(earthModel = navigation.EARTH_MODELS.WGS84) {
  return {
    id: "route-001",
    name: "Verified coordinate example",
    earthModel,
    waypoints: [
      { id: "WP01", name: "Start", lat: 41, lon: 29 },
      { id: "WP02", name: "Middle", lat: 40.5, lon: 20 },
      { id: "WP03", name: "Finish", lat: 42, lon: 10 }
    ]
  };
}

test("validates and calculates every route leg with WGS84", () => {
  const result = navigation.calculateRoutePlan(samplePlan());
  assert.equal(result.legs.length, 2);
  assert.ok(result.totalDistanceNm > 0);
  assert.equal(result.metadata.earthModel, "WGS84");
  assert.equal(result.metadata.coordinateReferenceSystem, "EPSG:4326 / WGS 84");
  assert.ok(result.legs.every((leg) => leg.metadata.earthModel === "WGS84"));
});

test("route totals equal the sum of independently calculated legs", () => {
  const plan = samplePlan();
  const result = navigation.calculateRoutePlan(plan);
  const expected = navigation.inverseRoute({
    earthModel: plan.earthModel,
    lat1: 41,
    lon1: 29,
    lat2: 40.5,
    lon2: 20
  }).distanceNm + navigation.inverseRoute({
    earthModel: plan.earthModel,
    lat1: 40.5,
    lon1: 20,
    lat2: 42,
    lon2: 10
  }).distanceNm;
  assert.ok(Math.abs(result.totalDistanceNm - expected) < 1e-12);
});

test("rejects a route without an explicit earth model", () => {
  const plan = samplePlan();
  delete plan.earthModel;
  assert.throws(() => navigation.calculateRoutePlan(plan), /earthModel/);
});

test("rejects text-only stops because they are not navigable coordinates", () => {
  const plan = samplePlan();
  plan.waypoints = ["Marmaris", "Dubrovnik"];
  assert.throws(() => navigation.calculateRoutePlan(plan), /must be an object/);
});

test("rejects duplicate waypoint identifiers", () => {
  const plan = samplePlan();
  plan.waypoints[1].id = "WP01";
  assert.throws(() => navigation.calculateRoutePlan(plan), /duplicate waypoint id/);
});

test("rejects invalid or insufficient coordinates", () => {
  const plan = samplePlan();
  plan.waypoints[1].lat = 91;
  assert.throws(() => navigation.calculateRoutePlan(plan), /out of range/);
  plan.waypoints = [plan.waypoints[0]];
  assert.throws(() => navigation.calculateRoutePlan(plan), /at least two/);
});

test("preserves an explicit spherical model and labels its limitations", () => {
  const result = navigation.calculateRoutePlan(samplePlan(navigation.EARTH_MODELS.SPHERE));
  assert.equal(result.metadata.earthModel, "SPHERE");
  assert.equal(result.metadata.coordinateReferenceSystem, "Unspecified navigation sphere");
  assert.ok(result.legs.every((leg) => leg.metadata.warnings.some((warning) => /Spherical/.test(warning))));
});
