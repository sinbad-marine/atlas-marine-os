'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const readiness = require('../../tools/rollout-recovery-deployment-reconciliation-audit-readiness.js');
const authorization = require('../../tools/trusted-rollout-recovery-deployment-reconciliation-authorization.js');
const reconciliation = require('../../tools/trusted-rollout-recovery-deployment-reconciliation.js');
const audit = require('../../tools/trusted-rollout-recovery-deployment-reconciliation-audit.js');

const hash = 'a'.repeat(64);
function decision() { return { version: readiness.READINESS_VERSION, status: 'RECONCILIATION_AUDIT_READINESS_READY', reasonCode: null, eventCount: 0, pageCount: 1, watermarkId: null }; }
function options(check) { return { deploymentJournal: { version: reconciliation.EXPECTED_JOURNAL_VERSION, durable: true, inspect: async () => ({ status: 'FOUND', state: { status: 'APPLIED' } }), settle: async () => ({ status: 'SETTLED' }) }, resolve: async () => 'APPLIED', reconciliationTimeoutMs: 1000, authorize: async () => true, authorizationAudit: { version: audit.AUDIT_VERSION, durable: true, record: async () => ({ status: 'RECORDED', eventHash: 'd'.repeat(64) }) }, auditReadiness: { version: readiness.READINESS_VERSION, check }, now: () => 1000, actorHash: 'b'.repeat(64), reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 1000, authorizationTimeoutMs: 1000 }; }

test('advertises exact reconciliation readiness decision fields', () => {
  assert.match(authorization.AUTHORIZATION_VERSION, /^sinbad-rollout-recovery-deployment-reconciliation-authorization\/5[EF]-v1$/u);
  const value = readiness.snapshot(decision());
  assert.equal(Object.getPrototypeOf(value), null);
  assert.ok(Object.isFrozen(value));
  assert.deepEqual(Object.keys(value), readiness.DECISION_FIELDS);
});

test('readiness decision accessors fail closed without invocation', async () => {
  for (const name of readiness.DECISION_FIELDS) {
    const response = decision(); let calls = 0;
    Object.defineProperty(response, name, { get() { calls++; throw new Error('must not run'); } });
    const value = authorization.create(options(async () => response));
    assert.equal((await value.issue(hash)).reasonCode, 'AUDIT_READINESS_REQUIRED');
    assert.equal(calls, 0, name);
  }
});

test('descriptor traps inherited fields and coercive reason codes fail closed', async () => {
  let calls = 0;
  const malicious = { toString() { calls++; throw new Error('must not run'); }, valueOf() { calls++; throw new Error('must not run'); } };
  for (const response of [Object.create(decision()), new Proxy(decision(), { getOwnPropertyDescriptor() { throw new Error('host failure'); } }), { ...decision(), status: 'RECONCILIATION_AUDIT_READINESS_BLOCKED', reasonCode: malicious }]) {
    const value = authorization.create(options(async () => response));
    assert.equal((await value.issue(hash)).reasonCode, 'AUDIT_READINESS_REQUIRED');
  }
  assert.equal(calls, 0);
});

test('malformed readiness counts fail before operator authorization', async () => {
  for (const changed of [{ eventCount: -1 }, { pageCount: 0 }, { watermarkId: 0 }, { eventCount: 1, watermarkId: null }, { eventCount: 0, watermarkId: 1 }]) {
    let authorizations = 0;
    const value = authorization.create({ ...options(async () => ({ ...decision(), ...changed })), authorize: async () => { authorizations++; return true; } });
    assert.equal((await value.issue(hash)).reasonCode, 'AUDIT_READINESS_REQUIRED');
    assert.equal(authorizations, 0);
  }
});
