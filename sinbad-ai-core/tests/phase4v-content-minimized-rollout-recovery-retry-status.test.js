'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lifecycle = require('../../tools/trusted-rollout-recovery-deployment-lifecycle-runtime.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

test('reports only bounded relative retry time without absolute server clock disclosure', async () => {
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
  const value = lifecycle.create({ client, serviceRole: true, deploymentReadiness, deploy: async () => 'OTHER', deploymentPurpose: 'supabase.rollout-recovery', deploymentTimeoutMs: 1000, resolve: async () => 'PENDING', reconciliationTimeoutMs: 1000, authorize: async () => true, now: () => time, actorHash: 'b'.repeat(64), reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 10000, authorizationTimeoutMs: 1000, auditPageSize: 100, auditMaxEvents: 10000, maxReconciliationAttempts: 2, reconciliationRetryDelayMs: 2000, reconciliationRetryBackoffFactor: 2, maxReconciliationRetryDelayMs: 4000 });
  const deployment = await value.issue({});
  await value.execute(deployment);
  const capability = await value.issueReconciliation(deployment);
  await value.reconcile(capability);
  const first = value.inspect(deployment);
  assert.match(lifecycle.LIFECYCLE_VERSION, /^sinbad-rollout-recovery-deployment-lifecycle-runtime\/(?:4[VZ]|5A)-v1$/u);
  assert.equal(first.phase, 'RETRY_DELAY_ACTIVE');
  assert.equal(first.retryAfterMs, 2000);
  assert.equal('retryNotBefore' in first, false);
  time = 2500;
  assert.equal(value.inspect(deployment).retryAfterMs, 500);
  time = 3000;
  assert.equal(value.inspect(deployment).retryAfterMs, 0);
  assert.equal(value.inspect(deployment).phase, 'RETRY_READY');
});
