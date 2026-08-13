'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const authorization = require('../../tools/trusted-rollout-recovery-deployment-reconciliation-authorization.js');
const reconciliation = require('../../tools/trusted-rollout-recovery-deployment-reconciliation.js');
const audit = require('../../tools/trusted-rollout-recovery-deployment-reconciliation-audit.js');
const readiness = require('../../tools/rollout-recovery-deployment-reconciliation-audit-readiness.js');

const hash = 'a'.repeat(64);
function options(record) { return { deploymentJournal: { version: reconciliation.EXPECTED_JOURNAL_VERSION, durable: true, inspect: async () => ({ status: 'FOUND', state: { status: 'APPLIED' } }), settle: async () => ({ status: 'SETTLED' }) }, resolve: async () => 'APPLIED', reconciliationTimeoutMs: 1000, authorize: async () => true, authorizationAudit: { version: audit.AUDIT_VERSION, durable: true, record }, auditReadiness: { version: readiness.READINESS_VERSION, check: async () => ({ version: readiness.READINESS_VERSION, status: 'RECONCILIATION_AUDIT_READINESS_READY', reasonCode: null, eventCount: 0, pageCount: 1, watermarkId: null }) }, now: () => 1000, actorHash: 'b'.repeat(64), reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 1000, authorizationTimeoutMs: 1000 }; }

test('advertises an exact reconciliation audit result contract', () => {
  assert.equal(authorization.AUTHORIZATION_VERSION, 'sinbad-rollout-recovery-deployment-reconciliation-authorization/5F-v1');
  const value = authorization.auditResultSnapshot({ status: 'RECORDED', eventHash: 'd'.repeat(64) });
  assert.equal(Object.getPrototypeOf(value), null);
  assert.ok(Object.isFrozen(value));
  assert.deepEqual(Object.keys(value), authorization.AUDIT_RESULT_FIELDS);
});

test('audit result accessors fail closed without invocation', async () => {
  for (const name of authorization.AUDIT_RESULT_FIELDS) {
    const response = { status: 'RECORDED', eventHash: 'd'.repeat(64) }; let calls = 0;
    Object.defineProperty(response, name, { get() { calls++; throw new Error('must not run'); } });
    const value = authorization.create(options(async () => response));
    assert.equal((await value.issue(hash)).reasonCode, 'AUTHORIZATION_AUDIT_REQUIRED');
    assert.equal(calls, 0, name);
  }
});

test('descriptor traps inherited and malformed audit results fail closed', async () => {
  const valid = { status: 'RECORDED', eventHash: 'd'.repeat(64) };
  for (const response of [Object.create(valid), new Proxy(valid, { getOwnPropertyDescriptor() { throw new Error('host failure'); } }), null, { status: 'RECORDED', eventHash: {} }]) {
    const value = authorization.create(options(async () => response));
    assert.equal((await value.issue(hash)).reasonCode, 'AUTHORIZATION_AUDIT_REQUIRED');
  }
});

test('coercive audit result fields fail closed without conversion hooks', async () => {
  for (const name of authorization.AUDIT_RESULT_FIELDS) {
    let calls = 0;
    const coercive = { toString() { calls++; return name === 'status' ? 'RECORDED' : 'd'.repeat(64); }, valueOf() { calls++; return name === 'status' ? 'RECORDED' : 'd'.repeat(64); } };
    const response = { status: 'RECORDED', eventHash: 'd'.repeat(64), [name]: coercive };
    const value = authorization.create(options(async () => response));
    assert.equal((await value.issue(hash)).reasonCode, 'AUTHORIZATION_AUDIT_REQUIRED');
    assert.equal(calls, 0, name);
  }
});
