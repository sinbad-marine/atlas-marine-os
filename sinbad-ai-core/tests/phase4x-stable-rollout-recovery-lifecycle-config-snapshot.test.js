'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const configModule = require('../../tools/create-rollout-recovery-deployment-lifecycle-from-env.js');

const names = configModule.NAMES;
function env() { return { [names.actorHash]: 'a'.repeat(64), [names.deploymentPurpose]: 'supabase.rollout-recovery', [names.reconciliationPurpose]: 'deployment.reconciliation', [names.authorizationTtlMs]: '5000', [names.deploymentTimeoutMs]: '1000', [names.reconciliationTimeoutMs]: '1000', [names.authorizationTimeoutMs]: '1000', [names.auditPageSize]: '100', [names.auditMaxEvents]: '10000', [names.maxReconciliationAttempts]: '3', [names.reconciliationRetryDelayMs]: '1000', [names.reconciliationRetryBackoffFactor]: '2', [names.maxReconciliationRetryDelayMs]: '8000' }; }

test('advertises and creates a frozen null-prototype one-read snapshot', () => {
  assert.equal(configModule.CONFIG_VERSION, 'sinbad-rollout-recovery-deployment-lifecycle-config/4X-v1');
  const reads = new Map();
  const source = new Proxy(env(), { getOwnPropertyDescriptor(target, name) { reads.set(name, (reads.get(name) || 0) + 1); return Reflect.getOwnPropertyDescriptor(target, name); } });
  const value = configModule.snapshot(source);
  assert.equal(Object.getPrototypeOf(value), null);
  assert.ok(Object.isFrozen(value));
  for (const name of Object.values(names)) assert.equal(reads.get(name), 1);
});

test('inherited configuration is rejected even when values look valid', () => {
  const inherited = Object.create(env());
  assert.throws(() => configModule.parse(inherited), /own string value/u);
});

test('accessors are rejected without invocation', () => {
  const source = env();
  let calls = 0;
  Object.defineProperty(source, names.actorHash, { enumerable: true, get() { calls++; return 'a'.repeat(64); } });
  assert.throws(() => configModule.parse(source), /own string value/u);
  assert.equal(calls, 0);
});

test('descriptor traps and non-string own values fail closed', () => {
  const trapped = new Proxy(env(), { getOwnPropertyDescriptor() { throw new Error('host unavailable'); } });
  assert.throws(() => configModule.parse(trapped), /cannot be inspected/u);
  const nonString = env();
  nonString[names.authorizationTtlMs] = 5000;
  assert.throws(() => configModule.parse(nonString), /own string value/u);
});

test('snapshot is detached from later source mutation', () => {
  const source = env();
  const value = configModule.snapshot(source);
  source[names.actorHash] = 'b'.repeat(64);
  assert.equal(value[names.actorHash], 'a'.repeat(64));
});

test('composition rejects asserted roles and forwards no raw environment mapping', () => {
  assert.throws(() => configModule.create({ env: env(), serviceRole: 'true' }), /service-role/u);
  const source = env();
  Object.defineProperty(source, 'client', { get() { throw new Error('environment dependency read'); } });
  assert.throws(() => configModule.create({ env: source, serviceRole: true }), /service-role/u);
});
