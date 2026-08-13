'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lifecycle = require('../../tools/trusted-rollout-recovery-deployment-lifecycle-runtime.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

test('last nonterminal attempt exhausts without an additional scheduling clock read or retained deadline', async () => {
  let clockCalls = 0;
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
  const value = lifecycle.create({ client, serviceRole: true, deploymentReadiness, deploy: async () => 'OTHER', deploymentPurpose: 'supabase.rollout-recovery', deploymentTimeoutMs: 1000, resolve: async () => 'PENDING', reconciliationTimeoutMs: 1000, authorize: async () => true, now: () => { clockCalls++; return 1000; }, actorHash: 'b'.repeat(64), reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 5000, authorizationTimeoutMs: 1000, auditPageSize: 100, auditMaxEvents: 10000, maxReconciliationAttempts: 1, reconciliationRetryDelayMs: 1000, reconciliationRetryBackoffFactor: 2, maxReconciliationRetryDelayMs: 4000 });
  const deployment = await value.issue({});
  await value.execute(deployment);
  const capability = await value.issueReconciliation(deployment);
  const before = clockCalls;
  assert.equal((await value.reconcile(capability)).reasonCode, 'PROVIDER_PENDING');
  assert.equal(clockCalls, before + 1);
  assert.deepEqual(value.inspect(deployment), { version: lifecycle.LIFECYCLE_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_LIFECYCLE_STATE', phase: 'RETRY_EXHAUSTED', attemptsUsed: 1, attemptsRemaining: 0, retryAfterMs: null });
  assert.equal((await value.issueReconciliation(deployment)).reasonCode, 'RECONCILIATION_RETRY_EXHAUSTED');
});

test('advertises terminal retry exhaustion semantics', () => {
  assert.match(lifecycle.LIFECYCLE_VERSION, /^sinbad-rollout-recovery-deployment-lifecycle-runtime\/4[UVZ]-v1$/u);
});
