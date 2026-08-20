"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const navigation = require("..");

const publishedReference = {
  provider: "GeographicLib published test data",
  version: "WGS84 example accessed for baseline",
  testCase: "Wellington to Salamanca",
  distanceNm: 19959679.267 / 1852,
  initialCourse: 161.06766998615882,
  finalCourse: 18.825195123248392
};

test("passes an externally identified inverse reference within tolerance", () => {
  const calculated = navigation.inverseRoute({
    earthModel: navigation.EARTH_MODELS.WGS84,
    lat1: -41.32,
    lon1: 174.81,
    lat2: 40.96,
    lon2: -5.50
  });
  const result = navigation.verifyInverseAgainstReference(calculated, publishedReference);
  assert.equal(result.status, "PASS");
  assert.equal(result.independentReference, true);
  assert.deepEqual(result.reasons, []);
});

test("holds a calculation when a reference difference exceeds tolerance", () => {
  const calculated = { distanceNm: 100, initialCourse: 10, finalCourse: 20 };
  const reference = { ...publishedReference, distanceNm: 101, initialCourse: 12, finalCourse: 20 };
  const result = navigation.verifyInverseAgainstReference(calculated, reference, {
    distanceNm: 0.1,
    courseDegrees: 0.1
  });
  assert.equal(result.status, "HOLD");
  assert.deepEqual(result.reasons, ["distance exceeds tolerance", "initialCourse exceeds tolerance"]);
});

test("requires traceable reference identity", () => {
  assert.throws(() => navigation.verifyInverseAgainstReference(
    { distanceNm: 1, initialCourse: 2, finalCourse: 3 },
    { distanceNm: 1, initialCourse: 2, finalCourse: 3 }
  ), /reference.provider/);
});

test("handles course wraparound at north", () => {
  assert.ok(Math.abs(navigation.calculationVerification.angularDifference(359.9, 0.1) - 0.2) < 1e-10);
});

test("labels direct-inverse closure as internal rather than independent", () => {
  const result = navigation.verifyDirectInverseClosure({
    earthModel: navigation.EARTH_MODELS.WGS84,
    lat: 41,
    lon: 29,
    initialCourse: 275,
    distanceNm: 500
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.independentReference, false);
  assert.match(result.warning, /not independent validation/);
});

test("rejects invalid tolerances", () => {
  assert.throws(() => navigation.verifyInverseAgainstReference(
    { distanceNm: 1, initialCourse: 2, finalCourse: 3 },
    { provider: "X", version: "1", testCase: "Y", distanceNm: 1, initialCourse: 2, finalCourse: 3 },
    { distanceNm: -1 }
  ), /non-negative/);
});
