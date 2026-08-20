"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const navigation = require("..");

test("converts metres and kilometres to nautical miles", () => {
  assert.equal(navigation.quantities.distance({ value: 1852, unit: "m" }).value, 1);
  assert.equal(navigation.quantities.distance({ value: 1.852, unit: "km" }).value, 1);
});

test("converts SI and metric speed to knots", () => {
  assert.equal(navigation.quantities.speed({ value: 1.852, unit: "km/h" }).value, 1);
  assert.equal(navigation.quantities.speed({ value: 1852 / 3600, unit: "m/s" }).value, 1);
});

test("converts durations and angles to canonical units", () => {
  assert.equal(navigation.quantities.duration({ value: 90, unit: "min" }).value, 1.5);
  assert.ok(Math.abs(navigation.quantities.angle({ value: Math.PI, unit: "rad" }).value - 180) < 1e-12);
});

test("rejects bare numbers and unknown units", () => {
  assert.throws(() => navigation.quantities.distance(12), /object with value and unit/);
  assert.throws(() => navigation.quantities.distance({ value: 12, unit: "mile" }), /unit must be one of/);
});

test("rejects negative operational distance speed and duration", () => {
  assert.throws(() => navigation.quantities.distance({ value: -1, unit: "NM" }), /negative/);
  assert.throws(() => navigation.quantities.speed({ value: -1, unit: "kn" }), /negative/);
  assert.throws(() => navigation.quantities.duration({ value: -1, unit: "h" }), /negative/);
});

test("converts canonical quantities back to an explicit requested unit", () => {
  const result = navigation.quantities.convert({ value: 1, unit: "NM" }, "distance", "m", { nonNegative: true });
  assert.deepEqual(result, { kind: "distance", value: 1852, unit: "m" });
});

test("calculates distance run without implicit units", () => {
  const result = navigation.calculateDistanceRun(
    { value: 18.52, unit: "km/h" },
    { value: 30, unit: "min" }
  );
  assert.ok(Math.abs(result.distance.value - 5) < 1e-12);
  assert.equal(result.distance.unit, "NM");
  assert.equal(result.inputs.speed.unit, "kn");
  assert.equal(result.inputs.duration.unit, "h");
});
