'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lifecycle = require('../../tools/trusted-rollout-recovery-deployment-lifecycle-runtime.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

function create() {
  let time = 1000;
  const client = { async rpc(name) {
    if (name === 'begin_rollout_recovery_deployment') return { data: 'BEGUN', error: null };
    if (name === 'settle_rollout_recovery_deployment') return { data: 'SETTLED', error: null };
    if (name === 'inspect_rollout_recovery_deployment') return { data: [{ status: 'UNKNOWN', started_at: '2026-08-13T00:00:00Z', updated_at: '2026-08-13T00:00:01Z' }], error: null };
    if (name === 'verify_rollout_recovery_deployment_reconciliation_audit_access') return { data: true, error: null };
    if (name === 'list_rollout_recovery_deployment_reconciliation_audit') return { data: [], error: null };
    if (name === 'append_rollout_recovery_deployment_reconciliation_audit') return { data: 'RECORDED', error: null };
    throw new Error(`Unexpected RPC: ${name}`);
  } };
  const deploymentReadiness = { READINESS_VERSION: readiness.READINESS_VERSION, verify: async () => ({ version: readiness.READINESS_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_READY', reasonCode: null, commit: 'a'.repeat(40), eventCount: 0, pageCount: 1, watermarkId: null }) };
  const value = lifecycle.create({ client, serviceRole: true, deploymentReadiness, deploy: async () => 'OTHER', deploymentPurpose: 'supabase.rollout-recovery', deploymentTimeoutMs: 1000, resolve: async () => 'PENDING', reconciliationTimeoutMs: 1000, authorize: async () => true, now: () => time, actorHash: 'b'.repeat(64), reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 10000, authorizationTimeoutMs: 1000, auditPageSize: 100, auditMaxEvents: 10000, maxReconciliationAttempts: 2, reconciliationRetryDelayMs: 1000, reconciliationRetryBackoffFactor: 2, maxReconciliationRetryDelayMs: 4000 });
  return { value, setTime: next => { time = next; } };
}

async function delayed(setup) {
  const authorization = await setup.value.issue({});
  await setup.value.execute(authorization);
  const capability = await setup.value.issueReconciliation(authorization);
  await setup.value.reconcile(capability);
  return authorization;
}

test('advertises a side-effect-free inspection contract', () => {
  assert.match(lifecycle.LIFECYCLE_VERSION, /^sinbad-rollout-recovery-deployment-lifecycle-runtime\/(?:4[R-VZ]|5A)-v1$/u);
});

test('future inspection cannot poison a later valid retry decision', async () => {
  const setup = create();
  const authorization = await delayed(setup);
  setup.setTime(5000);
  assert.equal(setup.value.inspect(authorization).phase, 'RETRY_READY');
  setup.setTime(2000);
  assert.equal((await setup.value.issueReconciliation(authorization)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZED');
});

test('invalid observed clock is reported without poisoning recovery', async () => {
  const setup = create();
  const authorization = await delayed(setup);
  setup.setTime(999);
  assert.equal(setup.value.inspect(authorization).phase, 'RETRY_CLOCK_INVALID');
  setup.setTime(2000);
  assert.equal(setup.value.inspect(authorization).phase, 'RETRY_READY');
  assert.equal((await setup.value.issueReconciliation(authorization)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZED');
});
