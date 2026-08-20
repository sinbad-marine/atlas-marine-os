"use strict";

function finiteCoordinate(value, name, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${name} must be a finite number`);
  if (number < min || number > max) throw new RangeError(`${name} is out of range`);
  return number;
}

function positive(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new RangeError(`${name} must be positive`);
  return number;
}

function assessPositionConsensus(observations, options, dependencies) {
  if (!Array.isArray(observations)) throw new TypeError("observations must be an array");
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("consensus options must be an object");
  }
  const { assessInputProvenance, inverseRoute, earthModel } = dependencies || {};
  if (typeof assessInputProvenance !== "function" || typeof inverseRoute !== "function" || !earthModel) {
    throw new TypeError("position consensus dependencies are required");
  }
  const minimumSources = Math.max(2, Math.trunc(positive(options.minimumSources ?? 2, "minimumSources")));
  const maxSeparationNm = positive(options.maxSeparationNm, "maxSeparationNm");
  const primaryObservationId = String(options.primaryObservationId || "").trim();
  if (!primaryObservationId) throw new TypeError("primaryObservationId is required");

  const ids = new Set();
  const sources = new Set();
  const checked = observations.map((observation, index) => {
    if (!observation || typeof observation !== "object" || Array.isArray(observation)) {
      throw new TypeError(`observations[${index}] must be an object`);
    }
    const id = String(observation.id || "").trim();
    if (!id) throw new TypeError(`observations[${index}].id is required`);
    if (ids.has(id)) throw new RangeError(`duplicate observation id: ${id}`);
    ids.add(id);
    const provenance = assessInputProvenance(observation.provenance, {
      now: options.now,
      maxAgeSeconds: options.maxAgeSeconds
    });
    sources.add(provenance.source);
    return {
      id,
      lat: finiteCoordinate(observation.lat, `observations[${index}].lat`, -90, 90),
      lon: finiteCoordinate(observation.lon, `observations[${index}].lon`, -180, 180),
      provenance
    };
  });

  const reasons = [];
  if (checked.length < minimumSources) reasons.push(`at least ${minimumSources} observations are required`);
  if (sources.size < minimumSources) reasons.push(`at least ${minimumSources} independent source identities are required`);
  for (const observation of checked) {
    if (observation.provenance.status !== "PASS") reasons.push(`${observation.id}: provenance is not valid`);
  }
  const primary = checked.find((item) => item.id === primaryObservationId);
  if (!primary) reasons.push("primary observation is missing");

  const pairwise = [];
  let maximumObservedSeparationNm = 0;
  for (let left = 0; left < checked.length; left += 1) {
    for (let right = left + 1; right < checked.length; right += 1) {
      const result = inverseRoute({
        earthModel,
        lat1: checked[left].lat,
        lon1: checked[left].lon,
        lat2: checked[right].lat,
        lon2: checked[right].lon
      });
      maximumObservedSeparationNm = Math.max(maximumObservedSeparationNm, result.distanceNm);
      pairwise.push({
        leftId: checked[left].id,
        rightId: checked[right].id,
        separationNm: result.distanceNm
      });
    }
  }
  if (maximumObservedSeparationNm > maxSeparationNm) {
    reasons.push("position sources exceed maximum permitted separation");
  }

  return {
    status: reasons.length === 0 ? "PASS" : "HOLD",
    selectedPosition: reasons.length === 0 && primary
      ? { lat: primary.lat, lon: primary.lon, observationId: primary.id }
      : null,
    sourceCount: sources.size,
    observationCount: checked.length,
    maximumObservedSeparationNm,
    maxSeparationNm,
    pairwise,
    observations: checked,
    reasons,
    warning: "No averaging is performed; the explicitly selected primary source remains authoritative"
  };
}

module.exports = { assessPositionConsensus };
