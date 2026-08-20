"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const navigation = require("..");

function fixture() {
  const routePlan = {
    id: "route-release-1",
    name: "Release example",
    earthModel: navigation.EARTH_MODELS.WGS84,
    waypoints: [
      { id: "A", name: "A", lat: 41, lon: 29 },
      { id: "B", name: "B", lat: 40, lon: 20 },
      { id: "C", name: "C", lat: 42, lon: 10 }
    ]
  };
  const revision = navigation.createRouteRevision({
    sequence: 1,
    createdAt: "2026-08-20T12:00:00Z",
    author: "Planner",
    reason: "Initial route",
    routePlan
  });
  const legEvidence = [1, 2].map((legSequence) => ({
    legSequence,
    status: "PASS",
    independentReference: true,
    reference: { provider: "Independent calculator", version: "1", testCase: `leg-${legSequence}` }
  }));
  return { revision, legEvidence };
}

test("stops a route with missing independent leg evidence", () => {
  const { revision, legEvidence } = fixture();
  const result = navigation.assessRouteRelease({ revisions: [revision], legEvidence: legEvidence.slice(0, 1) });
  assert.equal(result.status, "HOLD");
  assert.equal(result.technicalReady, false);
  assert.ok(result.reasons.some((reason) => /leg 2/.test(reason)));
});

test("does not release a technically ready route without human approval", () => {
  const { revision, legEvidence } = fixture();
  const result = navigation.assessRouteRelease({ revisions: [revision], legEvidence });
  assert.equal(result.status, "READY_FOR_HUMAN_APPROVAL");
  assert.equal(result.technicalReady, true);
  assert.equal(result.approval, null);
});

test("releases only the exact revision explicitly approved by a human", () => {
  const { revision, legEvidence } = fixture();
  const result = navigation.assessRouteRelease({
    revisions: [revision],
    legEvidence,
    approval: {
      decision: "APPROVE",
      approver: "Captain Example",
      role: "Master",
      approvedAt: "2026-08-20T14:00:00Z",
      routeRevisionHash: revision.revisionHash
    }
  });
  assert.equal(result.status, "RELEASED");
  assert.equal(result.routeRevisionHash, revision.revisionHash);
});

test("holds an approval referring to another revision", () => {
  const { revision, legEvidence } = fixture();
  const result = navigation.assessRouteRelease({
    revisions: [revision],
    legEvidence,
    approval: {
      decision: "APPROVE",
      approver: "Captain Example",
      role: "Master",
      approvedAt: "2026-08-20T14:00:00Z",
      routeRevisionHash: "f".repeat(64)
    }
  });
  assert.equal(result.status, "HOLD");
  assert.ok(result.reasons.some((reason) => /different route revision/.test(reason)));
});

test("does not accept internal consistency as independent evidence", () => {
  const { revision, legEvidence } = fixture();
  legEvidence[0].independentReference = false;
  const result = navigation.assessRouteRelease({ revisions: [revision], legEvidence });
  assert.equal(result.status, "HOLD");
  assert.ok(result.reasons.some((reason) => /leg 1/.test(reason)));
});

test("rejects implicit or malformed approval", () => {
  const { revision, legEvidence } = fixture();
  assert.throws(() => navigation.assessRouteRelease({
    revisions: [revision],
    legEvidence,
    approval: { decision: "yes" }
  }), /explicitly/);
});
