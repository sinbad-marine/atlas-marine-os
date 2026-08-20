'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lifecycle = require('../../tools/trusted-rollout-recovery-deployment-lifecycle-runtime.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

function options() {
  return { client: { rpc: async () => null }, serviceRole: true, deploymentReadiness: { READINESS_VERSION: readiness.READINESS_VERSION, verify: async () => null }, deploy: async () => null, deploymentPurpose: 'supabase.rollout-recovery', deploymentTimeoutMs: 1000, resolve: async () => null, reconciliationTimeoutMs: 1000, authorize: async () => true, now: () => 0, actorHash: 'a'.repeat(64), reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 5000, authorizationTimeoutMs: 1000, auditPageSize: 100, auditMaxEvents: 10000, maxReconciliationAttempts: 3, reconciliationRetryDelayMs: 1000, reconciliationRetryBackoffFactor: 2, maxReconciliationRetryDelayMs: 8000 };
}

test('advertises atomic lifecycle policy bounds', () => {
  assert.match(lifecycle.LIFECYCLE_VERSION, /^sinbad-rollout-recovery-deployment-lifecycle-runtime\/5[BC]-v1$/u);
  assert.doesNotThrow(() => lifecycle.dependencies(options()));
});

test('timeout and authorization bounds fail at dependency admission', () => {
  for (const name of ['deploymentTimeoutMs', 'reconciliationTimeoutMs', 'authorizationTtlMs', 'authorizationTimeoutMs']) for (const value of [999, 300001]) assert.throws(() => lifecycle.dependencies({ ...options(), [name]: value }), /bounded lifecycle timeout/u);
});

test('audit scan bounds and cross-field ordering fail atomically', () => {
  for (const changed of [{ auditPageSize: 0 }, { auditPageSize: 501 }, { auditMaxEvents: 99 }, { auditMaxEvents: 100001 }]) assert.throws(() => lifecycle.dependencies({ ...options(), ...changed }), /bounded audit scan/u);
});

test('retry attempt delay and backoff bounds fail atomically', () => {
  for (const changed of [{ maxReconciliationAttempts: 0 }, { maxReconciliationAttempts: 11 }]) assert.throws(() => lifecycle.dependencies({ ...options(), ...changed }), /attempt policy/u);
  for (const changed of [{ reconciliationRetryDelayMs: 999 }, { reconciliationRetryDelayMs: 300001 }]) assert.throws(() => lifecycle.dependencies({ ...options(), ...changed }), /retry delay policy/u);
  for (const changed of [{ reconciliationRetryBackoffFactor: 1 }, { reconciliationRetryBackoffFactor: 5 }, { maxReconciliationRetryDelayMs: 999 }, { maxReconciliationRetryDelayMs: 300001 }]) assert.throws(() => lifecycle.dependencies({ ...options(), ...changed }), /backoff policy/u);
});
