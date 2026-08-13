'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const authorization = require('../../tools/trusted-rollout-recovery-deployment-authorization.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

const commit = 'a'.repeat(40);
function result() { return { version: readiness.READINESS_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_READY', reasonCode: null, commit, eventCount: 0, pageCount: 1, watermarkId: null }; }
function options(verify) { return { deploymentReadiness: { READINESS_VERSION: readiness.READINESS_VERSION, verify }, deploy: async () => 'APPLIED', now: () => 1000, deploymentPurpose: 'supabase.rollout-recovery', authorizationTtlMs: 1000, deploymentTimeoutMs: 1000 }; }

test('advertises an exact non-coercive readiness result contract', () => {
  assert.equal(authorization.AUTHORIZATION_VERSION, 'sinbad-rollout-recovery-deployment-authorization/5D-v1');
  const value = authorization.readinessSnapshot(result());
  assert.equal(Object.getPrototypeOf(value), null);
  assert.ok(Object.isFrozen(value));
  assert.deepEqual(Object.keys(value), authorization.READINESS_FIELDS);
});

test('readiness result accessors fail closed without invocation', async () => {
  for (const name of authorization.READINESS_FIELDS) {
    const response = result();
    let calls = 0;
    Object.defineProperty(response, name, { get() { calls++; throw new Error('must not run'); } });
    const value = authorization.create(options(async () => response));
    assert.equal((await value.issue({})).reasonCode, 'DEPLOYMENT_READINESS_CONTRACT_INVALID');
    assert.equal(calls, 0, name);
  }
});

test('descriptor traps and inherited result fields fail closed', async () => {
  for (const response of [Object.create(result()), new Proxy(result(), { getOwnPropertyDescriptor() { throw new Error('host failure'); } })]) {
    const value = authorization.create(options(async () => response));
    assert.equal((await value.issue({})).reasonCode, 'DEPLOYMENT_READINESS_CONTRACT_INVALID');
  }
});

test('object reason codes never invoke coercion hooks', async () => {
  let calls = 0;
  const malicious = { toString() { calls++; throw new Error('must not run'); }, valueOf() { calls++; throw new Error('must not run'); }, [Symbol.toPrimitive]() { calls++; throw new Error('must not run'); } };
  const response = { ...result(), status: 'ROLLOUT_RECOVERY_DEPLOYMENT_BLOCKED', reasonCode: malicious };
  const value = authorization.create(options(async () => response));
  assert.equal((await value.issue({})).reasonCode, 'DEPLOYMENT_NOT_READY');
  assert.equal(calls, 0);
});
