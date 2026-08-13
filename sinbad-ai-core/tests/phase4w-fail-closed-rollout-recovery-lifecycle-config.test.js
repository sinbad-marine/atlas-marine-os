'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const configModule = require('../../tools/create-rollout-recovery-deployment-lifecycle-from-env.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

const names = configModule.NAMES;
function env(overrides = {}) { return { [names.actorHash]: 'a'.repeat(64), [names.deploymentPurpose]: 'supabase.rollout-recovery', [names.reconciliationPurpose]: 'deployment.reconciliation', [names.authorizationTtlMs]: '5000', [names.deploymentTimeoutMs]: '1000', [names.reconciliationTimeoutMs]: '1000', [names.authorizationTimeoutMs]: '1000', [names.auditPageSize]: '100', [names.auditMaxEvents]: '10000', [names.maxReconciliationAttempts]: '3', [names.reconciliationRetryDelayMs]: '1000', [names.reconciliationRetryBackoffFactor]: '2', [names.maxReconciliationRetryDelayMs]: '8000', ...overrides }; }

test('parses an exact frozen content-minimized canonical policy', () => {
  const value = configModule.parse(env());
  assert.equal(value.version, configModule.CONFIG_VERSION);
  assert.equal(value.authorizationTtlMs, 5000);
  assert.equal(value.maxReconciliationAttempts, 3);
  assert.ok(Object.isFrozen(value));
  assert.equal('client' in value, false);
  assert.equal('serviceRole' in value, false);
});

test('missing malformed whitespace decimal and unsafe values fail closed', () => {
  for (const [name, value] of [[names.actorHash, undefined], [names.actorHash, 'A'.repeat(64)], [names.deploymentPurpose, 'bad purpose'], [names.authorizationTtlMs, ' 5000'], [names.authorizationTtlMs, '5e3'], [names.authorizationTtlMs, '5000.0'], [names.authorizationTtlMs, '-1'], [names.authorizationTtlMs, '9007199254740992']]) {
    const input = env({ [name]: value });
    if (value === undefined) delete input[name];
    assert.throws(() => configModule.parse(input), /configuration|Configuration/u);
  }
});

test('creates the server-only lifecycle only with explicit trusted dependencies', () => {
  const client = { rpc: async () => ({ data: null, error: {} }) };
  const deploymentReadiness = { READINESS_VERSION: readiness.READINESS_VERSION, verify: async () => null };
  const options = { env: env(), client, serviceRole: true, deploymentReadiness, deploy: async () => 'OTHER', resolve: async () => 'PENDING', authorize: async () => false, now: () => 1000 };
  const value = configModule.create(options);
  assert.deepEqual(Object.keys(value), ['version', 'preflight', 'issue', 'execute', 'issueReconciliation', 'reconcile', 'inspect']);
  assert.ok(Object.isFrozen(value));
  assert.throws(() => configModule.create({ ...options, serviceRole: false }), /trusted lifecycle dependencies/u);
  assert.throws(() => configModule.create({ ...options, env: null }), /environment/u);
});

test('delegates policy bounds to the exact lifecycle constructor', () => {
  const client = { rpc: async () => ({ data: null, error: {} }) };
  const deploymentReadiness = { READINESS_VERSION: readiness.READINESS_VERSION, verify: async () => null };
  const base = { client, serviceRole: true, deploymentReadiness, deploy: async () => 'OTHER', resolve: async () => 'PENDING', authorize: async () => false, now: () => 1000 };
  for (const [name, value] of [[names.maxReconciliationAttempts, '11'], [names.reconciliationRetryDelayMs, '999'], [names.reconciliationRetryBackoffFactor, '5'], [names.maxReconciliationRetryDelayMs, '999']]) assert.throws(() => configModule.create({ ...base, env: env({ [name]: value }) }), /policy|delay/u);
});

test('configuration composition remains outside browser package exports', () => {
  assert.equal(require('../package.json').exports['./rollout-recovery-deployment-lifecycle-config'], undefined);
});
