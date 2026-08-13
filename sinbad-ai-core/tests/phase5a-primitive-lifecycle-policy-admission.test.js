'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lifecycle = require('../../tools/trusted-rollout-recovery-deployment-lifecycle-runtime.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

function options() {
  return { client: { rpc: async () => null }, serviceRole: true, deploymentReadiness: { READINESS_VERSION: readiness.READINESS_VERSION, verify: async () => null }, deploy: async () => null, deploymentPurpose: 'supabase.rollout-recovery', deploymentTimeoutMs: 1000, resolve: async () => null, reconciliationTimeoutMs: 1000, authorize: async () => true, now: () => 0, actorHash: 'a'.repeat(64), reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 5000, authorizationTimeoutMs: 1000, auditPageSize: 100, auditMaxEvents: 10000, maxReconciliationAttempts: 3, reconciliationRetryDelayMs: 1000, reconciliationRetryBackoffFactor: 2, maxReconciliationRetryDelayMs: 8000 };
}

test('advertises exact primitive lifecycle policy admission', () => {
  assert.match(lifecycle.LIFECYCLE_VERSION, /^sinbad-rollout-recovery-deployment-lifecycle-runtime\/5[AB]-v1$/u);
  assert.doesNotThrow(() => lifecycle.create(options()));
});

test('object coercion hooks are rejected without invocation', () => {
  for (const name of ['deploymentPurpose', 'reconciliationPurpose', 'actorHash', 'deploymentTimeoutMs', 'reconciliationTimeoutMs', 'authorizationTtlMs', 'authorizationTimeoutMs', 'auditPageSize', 'auditMaxEvents', 'maxReconciliationAttempts', 'reconciliationRetryDelayMs', 'reconciliationRetryBackoffFactor', 'maxReconciliationRetryDelayMs']) {
    let calls = 0;
    const malicious = { valueOf() { calls++; throw new Error('must not run'); }, toString() { calls++; throw new Error('must not run'); }, [Symbol.toPrimitive]() { calls++; throw new Error('must not run'); } };
    assert.throws(() => lifecycle.create({ ...options(), [name]: malicious }), /primitive|safe integer/iu);
    assert.equal(calls, 0, name);
  }
});

test('numeric strings booleans bigint infinity and unsafe integers fail before subordinate construction', () => {
  const names = ['deploymentTimeoutMs', 'reconciliationTimeoutMs', 'authorizationTtlMs', 'authorizationTimeoutMs', 'auditPageSize', 'auditMaxEvents', 'maxReconciliationAttempts', 'reconciliationRetryDelayMs', 'reconciliationRetryBackoffFactor', 'maxReconciliationRetryDelayMs'];
  for (const name of names) for (const value of ['1000', true, 1n, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => lifecycle.create({ ...options(), [name]: value }), /safe integer/iu);
});

test('every numeric policy range fails at the central boundary before RPC work', () => {
  const invalid = [{ deploymentTimeoutMs: 999 }, { deploymentTimeoutMs: 300001 }, { reconciliationTimeoutMs: 999 }, { authorizationTtlMs: 999 }, { authorizationTimeoutMs: 300001 }, { auditPageSize: 0 }, { auditPageSize: 501 }, { auditMaxEvents: 99 }, { auditMaxEvents: 100001 }, { maxReconciliationAttempts: 0 }, { maxReconciliationAttempts: 11 }, { reconciliationRetryDelayMs: 999 }, { reconciliationRetryBackoffFactor: 1 }, { reconciliationRetryBackoffFactor: 5 }, { maxReconciliationRetryDelayMs: 999 }, { maxReconciliationRetryDelayMs: 300001 }];
  for (const changed of invalid) {
    let calls = 0;
    const input = { ...options(), ...changed, client: { rpc: async () => { calls++; return null; } } };
    assert.throws(() => lifecycle.create(input), /bounded/iu);
    assert.equal(calls, 0);
  }
});

test('invalid primitive identity policy fails closed', () => {
  for (const changed of [{ deploymentPurpose: '' }, { deploymentPurpose: 'x y' }, { reconciliationPurpose: 1 }, { actorHash: 'A'.repeat(64) }, { actorHash: 1 }]) assert.throws(() => lifecycle.create({ ...options(), ...changed }), /primitive lifecycle identity/iu);
});
