"use strict";

require("./sinbad-navigation.js");
const wgs84 = require("./wgs84-geodesy.js");
const routePlan = require("./route-plan.js");
const routeRevisions = require("./route-revision.js");
const calculationVerification = require("./calculation-verification.js");
const routeRelease = require("./route-release.js");
const inputProvenance = require("./input-provenance.js");
const positionConsensus = require("./position-consensus.js");
const quantities = require("./quantities.js");

const legacy = globalThis.SinbadNavigation;
const EARTH_MODELS = Object.freeze({
  SPHERE: "SPHERE",
  WGS84: "WGS84"
});

function requireRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new TypeError("request must be an object");
  }
  if (!Object.values(EARTH_MODELS).includes(request.earthModel)) {
    throw new RangeError("earthModel must be explicitly set to SPHERE or WGS84");
  }
  return request;
}

function sphericalMetadata() {
  return {
    method: "spherical-great-circle",
    earthModel: "SPHERE",
    radiusNm: 3440.065,
    units: { distance: "nautical-mile", angles: "degree" },
    sourceVersion: "legacy-audit-snapshot-2026-08-11",
    validationStatus: "unit-tested-approximation",
    warnings: [
      "Spherical approximation; not equivalent to a WGS84 ellipsoidal geodesic",
      "Not approved as a sole source for vessel navigation decisions"
    ]
  };
}

function inverseRoute(request) {
  const input = requireRequest(request);
  if (input.earthModel === EARTH_MODELS.WGS84) {
    return wgs84.inverse(input.lat1, input.lon1, input.lat2, input.lon2);
  }
  const result = legacy.greatCircleInverse(input.lat1, input.lon1, input.lat2, input.lon2);
  return { ...result, metadata: sphericalMetadata() };
}

function directRoute(request) {
  const input = requireRequest(request);
  if (input.earthModel === EARTH_MODELS.WGS84) {
    return wgs84.direct(input.lat, input.lon, input.initialCourse, input.distanceNm);
  }
  const result = legacy.greatCircleDestination(
    input.lat,
    input.lon,
    input.initialCourse,
    input.distanceNm
  );
  return { ...result, metadata: sphericalMetadata() };
}

function compareEarthModels(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new TypeError("request must be an object");
  }
  const spherical = inverseRoute({ ...request, earthModel: EARTH_MODELS.SPHERE });
  const ellipsoidal = inverseRoute({ ...request, earthModel: EARTH_MODELS.WGS84 });
  return {
    spherical,
    ellipsoidal,
    difference: {
      distanceNm: spherical.distanceNm - ellipsoidal.distanceNm,
      distancePercent: ellipsoidal.distanceNm === 0
        ? 0
        : (spherical.distanceNm - ellipsoidal.distanceNm) / ellipsoidal.distanceNm * 100,
      initialCourseDegrees: spherical.initialCourse - ellipsoidal.initialCourse
    }
  };
}

function calculateRoutePlan(plan) {
  return routePlan.calculateRoutePlan(plan, inverseRoute);
}

function verifyDirectInverseClosure(request, tolerances) {
  return calculationVerification.verifyDirectInverseClosure(request, directRoute, inverseRoute, tolerances);
}

function assessRouteRelease(options) {
  return routeRelease.assessRouteRelease(options, { calculateRoutePlan, verifyRevisionChain: routeRevisions.verifyRevisionChain });
}

function assessPositionConsensus(observations, options) {
  return positionConsensus.assessPositionConsensus(observations, options, {
    assessInputProvenance: inputProvenance.assessInputProvenance,
    inverseRoute,
    earthModel: EARTH_MODELS.WGS84
  });
}

module.exports = {
  EARTH_MODELS,
  inverseRoute,
  directRoute,
  compareEarthModels,
  validateRoutePlan: routePlan.validateRoutePlan,
  calculateRoutePlan,
  createRouteRevision: routeRevisions.createRouteRevision,
  verifyRouteRevision: routeRevisions.verifyRouteRevision,
  verifyRevisionChain: routeRevisions.verifyRevisionChain,
  routeRevisions,
  verifyInverseAgainstReference: calculationVerification.verifyInverseAgainstReference,
  verifyDirectInverseClosure,
  calculationVerification,
  assessRouteRelease,
  SOURCE_TYPES: inputProvenance.SOURCE_TYPES,
  assessInputProvenance: inputProvenance.assessInputProvenance,
  assessInputSet: inputProvenance.assessInputSet,
  assessPositionConsensus,
  quantities,
  calculateDistanceRun: quantities.calculateDistanceRun,
  spherical: legacy,
  wgs84
};
