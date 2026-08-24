'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const readiness = require('../../tools/rollout-recovery-deployment-reconciliation-audit-readiness.js');

function scan() { return { version: readiness.EXPECTED_VERIFIER_VERSION, status: 'AUDIT_SCAN_COMPLETE', reasonCode: null, eventCount: 0, pageCount: 1, watermarkId: null }; }
function gate(response) { return readiness.create({ auditVerifier: { version: readiness.EXPECTED_VERIFIER_VERSION, scan: async () => response }, pageSize: 10, maxEvents: 100 }); }

test('reconciliation readiness scan accessors traps inherited and coercive fields fail closed', async () => {
  let calls = 0;
  const malicious = { toString() { calls++; throw new Error('must not run'); }, valueOf() { calls++; throw new Error('must not run'); } };
  for (const response of [Object.create(scan()), new Proxy(scan(), { getOwnPropertyDescriptor() { throw new Error('host failure'); } }), { ...scan(), status: 'AUDIT_SCAN_INCOMPLETE', reasonCode: malicious }]) assert.equal((await gate(response).check()).reasonCode, 'AUDIT_SCAN_CONTRACT_INVALID');
  for (const field of readiness.SCAN_FIELDS) {
    const response = scan();
    Object.defineProperty(response, field, { get() { calls++; throw new Error('must not run'); } });
    assert.equal((await gate(response).check()).reasonCode, 'AUDIT_SCAN_CONTRACT_INVALID');
  }
  assert.equal(calls, 0);
});

test('reconciliation readiness scan rejects malformed primitive counters and watermark invariants', async () => {
  for (const changed of [{ eventCount: -1 }, { pageCount: -1 }, { watermarkId: 0 }, { eventCount: 1, watermarkId: null }, { eventCount: 0, watermarkId: 1 }]) assert.equal((await gate({ ...scan(), ...changed }).check()).status, 'RECONCILIATION_AUDIT_READINESS_BLOCKED');
});
