"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const navigation = require("..");

function plan(name = "Route A") {
  return {
    id: "route-a",
    name,
    earthModel: navigation.EARTH_MODELS.WGS84,
    waypoints: [
      { id: "A", name: "A", lat: 41, lon: 29 },
      { id: "B", name: "B", lat: 40, lon: 20 }
    ]
  };
}

test("creates a deterministic integrity hash independent of object key order", () => {
  const first = navigation.routeRevisions.digest({ b: 2, a: 1 });
  const second = navigation.routeRevisions.digest({ a: 1, b: 2 });
  assert.equal(first, second);
});

test("creates and verifies a first route revision", () => {
  const revision = navigation.createRouteRevision({
    sequence: 1,
    createdAt: "2026-08-20T12:00:00Z",
    author: "Master",
    reason: "Initial issue",
    routePlan: plan()
  });
  assert.equal(revision.revisionHash.length, 64);
  assert.deepEqual(navigation.verifyRouteRevision(revision).valid, true);
  assert.equal(Object.isFrozen(revision), true);
});

test("detects tampering after a revision is issued", () => {
  const revision = navigation.createRouteRevision({
    sequence: 1,
    createdAt: "2026-08-20T12:00:00Z",
    author: "Master",
    reason: "Initial issue",
    routePlan: plan()
  });
  const tampered = { ...revision, reason: "Undocumented change" };
  assert.equal(navigation.verifyRouteRevision(tampered).valid, false);
});

test("verifies a linked route revision chain", () => {
  const first = navigation.createRouteRevision({
    sequence: 1,
    createdAt: "2026-08-20T12:00:00Z",
    author: "Master",
    reason: "Initial issue",
    routePlan: plan()
  });
  const second = navigation.createRouteRevision({
    sequence: 2,
    createdAt: "2026-08-20T13:00:00Z",
    author: "Master",
    reason: "Weather routing amendment",
    previousRevisionHash: first.revisionHash,
    routePlan: plan("Route A amended")
  });
  assert.deepEqual(navigation.verifyRevisionChain([first, second]), {
    valid: true,
    headHash: second.revisionHash,
    revisionCount: 2
  });
});

test("rejects missing or broken revision links", () => {
  assert.throws(() => navigation.createRouteRevision({
    sequence: 2,
    author: "Master",
    reason: "Amendment",
    routePlan: plan()
  }), /previousRevisionHash/);

  const first = navigation.createRouteRevision({
    sequence: 1,
    createdAt: "2026-08-20T12:00:00Z",
    author: "Master",
    reason: "Initial issue",
    routePlan: plan()
  });
  const second = navigation.createRouteRevision({
    sequence: 2,
    createdAt: "2026-08-20T13:00:00Z",
    author: "Master",
    reason: "Amendment",
    previousRevisionHash: "0".repeat(64),
    routePlan: plan("Changed")
  });
  assert.equal(navigation.verifyRevisionChain([first, second]).valid, false);
});
