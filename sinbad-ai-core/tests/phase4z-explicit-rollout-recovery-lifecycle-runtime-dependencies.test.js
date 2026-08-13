'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lifecycle = require('../../tools/trusted-rollout-recovery-deployment-lifecycle-runtime.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

function options() {
  return { client: { rpc: async () => null }, serviceRole: true, deploymentReadiness: { READINESS_VERSION: readiness.READINESS_VERSION, verify: async () => null }, deploy: async () => null, deploymentPurpose: 'supabase.rollout-recovery', deploymentTimeoutMs: 1000, resolve: async () => null, reconciliationTimeoutMs: 1000, authorize: async () => true, now: () => 0, actorHash: 'a'.repeat(64), reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 5000, authorizationTimeoutMs: 1000, auditPageSize: 100, auditMaxEvents: 10000, maxReconciliationAttempts: 3, reconciliationRetryDelayMs: 1000, reconciliationRetryBackoffFactor: 2, maxReconciliationRetryDelayMs: 8000 };
}

test('advertises an exact frozen runtime dependency contract', () => {
  assert.equal(lifecycle.LIFECYCLE_VERSION, 'sinbad-rollout-recovery-deployment-lifecycle-runtime/4Z-v1');
  const value = lifecycle.dependencies(options());
  assert.equal(Object.getPrototypeOf(value), null);
  assert.ok(Object.isFrozen(value));
  assert.deepEqual(Object.keys(value), lifecycle.DEPENDENCIES);
});

test('inherited accessor missing and wrong-type runtime dependencies fail closed', () => {
  assert.throws(() => lifecycle.dependencies(Object.create(options())), /own data property/u);
  const accessor = options();
  let calls = 0;
  Object.defineProperty(accessor, 'client', { get() { calls++; return { rpc: async () => null }; } });
  assert.throws(() => lifecycle.dependencies(accessor), /own data property/u);
  assert.equal(calls, 0);
  for (const changed of [{ serviceRole: 'true' }, { client: {} }, { deploymentReadiness: {} }, { deploy: null }, { resolve: null }, { authorize: null }, { now: null }]) assert.throws(() => lifecycle.dependencies({ ...options(), ...changed }), /exact trusted/iu);
});

test('descriptor failures are contained and unknown accessors are ignored', () => {
  const trapped = new Proxy(options(), { getOwnPropertyDescriptor() { throw new Error('host failure'); } });
  assert.throws(() => lifecycle.dependencies(trapped), /cannot be inspected/u);
  const input = options();
  let calls = 0;
  Object.defineProperty(input, 'secret', { enumerable: true, get() { calls++; throw new Error('must not run'); } });
  assert.doesNotThrow(() => lifecycle.create(input));
  assert.equal(calls, 0);
});

test('each accepted runtime dependency descriptor is read exactly once', () => {
  const reads = new Map();
  const source = new Proxy(options(), { getOwnPropertyDescriptor(target, name) { reads.set(name, (reads.get(name) || 0) + 1); return Reflect.getOwnPropertyDescriptor(target, name); } });
  lifecycle.create(source);
  for (const name of lifecycle.DEPENDENCIES) assert.equal(reads.get(name), 1);
});
