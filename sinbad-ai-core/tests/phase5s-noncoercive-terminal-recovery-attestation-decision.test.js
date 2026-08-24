'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const readinessPath = require.resolve('../adapters/supabase-terminal-recovery-readiness.js');
const attestationPath = require.resolve('../adapters/supabase-terminal-recovery-attestation.js');
const version = 'sinbad-terminal-recovery-readiness/3F-v1';
function decision() { return { version, status: 'RECOVERY_READINESS_READY', reasonCode: null, expiredCount: 0, oldestAgeMs: 0, auditEventCount: 0, auditPageCount: 1, auditWatermarkId: null }; }
function options() { return { ttlMs: 5000, purpose: 'terminal-rollout', now: () => 1000 }; }

async function issue(response) {
  const originalReadiness = require.cache[readinessPath], originalAttestation = require.cache[attestationPath];
  try {
    require.cache[readinessPath] = { id: readinessPath, filename: readinessPath, loaded: true, exports: Object.freeze({ READINESS_VERSION: version, create: () => Object.freeze({ check: async () => response }) }), children: [], paths: [] };
    delete require.cache[attestationPath];
    return await require(attestationPath).create(options()).issue();
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
  for (const changed of [{ expiredCount: -1 }, { oldestAgeMs: -1 }, { auditEventCount: -1 }, { auditPageCount: 0 }, { auditWatermarkId: 0 }, { auditEventCount: 1, auditWatermarkId: null }, { auditEventCount: 0, auditWatermarkId: 1 }]) assert.equal((await issue({ ...decision(), ...changed })).reasonCode, 'READINESS_NOT_READY');
});
