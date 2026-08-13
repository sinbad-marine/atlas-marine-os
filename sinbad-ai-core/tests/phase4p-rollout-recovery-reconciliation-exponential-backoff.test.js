'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lifecycle = require('../../tools/trusted-rollout-recovery-deployment-lifecycle-runtime.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

function create(overrides = {}) {
  let time = 1000, auditWrites = 0;
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
  const value = lifecycle.create({ client, serviceRole: true, deploymentReadiness, deploy: async () => 'OTHER', deploymentPurpose: 'supabase.rollout-recovery', deploymentTimeoutMs: 1000, resolve: async () => 'PENDING', reconciliationTimeoutMs: 1000, authorize: async () => true, now: () => time, actorHash: 'b'.repeat(64), reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 20000, authorizationTimeoutMs: 1000, auditPageSize: 100, auditMaxEvents: 10000, maxReconciliationAttempts: 4, reconciliationRetryDelayMs: 1000, reconciliationRetryBackoffFactor: 2, maxReconciliationRetryDelayMs: 2500, ...overrides });
  return { value, setTime: next => { time = next; }, auditWrites: () => auditWrites };
}

test('requires and advertises the bounded exponential backoff contract', () => {
  assert.match(lifecycle.LIFECYCLE_VERSION, /^sinbad-rollout-recovery-deployment-lifecycle-runtime\/(?:4[P-VZ]|5[AB])-v1$/u);
  for (const changed of [{ reconciliationRetryBackoffFactor: 1 }, { reconciliationRetryBackoffFactor: 5 }, { maxReconciliationRetryDelayMs: 999 }, { maxReconciliationRetryDelayMs: 300001 }]) assert.throws(() => create(changed), /backoff policy/u);
});

test('grows delay per authorized attempt and caps it deterministically', async () => {
  const setup = create();
  const deployment = await setup.value.issue({});
  await setup.value.execute(deployment);
  const boundaries = [2000, 4000, 6500];
  for (const boundary of boundaries) {
    const capability = await setup.value.issueReconciliation(deployment);
    await setup.value.reconcile(capability);
    setup.setTime(boundary - 1);
    const writes = setup.auditWrites();
    assert.equal((await setup.value.issueReconciliation(deployment)).reasonCode, 'RECONCILIATION_RETRY_DELAY_ACTIVE');
    assert.equal(setup.auditWrites(), writes);
    setup.setTime(boundary);
  }
  assert.equal((await setup.value.issueReconciliation(deployment)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZED');
});
