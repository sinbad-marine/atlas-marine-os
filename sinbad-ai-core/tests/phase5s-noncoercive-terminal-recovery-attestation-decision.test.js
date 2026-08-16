'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const readinessPath = require.resolve('../adapters/supabase-terminal-recovery-readiness.js');
const attestationPath = require.resolve('../adapters/supabase-terminal-recovery-attestation.js');
const version = 'sinbad-terminal-recovery-readiness/3F-v1';
function decision() { return { version, status: 'RECOVERY_READINESS_READY', reasonCode: null, expiredCount: 0, oldestAgeMs: 0, auditEventCount: 0, auditPageCount: 1, auditWatermarkId: null }; }
function options(overrides = {}) { return { serviceRole: true, actorHash: 'a'.repeat(64), client: { rpc: async () => ({ data: [], error: null }) }, limit: 10, slaMs: 120000, pageSize: 10, maxEvents: 100, ttlMs: 5000, purpose: 'terminal-rollout', now: () => 1000, ...overrides }; }

async function issue(response, overrides) {
  const originalReadiness = require.cache[readinessPath], originalAttestation = require.cache[attestationPath];
  try {
    require.cache[readinessPath] = { id: readinessPath, filename: readinessPath, loaded: true, exports: Object.freeze({ READINESS_VERSION: version, create: () => Object.freeze({ check: async () => response }) }), children: [], paths: [] };
    delete require.cache[attestationPath];
    return await require(attestationPath).create(options(overrides)).issue();
  } finally {
    if (originalReadiness) require.cache[readinessPath] = originalReadiness; else delete require.cache[readinessPath];
    if (originalAttestation) require.cache[attestationPath] = originalAttestation; else delete require.cache[attestationPath];
  }
}

test('attestation decision accessors traps inherited and coercive fields fail closed', async () => {
  let hooks = 0;
  const malicious = { valueOf() { hooks++; throw new Error('must not run'); }, toString() { hooks++; throw new Error('must not run'); } };
  for (const response of [Object.create(decision()), new Proxy(decision(), { getOwnPropertyDescriptor() { throw new Error('host failure'); } }), { ...decision(), expiredCount: malicious }]) assert.equal((await issue(response)).reasonCode, 'READINESS_NOT_READY');
  for (const field of Object.keys(decision())) { const response = decision(); Object.defineProperty(response, field, { get() { hooks++; throw new Error('must not run'); } }); assert.equal((await issue(response)).reasonCode, 'READINESS_NOT_READY'); }
  assert.equal(hooks, 0);
});

test('attestation rejects malformed ready counters before clock sampling', async () => {
  let clockCalls = 0;
  const invalid = [-1, '0', 1n, 1.5, Number.MAX_SAFE_INTEGER + 1, Object(0)];
  for (const field of ['expiredCount', 'oldestAgeMs', 'auditEventCount', 'auditPageCount']) for (const value of invalid) assert.equal((await issue({ ...decision(), [field]: value }, { now: () => { clockCalls++; return 1000; } })).reasonCode, 'READINESS_NOT_READY');
  for (const changed of [{ auditPageCount: 0 }, { auditWatermarkId: 0 }, { auditWatermarkId: '1' }, { auditWatermarkId: 1n }, { auditWatermarkId: 1.5 }, { auditEventCount: 1, auditWatermarkId: null }, { auditEventCount: 0, auditWatermarkId: 1 }]) assert.equal((await issue({ ...decision(), ...changed }, { now: () => { clockCalls++; return 1000; } })).reasonCode, 'READINESS_NOT_READY');
  assert.equal(clockCalls, 0);
});

test('attestation accepts one exact ready snapshot and samples the clock once', async () => {
  let clockCalls = 0;
  const output = await issue(Object.freeze(decision()), { now: () => { clockCalls++; return 1000; } });
  assert.equal(output.status, 'READINESS_ATTESTED');
  assert.equal(output.reasonCode, null);
  assert.match(output.attestationHash, /^[a-f0-9]{64}$/u);
  assert.equal(clockCalls, 1);
});
