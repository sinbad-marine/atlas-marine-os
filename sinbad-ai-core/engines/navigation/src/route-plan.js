"use strict";

const EARTH_MODELS = Object.freeze({ SPHERE: "SPHERE", WGS84: "WGS84" });

function finiteNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${name} must be a finite number`);
  return number;
}

function validateWaypoint(waypoint, index) {
  if (!waypoint || typeof waypoint !== "object" || Array.isArray(waypoint)) {
    throw new TypeError(`waypoints[${index}] must be an object`);
  }
  const id = String(waypoint.id || "").trim();
  const name = String(waypoint.name || "").trim();
  if (!id) throw new TypeError(`waypoints[${index}].id is required`);
  if (!name) throw new TypeError(`waypoints[${index}].name is required`);
  const lat = finiteNumber(waypoint.lat, `waypoints[${index}].lat`);
  const lon = finiteNumber(waypoint.lon, `waypoints[${index}].lon`);
  if (lat < -90 || lat > 90) throw new RangeError(`waypoints[${index}].lat is out of range`);
  if (lon < -180 || lon > 180) throw new RangeError(`waypoints[${index}].lon is out of range`);
  return { id, name, lat, lon };
}

function validateRoutePlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new TypeError("route plan must be an object");
  }
  const id = String(plan.id || "").trim();
  const name = String(plan.name || "").trim();
  if (!id) throw new TypeError("route plan id is required");
  if (!name) throw new TypeError("route plan name is required");
  if (!Object.values(EARTH_MODELS).includes(plan.earthModel)) {
    throw new RangeError("route plan earthModel must be explicitly set to SPHERE or WGS84");
  }
  if (!Array.isArray(plan.waypoints) || plan.waypoints.length < 2) {
    throw new RangeError("route plan must contain at least two coordinate waypoints");
  }

  const waypoints = plan.waypoints.map(validateWaypoint);
  const ids = new Set();
  for (const waypoint of waypoints) {
    if (ids.has(waypoint.id)) throw new RangeError(`duplicate waypoint id: ${waypoint.id}`);
    ids.add(waypoint.id);
  }
  return { id, name, earthModel: plan.earthModel, waypoints };
}

function calculateRoutePlan(plan, inverseRoute) {
  if (typeof inverseRoute !== "function") throw new TypeError("inverseRoute must be a function");
  const validated = validateRoutePlan(plan);
  const legs = [];
  let totalDistanceNm = 0;

  for (let index = 0; index < validated.waypoints.length - 1; index += 1) {
    const from = validated.waypoints[index];
    const to = validated.waypoints[index + 1];
    const calculation = inverseRoute({
      earthModel: validated.earthModel,
      lat1: from.lat,
      lon1: from.lon,
      lat2: to.lat,
      lon2: to.lon
    });
    totalDistanceNm += calculation.distanceNm;
    legs.push({
      sequence: index + 1,
      from,
      to,
      distanceNm: calculation.distanceNm,
      initialCourse: calculation.initialCourse,
      finalCourse: calculation.finalCourse,
      metadata: calculation.metadata
    });
  }

  return {
    ...validated,
    legs,
    totalDistanceNm,
    metadata: {
      earthModel: validated.earthModel,
      legCount: legs.length,
      coordinateReferenceSystem: validated.earthModel === EARTH_MODELS.WGS84
        ? "EPSG:4326 / WGS 84"
        : "Unspecified navigation sphere",
      warnings: ["Decision support only; verify with approved charts and voyage-planning procedures"]
    }
  };
}

module.exports = { validateRoutePlan, calculateRoutePlan };
