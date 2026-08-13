'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lifecycle = require('../../tools/trusted-rollout-recovery-deployment-lifecycle-runtime.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

function create() {
  let time = 1000, auditWrites = 0, authorizations = 0;
  const client = { async rpc(name) {
    if (name === 'begin_rollout_recovery_deployment') return { data: 'BEGUN', error: null };
    if (name === 'settle_rollout_recovery_deployment') return { data: 'SETTLED', error: null };
    if (name === 'inspect_rollout_recovery_deployment') return { data: [{ status: 'UNKNOWN', started_at: '2026-08-13T00:00:00Z', updated_at: '2026-08-13T00:00:01Z' }], error: null };
    if (name === 'verify_rollout_recovery_deployment_reconciliation_audit_access') return { data: true, error: null };
    if (name === 'list_rollout_recovery_deployment_reconciliation_audit') return { data: [], error: null };
    if (name === 'append_rollout_recovery_deployment_reconciliation_audit') { auditWrites++; return { data: 'RECORDED', error: null }; }
    throw new Error(`Unexpected RPC: ${name}`);
  } };
  const deploymentReadiness = { READINESS_VERSION: readiness.READINESS_VERSION, verify: async () => ({ version: readiness.READINESS_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_READY', reasonCode: null, commit: 'a'.repeat(40), eventCount: 0, pageCount: 1, watermarkId: null }) };
  const value = lifecycle.create({ client, serviceRole: true, deploymentReadiness, deploy: async () => 'OTHER', deploymentPurpose: 'supabase.rollout-recovery', deploymentTimeoutMs: 1000, resolve: async () => 'PENDING', reconciliationTimeoutMs: 1000, authorize: async () => { authorizations++; return true; }, now: () => time, actorHash: 'b'.repeat(64), reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 5000, authorizationTimeoutMs: 1000, auditPageSize: 100, auditMaxEvents: 10000, maxReconciliationAttempts: 3, reconciliationRetryDelayMs: 2000, reconciliationRetryBackoffFactor: 2, maxReconciliationRetryDelayMs: 8000 });
  return { value, setTime: next => { time = next; }, counts: () => [auditWrites, authorizations] };
}

test('requires and advertises the bounded retry delay contract', () => {
  assert.match(lifecycle.LIFECYCLE_VERSION, /^sinbad-rollout-recovery-deployment-lifecycle-runtime\/4[O-R]-v1$/u);
});

test('blocks early retry before audit and operator work then opens at boundary', async () => {
  const setup = create();
  const deployment = await setup.value.issue({});
  await setup.value.execute(deployment);
  const capability = await setup.value.issueReconciliation(deployment);
  await setup.value.reconcile(capability);
  const counts = setup.counts();
  setup.setTime(2999);
  assert.equal((await setup.value.issueReconciliation(deployment)).reasonCode, 'RECONCILIATION_RETRY_DELAY_ACTIVE');
  assert.deepEqual(setup.counts(), counts);
  setup.setTime(3000);
  assert.equal((await setup.value.issueReconciliation(deployment)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZED');
});

test('clock rollback fails closed without audit or operator work', async () => {
  const setup = create();
  const deployment = await setup.value.issue({});
  await setup.value.execute(deployment);
  const capability = await setup.value.issueReconciliation(deployment);
  await setup.value.reconcile(capability);
  setup.setTime(2000);
  assert.equal((await setup.value.issueReconciliation(deployment)).reasonCode, 'RECONCILIATION_RETRY_DELAY_ACTIVE');
  const counts = setup.counts();
  setup.setTime(1999);
  assert.equal((await setup.value.issueReconciliation(deployment)).reasonCode, 'RECONCILIATION_RETRY_CLOCK_INVALID');
  assert.deepEqual(setup.counts(), counts);
});
