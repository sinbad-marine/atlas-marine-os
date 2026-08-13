'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('../../tools/trusted-rollout-recovery-journaled-deployment.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

const commit = 'a'.repeat(40);
let time;
const deploymentReadiness = { READINESS_VERSION: readiness.READINESS_VERSION, verify: async () => ({ version: readiness.READINESS_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_READY', reasonCode: null, commit, eventCount: 2, pageCount: 2, watermarkId: 4 }) };
function journal(begin = 'BEGUN', settle = 'SETTLED', calls = []) {
  return { version: runtime.JOURNAL_VERSION, durable: true, async begin(hash) { calls.push(['begin', hash]); return { status: begin }; }, async settle(hash, expected, state) { calls.push(['settle', hash, expected, state]); return { status: settle }; } };
}
const options = (overrides = {}) => ({ deploymentReadiness, deploymentJournal: journal(), deploy: async () => 'APPLIED', now: () => time, deploymentPurpose: 'supabase.rollout-recovery', authorizationTtlMs: 1000, deploymentTimeoutMs: 1000, ...overrides });

test('durably begins before deployment and settles an applied result', async () => {
  time = 1000;
  const calls = [];
  const value = runtime.create(options({ deploymentJournal: journal('BEGUN', 'SETTLED', calls), deploy: async request => { calls.push(['deploy', request.authorizationHash]); return 'APPLIED'; } }));
  const issued = await value.issue({});
  const result = await value.execute(issued);
  assert.equal(result.status, 'ROLLOUT_RECOVERY_DEPLOYMENT_APPLIED');
  assert.deepEqual(calls.map(call => call[0]), ['begin', 'deploy', 'settle']);
  assert.equal(calls[0][1], calls[1][1]);
  assert.deepEqual(calls[2].slice(2), ['PENDING', 'APPLIED']);
});

test('begin denial outage and existing record block before provider deployment', async () => {
  for (const begin of ['EXISTS', 'DENIED', 'UNAVAILABLE']) {
    time = 1000;
    let deployments = 0;
    const value = runtime.create(options({ deploymentJournal: journal(begin), deploy: async () => { deployments++; return 'APPLIED'; } }));
    const result = await value.execute(await value.issue({}));
    assert.equal(result.status, 'ROLLOUT_RECOVERY_DEPLOYMENT_UNSETTLED');
    assert.equal(deployments, 0);
  }
});

test('provider exception and malformed result settle unknown and never report success', async () => {
  for (const deploy of [async () => { throw new Error('lost'); }, async () => 'OTHER']) {
    time = 1000;
    const calls = [];
    const value = runtime.create(options({ deploymentJournal: journal('BEGUN', 'SETTLED', calls), deploy }));
    const result = await value.execute(await value.issue({}));
    assert.equal(result.status, 'ROLLOUT_RECOVERY_DEPLOYMENT_UNSETTLED');
    assert.deepEqual(calls.at(-1).slice(2), ['PENDING', 'UNKNOWN']);
  }
});

test('settlement failure cannot turn a provider result into success', async () => {
  for (const settle of ['CONFLICT', 'DENIED', 'UNAVAILABLE']) {
    time = 1000;
    const value = runtime.create(options({ deploymentJournal: journal('BEGUN', settle) }));
    assert.equal((await value.execute(await value.issue({}))).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_UNSETTLED');
  }
});

test('requires exact durable journal and exposes a frozen minimal runtime', () => {
  assert.throws(() => runtime.create(options({ deploymentJournal: null })), /journal/u);
  assert.throws(() => runtime.create(options({ deploymentJournal: { ...journal(), durable: false } })), /journal/u);
  time = 1000;
  const value = runtime.create(options());
  assert.deepEqual(Object.keys(value), ['version', 'issue', 'execute']);
  assert.ok(Object.isFrozen(value));
});
