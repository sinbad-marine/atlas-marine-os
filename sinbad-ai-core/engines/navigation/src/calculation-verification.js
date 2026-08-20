"use strict";

const DEFAULT_TOLERANCES = Object.freeze({
  distanceNm: 0.001,
  courseDegrees: 0.001,
  positionDegrees: 0.000001
});

function finiteNonNegative(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new RangeError(`${name} must be a finite non-negative number`);
  }
  return number;
}

function finite(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${name} must be a finite number`);
  return number;
}

function text(value, name) {
  const result = String(value || "").trim();
  if (!result) throw new TypeError(`${name} is required`);
  return result;
}

function angularDifference(left, right) {
  const difference = Math.abs(((finite(left, "left") - finite(right, "right") + 180) % 360 + 360) % 360 - 180);
  return difference;
}

function normalizeTolerances(tolerances = {}) {
  return {
    distanceNm: finiteNonNegative(tolerances.distanceNm ?? DEFAULT_TOLERANCES.distanceNm, "distance tolerance"),
    courseDegrees: finiteNonNegative(tolerances.courseDegrees ?? DEFAULT_TOLERANCES.courseDegrees, "course tolerance"),
    positionDegrees: finiteNonNegative(tolerances.positionDegrees ?? DEFAULT_TOLERANCES.positionDegrees, "position tolerance")
  };
}

function referenceIdentity(reference) {
  if (!reference || typeof reference !== "object" || Array.isArray(reference)) {
    throw new TypeError("reference must be an object");
  }
  return {
    provider: text(reference.provider, "reference.provider"),
    version: text(reference.version, "reference.version"),
    testCase: text(reference.testCase, "reference.testCase")
  };
}

function verifyInverseAgainstReference(calculated, reference, tolerances) {
  const source = referenceIdentity(reference);
  const limits = normalizeTolerances(tolerances);
  const differences = {
    distanceNm: Math.abs(finite(calculated.distanceNm, "calculated.distanceNm") - finite(reference.distanceNm, "reference.distanceNm")),
    initialCourseDegrees: angularDifference(calculated.initialCourse, reference.initialCourse),
    finalCourseDegrees: angularDifference(calculated.finalCourse, reference.finalCourse)
  };
  const checks = {
    distance: differences.distanceNm <= limits.distanceNm,
    initialCourse: differences.initialCourseDegrees <= limits.courseDegrees,
    finalCourse: differences.finalCourseDegrees <= limits.courseDegrees
  };
  const pass = Object.values(checks).every(Boolean);
  return {
    status: pass ? "PASS" : "HOLD",
    independentReference: true,
    reference: source,
    checks,
    differences,
    tolerances: limits,
    reasons: pass ? [] : Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => `${name} exceeds tolerance`)
  };
}

function verifyDirectInverseClosure(request, directRoute, inverseRoute, tolerances) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new TypeError("request must be an object");
  }
  if (typeof directRoute !== "function" || typeof inverseRoute !== "function") {
    throw new TypeError("route calculators must be functions");
  }
  const limits = normalizeTolerances(tolerances);
  const destination = directRoute(request);
  const inverse = inverseRoute({
    earthModel: request.earthModel,
    lat1: request.lat,
    lon1: request.lon,
    lat2: destination.lat,
    lon2: destination.lon
  });
  const differences = {
    distanceNm: Math.abs(inverse.distanceNm - finite(request.distanceNm, "request.distanceNm")),
    initialCourseDegrees: angularDifference(inverse.initialCourse, request.initialCourse)
  };
  const checks = {
    distance: differences.distanceNm <= limits.distanceNm,
    initialCourse: differences.initialCourseDegrees <= limits.courseDegrees
  };
  return {
    status: Object.values(checks).every(Boolean) ? "PASS" : "HOLD",
    independentReference: false,
    verificationType: "internal-direct-inverse-closure",
    checks,
    differences,
    tolerances: limits,
    warning: "Internal consistency check only; it is not independent validation"
  };
}

module.exports = {
  DEFAULT_TOLERANCES,
  angularDifference,
  verifyInverseAgainstReference,
  verifyDirectInverseClosure
};
