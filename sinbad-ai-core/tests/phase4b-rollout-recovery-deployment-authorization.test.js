'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const moduleUnderTest = require('../../tools/trusted-rollout-recovery-deployment-authorization.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

const commit = 'a'.repeat(40);
let time;
const ready = (overrides = {}) => ({ READINESS_VERSION: readiness.READINESS_VERSION, verify: async () => ({ version: readiness.READINESS_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_READY', reasonCode: null, commit, eventCount: 2, pageCount: 2, watermarkId: 4 }), ...overrides });
const options = (overrides = {}) => ({ deploymentReadiness: ready(), deploy: async () => 'APPLIED', now: () => time, deploymentPurpose: 'supabase.rollout-recovery', authorizationTtlMs: 1000, deploymentTimeoutMs: 1000, ...overrides });

test('issues an opaque same-instance authorization and deploys once', async () => {
  time = 1000;
  const value = moduleUnderTest.create(options());
  const authorization = await value.issue(Object.freeze({}));
  assert.equal(authorization.status, 'ROLLOUT_RECOVERY_DEPLOYMENT_AUTHORIZED');
  assert.match(authorization.authorizationHash, /^[a-f0-9]{64}$/u);
  assert.equal('commit' in authorization, false);
  const applied = await value.execute(authorization);
  assert.deepEqual(applied, { version: moduleUnderTest.AUTHORIZATION_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_APPLIED', reasonCode: null, commit });
  assert.equal((await value.execute(authorization)).reasonCode, 'DEPLOYMENT_AUTHORIZATION_DENIED');
});

test('readiness denial and malformed readiness issue no authorization', async () => {
  time = 1000;
  for (const response of [{ status: 'ROLLOUT_RECOVERY_DEPLOYMENT_BLOCKED', reasonCode: 'IDENTITY_DENIED' }, null, { version: readiness.READINESS_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_READY', reasonCode: null, commit, eventCount: 0, pageCount: 1, watermarkId: 4 }]) {
    let deployments = 0;
    const value = moduleUnderTest.create(options({ deploymentReadiness: ready({ verify: async () => response }), deploy: async () => { deployments++; return 'APPLIED'; } }));
    assert.equal((await value.issue({})).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_AUTHORIZATION_BLOCKED');
    assert.equal(deployments, 0);
  }
});

test('copies other instances expiry and clock rollback cannot execute', async () => {
  time = 1000;
  const first = moduleUnderTest.create(options());
  const issued = await first.issue({});
  assert.equal((await first.execute({ ...issued })).reasonCode, 'DEPLOYMENT_AUTHORIZATION_DENIED');
  assert.equal((await moduleUnderTest.create(options()).execute(issued)).reasonCode, 'DEPLOYMENT_AUTHORIZATION_DENIED');
  time = 2000;
  assert.equal((await first.execute(issued)).reasonCode, 'DEPLOYMENT_AUTHORIZATION_DENIED');
  time = 1999;
  assert.equal((await first.execute(issued)).reasonCode, 'DEPLOYMENT_AUTHORIZATION_DENIED');
});

test('deployment timeout exception invalid and rejection consume authorization', async () => {
  const deployers = [async () => new Promise(() => {}), async () => { throw new Error('unknown'); }, async () => 'INVALID', async () => 'REJECTED'];
  for (const deploy of deployers) {
    time = 1000;
    const value = moduleUnderTest.create(options({ deploy, deploymentTimeoutMs: 1000 }));
    const issued = await value.issue({});
    const result = await value.execute(issued);
    assert.notEqual(result.status, 'ROLLOUT_RECOVERY_DEPLOYMENT_APPLIED');
    assert.equal((await value.execute(issued)).reasonCode, 'DEPLOYMENT_AUTHORIZATION_DENIED');
  }
});

test('concurrent execution consumes authorization before the deployment await', async () => {
  time = 1000;
  let finish;
  let deployments = 0;
  const value = moduleUnderTest.create(options({ deploy: async () => { deployments++; return new Promise(resolve => { finish = resolve; }); } }));
  const issued = await value.issue({});
  const first = value.execute(issued);
  await Promise.resolve();
  const second = await value.execute(issued);
  assert.equal(second.reasonCode, 'DEPLOYMENT_AUTHORIZATION_DENIED');
  assert.equal(deployments, 1);
  finish('APPLIED');
  assert.equal((await first).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_APPLIED');
});

test('construction rejects incomplete and unbounded policy', () => {
  assert.throws(() => moduleUnderTest.create(), /required/u);
  for (const changed of [{ deploymentPurpose: '' }, { authorizationTtlMs: 999 }, { deploymentTimeoutMs: 300001 }, { now: null }]) assert.throws(() => moduleUnderTest.create(options(changed)), /required|bounded/u);
});
