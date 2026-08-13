'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lifecycle = require('../../tools/trusted-rollout-recovery-deployment-lifecycle-runtime.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

function create() {
  let clock = 1000;
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
  const now = () => { if (clock instanceof Error) throw clock; return clock; };
  const value = lifecycle.create({ client, serviceRole: true, deploymentReadiness, deploy: async () => 'OTHER', deploymentPurpose: 'supabase.rollout-recovery', deploymentTimeoutMs: 1000, resolve: async () => 'PENDING', reconciliationTimeoutMs: 1000, authorize: async () => true, now, actorHash: 'b'.repeat(64), reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 10000, authorizationTimeoutMs: 1000, auditPageSize: 100, auditMaxEvents: 10000, maxReconciliationAttempts: 2, reconciliationRetryDelayMs: 1000, reconciliationRetryBackoffFactor: 2, maxReconciliationRetryDelayMs: 4000 });
  return { value, setClock: next => { clock = next; } };
}

async function delayed(setup) {
  const authorization = await setup.value.issue({});
  await setup.value.execute(authorization);
  const capability = await setup.value.issueReconciliation(authorization);
  await setup.value.reconcile(capability);
  return authorization;
}

test('advertises an exception-safe lifecycle clock contract', () => {
  assert.equal(lifecycle.LIFECYCLE_VERSION, 'sinbad-rollout-recovery-deployment-lifecycle-runtime/4S-v1');
});

test('throwing and unconvertible clocks fail closed without escaping', async () => {
  for (const invalid of [new Error('clock offline'), Symbol('clock')]) {
    const setup = create();
    const authorization = await delayed(setup);
    setup.setClock(invalid);
    assert.equal(setup.value.inspect(authorization).phase, 'RETRY_CLOCK_INVALID');
    assert.equal((await setup.value.issueReconciliation(authorization)).reasonCode, 'RECONCILIATION_RETRY_CLOCK_INVALID');
    setup.setClock(2000);
    assert.equal((await setup.value.issueReconciliation(authorization)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZED');
  }
});
