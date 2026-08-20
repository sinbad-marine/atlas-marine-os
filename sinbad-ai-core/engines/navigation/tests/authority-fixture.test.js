"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fixture = require("../validation/geographiclib-wellington-salamanca.json");
const navigation = require("..");

test("matches the stored GeographicLib authority fixture", () => {
  const calculated = navigation.inverseRoute({
    earthModel: navigation.EARTH_MODELS.WGS84,
    ...fixture.inputs
  });
  const reference = {
    provider: fixture.source_title,
    version: fixture.source_date_or_edition,
    testCase: fixture.case_id,
    distanceNm: fixture.expected.distanceMeters / 1852,
    initialCourse: fixture.expected.initialCourseDegrees,
    finalCourse: fixture.expected.finalCourseDegrees
  };
  const result = navigation.verifyInverseAgainstReference(calculated, reference, {
    distanceNm: fixture.tolerance.distanceMeters / 1852,
    courseDegrees: fixture.tolerance.courseDegrees
  });
  assert.equal(result.status, "PASS");
});
