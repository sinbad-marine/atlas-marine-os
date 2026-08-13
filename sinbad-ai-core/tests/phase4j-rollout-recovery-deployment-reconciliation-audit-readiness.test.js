'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const readiness = require('../../tools/rollout-recovery-deployment-reconciliation-audit-readiness.js');

const complete = (overrides = {}) => ({ version: readiness.EXPECTED_VERIFIER_VERSION, status: 'AUDIT_SCAN_COMPLETE', reasonCode: null, eventCount: 2, pageCount: 2, watermarkId: 4, ...overrides });
const verifier = response => ({ version: readiness.EXPECTED_VERIFIER_VERSION, scan: async () => response });

test('returns ready only for an exact complete bounded integrity scan', async () => {
  const value = await readiness.create({ auditVerifier: verifier(complete()), pageSize: 10, maxEvents: 100 }).check();
  assert.deepEqual(value, { version: readiness.READINESS_VERSION, status: 'RECONCILIATION_AUDIT_READINESS_READY', reasonCode: null, eventCount: 2, pageCount: 2, watermarkId: 4 });
  assert.ok(Object.isFrozen(value));
});

test('incomplete malformed unavailable and thrown scans remain blocked', async () => {
  const scans = [{ ...complete(), status: 'AUDIT_SCAN_INCOMPLETE', reasonCode: 'AUDIT_SCAN_LIMIT_REACHED' }, { ...complete(), version: 'wrong' }, complete({ eventCount: 0, watermarkId: 4 }), null];
  for (const scan of scans) assert.equal((await readiness.create({ auditVerifier: verifier(scan), pageSize: 10, maxEvents: 100 }).check()).status, 'RECONCILIATION_AUDIT_READINESS_BLOCKED');
  const thrown = readiness.create({ auditVerifier: { version: readiness.EXPECTED_VERIFIER_VERSION, scan: async () => { throw new Error('offline'); } }, pageSize: 10, maxEvents: 100 });
  assert.equal((await thrown.check()).reasonCode, 'AUDIT_SCAN_EXCEPTION');
});

test('construction requires exact verifier and bounded policy', () => {
  assert.throws(() => readiness.create(), /auditVerifier/u);
  assert.throws(() => readiness.create({ auditVerifier: verifier(complete()), pageSize: 0, maxEvents: 100 }), /policy/u);
});
