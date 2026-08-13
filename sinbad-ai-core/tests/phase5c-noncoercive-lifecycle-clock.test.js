'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lifecycle = require('../../tools/trusted-rollout-recovery-deployment-lifecycle-runtime.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

function options(now = () => 0) {
  return { client: { rpc: async () => null }, serviceRole: true, deploymentReadiness: { READINESS_VERSION: readiness.READINESS_VERSION, verify: async () => null }, deploy: async () => null, deploymentPurpose: 'supabase.rollout-recovery', deploymentTimeoutMs: 1000, resolve: async () => null, reconciliationTimeoutMs: 1000, authorize: async () => true, now, actorHash: 'a'.repeat(64), reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 5000, authorizationTimeoutMs: 1000, auditPageSize: 100, auditMaxEvents: 10000, maxReconciliationAttempts: 3, reconciliationRetryDelayMs: 1000, reconciliationRetryBackoffFactor: 2, maxReconciliationRetryDelayMs: 8000 };
}

test('advertises a non-coercive lifecycle clock', () => {
  assert.equal(lifecycle.LIFECYCLE_VERSION, 'sinbad-rollout-recovery-deployment-lifecycle-runtime/5C-v1');
  assert.equal(lifecycle.dependencies(options(() => 123)).now(), 123);
});

test('clock result coercion hooks are never invoked', () => {
  let calls = 0;
  const malicious = { valueOf() { calls++; throw new Error('must not run'); }, toString() { calls++; throw new Error('must not run'); }, [Symbol.toPrimitive]() { calls++; throw new Error('must not run'); } };
  const clock = lifecycle.dependencies(options(() => malicious)).now;
  assert.ok(Number.isNaN(clock()));
  assert.equal(calls, 0);
});

test('non-number throwing negative and unsafe clock values are normalized to invalid', () => {
  for (const now of [() => '1', () => 1n, () => -1, () => Number.MAX_SAFE_INTEGER + 1, () => { throw new Error('clock failure'); }]) assert.ok(Number.isNaN(lifecycle.dependencies(options(now)).now()));
});

test('clock facade is detached from later callback slot mutation', () => {
  const input = options(() => 77);
  const trusted = lifecycle.dependencies(input);
  input.now = () => 88;
  assert.equal(trusted.now(), 77);
});
