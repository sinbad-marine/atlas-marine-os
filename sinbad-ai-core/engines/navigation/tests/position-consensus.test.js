"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const navigation = require("..");

const NOW = "2026-08-20T12:00:00Z";

function observation(id, source, lat, lon, secondsAgo = 1) {
  return {
    id,
    lat,
    lon,
    provenance: {
      sourceType: navigation.SOURCE_TYPES.LIVE_SENSOR,
      source,
      observedAt: new Date(new Date(NOW).getTime() - secondsAgo * 1000).toISOString(),
      sequence: 1
    }
  };
}

test("passes close positions from distinct fresh sources", () => {
  const result = navigation.assessPositionConsensus([
    observation("gnss", "GNSS-1", 41, 29),
    observation("visual", "Visual fix", 41.0001, 29.0001)
  ], {
    now: NOW,
    maxAgeSeconds: 10,
    maxSeparationNm: 0.02,
    primaryObservationId: "gnss"
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.selectedPosition.observationId, "gnss");
  assert.match(result.warning, /No averaging/);
});

test("holds positions that disagree beyond the configured limit", () => {
  const result = navigation.assessPositionConsensus([
    observation("gnss1", "GNSS-1", 41, 29),
    observation("gnss2", "GNSS-2", 41.1, 29.1)
  ], {
    now: NOW,
    maxAgeSeconds: 10,
    maxSeparationNm: 0.1,
    primaryObservationId: "gnss1"
  });
  assert.equal(result.status, "HOLD");
  assert.equal(result.selectedPosition, null);
  assert.match(result.reasons.join(" "), /separation/);
});

test("does not count duplicate source identity as independent", () => {
  const result = navigation.assessPositionConsensus([
    observation("a", "GNSS-1", 41, 29),
    observation("b", "GNSS-1", 41, 29)
  ], {
    now: NOW,
    maxAgeSeconds: 10,
    maxSeparationNm: 0.1,
    primaryObservationId: "a"
  });
  assert.equal(result.status, "HOLD");
  assert.match(result.reasons.join(" "), /independent source/);
});

test("holds when the selected primary observation is absent", () => {
  const result = navigation.assessPositionConsensus([
    observation("a", "GNSS-1", 41, 29),
    observation("b", "Visual fix", 41, 29)
  ], {
    now: NOW,
    maxAgeSeconds: 10,
    maxSeparationNm: 0.1,
    primaryObservationId: "missing"
  });
  assert.equal(result.status, "HOLD");
  assert.match(result.reasons.join(" "), /primary observation/);
});

test("holds when one source is stale", () => {
  const result = navigation.assessPositionConsensus([
    observation("a", "GNSS-1", 41, 29),
    observation("b", "Visual fix", 41, 29, 100)
  ], {
    now: NOW,
    maxAgeSeconds: 10,
    maxSeparationNm: 0.1,
    primaryObservationId: "a"
  });
  assert.equal(result.status, "HOLD");
  assert.match(result.reasons.join(" "), /provenance/);
});

test("uses geodesic separation correctly across the antimeridian", () => {
  const result = navigation.assessPositionConsensus([
    observation("a", "GNSS-1", 0, 179.9999),
    observation("b", "Visual fix", 0, -179.9999)
  ], {
    now: NOW,
    maxAgeSeconds: 10,
    maxSeparationNm: 0.02,
    primaryObservationId: "a"
  });
  assert.equal(result.status, "PASS");
  assert.ok(result.maximumObservedSeparationNm < 0.02);
});
