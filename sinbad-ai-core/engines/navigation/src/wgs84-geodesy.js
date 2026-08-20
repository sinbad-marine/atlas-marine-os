"use strict";

const geographiclib = require("geographiclib-geodesic");

const WGS84 = geographiclib.Geodesic.WGS84;
const METERS_PER_NAUTICAL_MILE = 1852;
const SOURCE_VERSION = require("geographiclib-geodesic/package.json").version;

function finiteNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${name} must be a finite number`);
  return number;
}

function latitude(value, name) {
  const number = finiteNumber(value, name);
  if (number < -90 || number > 90) throw new RangeError(`${name} must be between -90 and 90 degrees`);
  return number;
}

function longitude(value, name) {
  const number = finiteNumber(value, name);
  if (number < -180 || number > 180) throw new RangeError(`${name} must be between -180 and 180 degrees`);
  return number;
}

function normalize360(value) {
  return ((value % 360) + 360) % 360;
}

function metadata() {
  return {
    method: "ellipsoidal-geodesic",
    earthModel: "WGS84",
    units: { distance: "nautical-mile", angles: "degree" },
    implementation: "geographiclib-geodesic",
    sourceVersion: SOURCE_VERSION,
    validationStatus: "cross-implementation-baseline",
    warnings: ["Not approved as a sole source for vessel navigation decisions"]
  };
}

function inverse(lat1, lon1, lat2, lon2) {
  const result = WGS84.Inverse(
    latitude(lat1, "lat1"),
    longitude(lon1, "lon1"),
    latitude(lat2, "lat2"),
    longitude(lon2, "lon2")
  );

  return {
    distanceNm: result.s12 / METERS_PER_NAUTICAL_MILE,
    initialCourse: normalize360(result.azi1),
    finalCourse: normalize360(result.azi2),
    arcDegrees: result.a12,
    metadata: metadata()
  };
}

function direct(lat, lon, initialCourse, distanceNm) {
  const distance = finiteNumber(distanceNm, "distanceNm");
  if (distance < 0) throw new RangeError("distanceNm must not be negative");

  const result = WGS84.Direct(
    latitude(lat, "lat"),
    longitude(lon, "lon"),
    finiteNumber(initialCourse, "initialCourse"),
    distance * METERS_PER_NAUTICAL_MILE
  );

  return {
    lat: result.lat2,
    lon: result.lon2,
    finalCourse: normalize360(result.azi2),
    arcDegrees: result.a12,
    metadata: metadata()
  };
}

module.exports = {
  METERS_PER_NAUTICAL_MILE,
  inverse,
  direct,
  metadata
};
