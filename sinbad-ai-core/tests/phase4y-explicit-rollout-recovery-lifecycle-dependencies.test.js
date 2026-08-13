'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../../tools/create-rollout-recovery-deployment-lifecycle-from-env.js');

function options() { return { env: {}, client: { rpc: async () => null }, serviceRole: true, deploymentReadiness: { verify: async () => null }, deploy: async () => null, resolve: async () => null, authorize: async () => false, now: () => 0 }; }

test('advertises an exact frozen dependency contract', () => {
  assert.equal(config.CONFIG_VERSION, 'sinbad-rollout-recovery-deployment-lifecycle-config/4Y-v1');
  const value = config.dependencies(options());
  assert.equal(Object.getPrototypeOf(value), null);
  assert.ok(Object.isFrozen(value));
  assert.deepEqual(Object.keys(value), config.DEPENDENCIES);
});

test('inherited accessor missing and wrong-type dependencies fail closed', () => {
  assert.throws(() => config.dependencies(Object.create(options())), /own data property/u);
  const accessor = options();
  let calls = 0;
  Object.defineProperty(accessor, 'client', { get() { calls++; return { rpc: async () => null }; } });
  assert.throws(() => config.dependencies(accessor), /own data property/u);
  assert.equal(calls, 0);
  for (const changed of [{ serviceRole: 'true' }, { client: {} }, { deploymentReadiness: {} }, { deploy: null }, { resolve: null }, { authorize: null }, { now: null }]) assert.throws(() => config.dependencies({ ...options(), ...changed }), /exact trusted/iu);
});

test('descriptor failures are contained without invoking dependencies', () => {
  const trapped = new Proxy(options(), { getOwnPropertyDescriptor() { throw new Error('host failure'); } });
  assert.throws(() => config.dependencies(trapped), /cannot be inspected/u);
});

test('unknown option accessors are ignored without invocation', () => {
  const input = options();
  let calls = 0;
  Object.defineProperty(input, 'secret', { enumerable: true, get() { calls++; throw new Error('must not run'); } });
  assert.doesNotThrow(() => config.dependencies(input));
  assert.equal(calls, 0);
});

test('each accepted dependency descriptor is read exactly once', () => {
  const reads = new Map();
  const source = new Proxy(options(), { getOwnPropertyDescriptor(target, name) { reads.set(name, (reads.get(name) || 0) + 1); return Reflect.getOwnPropertyDescriptor(target, name); } });
  config.dependencies(source);
  for (const name of config.DEPENDENCIES) assert.equal(reads.get(name), 1);
});
