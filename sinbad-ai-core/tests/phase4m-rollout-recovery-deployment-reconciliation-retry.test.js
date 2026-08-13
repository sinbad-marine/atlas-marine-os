'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lifecycle = require('../../tools/trusted-rollout-recovery-deployment-lifecycle-runtime.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

const deploymentReadiness = { READINESS_VERSION: readiness.READINESS_VERSION, verify: async () => ({ version: readiness.READINESS_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_READY', reasonCode: null, commit: 'a'.repeat(40), eventCount: 0, pageCount: 1, watermarkId: null }) };

function create(resolve) {
  const client = { async rpc(name) {
    if (name === 'begin_rollout_recovery_deployment') return { data: 'BEGUN', error: null };
    if (name === 'settle_rollout_recovery_deployment') return { data: 'SETTLED', error: null };
    if (name === 'inspect_rollout_recovery_deployment') return { data: [{ status: 'UNKNOWN', started_at: '2026-08-13T00:00:00Z', updated_at: '2026-08-13T00:00:01Z' }], error: null };
    if (name === 'verify_rollout_recovery_deployment_reconciliation_audit_access') return { data: true, error: null };
    if (name === 'list_rollout_recovery_deployment_reconciliation_audit') return { data: [], error: null };
    if (name === 'append_rollout_recovery_deployment_reconciliation_audit') return { data: 'RECORDED', error: null };
    throw new Error(`Unexpected RPC: ${name}`);
  } };
  return lifecycle.create({ client, serviceRole: true, deploymentReadiness, deploy: async () => 'OTHER', deploymentPurpose: 'supabase.rollout-recovery', deploymentTimeoutMs: 1000, resolve, reconciliationTimeoutMs: 1000, authorize: async () => true, now: () => 1000, actorHash: 'b'.repeat(64), reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 1000, authorizationTimeoutMs: 1000, auditPageSize: 100, auditMaxEvents: 10000 });
}

async function unsettled(value) {
  const authorization = await value.issue({});
  assert.equal((await value.execute(authorization)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_UNSETTLED');
  return authorization;
}

test('advertises the Phase 4M retry lifecycle contract', () => {
  assert.equal(lifecycle.LIFECYCLE_VERSION, 'sinbad-rollout-recovery-deployment-lifecycle-runtime/4M-v1');
});

test('nonterminal provider outcome reopens one fresh authorized retry', async () => {
  let resolutions = 0;
  const value = create(async () => ++resolutions === 1 ? 'PENDING' : 'APPLIED');
  const authorization = await unsettled(value);
  const firstCapability = await value.issueReconciliation(authorization);
  assert.equal((await value.reconcile(firstCapability)).reasonCode, 'PROVIDER_PENDING');
  const secondCapability = await value.issueReconciliation(authorization);
  assert.notEqual(secondCapability, firstCapability);
  assert.equal((await value.reconcile(secondCapability)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_APPLIED');
  assert.equal((await value.issueReconciliation(authorization)).reasonCode, 'RECONCILIATION_SOURCE_DENIED');
});

test('concurrent capability replay cannot overwrite the owning retry decision', async () => {
  let finish;
  let started;
  const entered = new Promise(resolve => { started = resolve; });
  const value = create(async () => { started(); return new Promise(resolve => { finish = resolve; }); });
  const authorization = await unsettled(value);
  const capability = await value.issueReconciliation(authorization);
  const first = value.reconcile(capability);
  await entered;
  assert.equal((await value.reconcile(capability)).reasonCode, 'RECONCILIATION_AUTHORIZATION_DENIED');
  finish('PENDING');
  assert.equal((await first).reasonCode, 'PROVIDER_PENDING');
  assert.equal((await value.issueReconciliation(authorization)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZED');
});
