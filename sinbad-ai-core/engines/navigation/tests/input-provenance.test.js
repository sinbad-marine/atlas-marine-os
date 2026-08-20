"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const navigation = require("..");

const NOW = "2026-08-20T12:00:00Z";

test("passes fresh identified live data", () => {
  const result = navigation.assessInputProvenance({
    sourceType: navigation.SOURCE_TYPES.LIVE_SENSOR,
    source: "GNSS-1",
    observedAt: "2026-08-20T11:59:55Z",
    sequence: 42
  }, { now: NOW, maxAgeSeconds: 10 });
  assert.equal(result.status, "PASS");
  assert.equal(result.ageSeconds, 5);
});

test("holds stale and future live observations", () => {
  const stale = navigation.assessInputProvenance({
    sourceType: navigation.SOURCE_TYPES.LIVE_SERVICE,
    source: "Weather service",
    observedAt: "2026-08-20T11:00:00Z"
  }, { now: NOW, maxAgeSeconds: 900 });
  assert.equal(stale.status, "HOLD");
  assert.match(stale.reasons[0], /maximum permitted age/);

  const future = navigation.assessInputProvenance({
    sourceType: navigation.SOURCE_TYPES.MANUAL_OBSERVATION,
    source: "Bridge log",
    observedAt: "2026-08-20T12:01:00Z"
  }, { now: NOW, maxAgeSeconds: 900 });
  assert.equal(future.status, "HOLD");
  assert.match(future.reasons[0], /future/);
});

test("requires edition for a static publication", () => {
  assert.throws(() => navigation.assessInputProvenance({
    sourceType: navigation.SOURCE_TYPES.STATIC_PUBLICATION,
    source: "Tide publication"
  }, { now: NOW }), /edition/);
});

test("holds a publication that is not yet effective", () => {
  const result = navigation.assessInputProvenance({
    sourceType: navigation.SOURCE_TYPES.STATIC_PUBLICATION,
    source: "Official notice",
    edition: "2027",
    effectiveAt: "2027-01-01T00:00:00Z"
  }, { now: NOW });
  assert.equal(result.status, "HOLD");
});

test("warns when live sensor sequencing cannot be audited", () => {
  const result = navigation.assessInputProvenance({
    sourceType: navigation.SOURCE_TYPES.LIVE_SENSOR,
    source: "Anemometer",
    observedAt: "2026-08-20T11:59:59Z"
  }, { now: NOW, maxAgeSeconds: 10 });
  assert.equal(result.status, "PASS");
  assert.ok(result.warnings.some((warning) => /sequence/.test(warning)));
});

test("holds an input set when a required source is missing or stale", () => {
  const result = navigation.assessInputSet({
    position: {
      sourceType: navigation.SOURCE_TYPES.LIVE_SENSOR,
      source: "GNSS-1",
      observedAt: "2026-08-20T11:59:58Z",
      sequence: 1
    }
  }, {
    position: { maxAgeSeconds: 10 },
    wind: { maxAgeSeconds: 60 }
  }, { now: NOW });
  assert.equal(result.status, "HOLD");
  assert.match(result.reasons.join(" "), /wind/);
});

test("requires a positive live-data age policy", () => {
  assert.throws(() => navigation.assessInputProvenance({
    sourceType: navigation.SOURCE_TYPES.LIVE_SERVICE,
    source: "Current service",
    observedAt: NOW
  }, { now: NOW, maxAgeSeconds: 0 }), /positive/);
});
