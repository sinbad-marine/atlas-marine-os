'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lifecycle = require('../../tools/trusted-rollout-recovery-deployment-lifecycle-runtime.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

function create() {
  let clock = 1000;
  let blockProvider;
  const providerBlocked = new Promise(resolve => { blockProvider = resolve; });
  let finishProvider;
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
  const value = lifecycle.create({ client, serviceRole: true, deploymentReadiness, deploy: async () => 'OTHER', deploymentPurpose: 'supabase.rollout-recovery', deploymentTimeoutMs: 1000, resolve: async () => { blockProvider(); return new Promise(resolve => { finishProvider = resolve; }); }, reconciliationTimeoutMs: 1000, authorize: async () => true, now, actorHash: 'b'.repeat(64), reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 10000, authorizationTimeoutMs: 1000, auditPageSize: 100, auditMaxEvents: 10000, maxReconciliationAttempts: 2, reconciliationRetryDelayMs: 1000, reconciliationRetryBackoffFactor: 2, maxReconciliationRetryDelayMs: 4000 });
  return { value, providerBlocked, setClock: next => { clock = next; }, finishProvider: result => finishProvider(result) };
}

test('advertises a recoverable retry-clock contract', () => {
  assert.equal(lifecycle.LIFECYCLE_VERSION, 'sinbad-rollout-recovery-deployment-lifecycle-runtime/4T-v1');
});

test('invalid completion clock recovers by starting a full delay at first valid decision sample', async () => {
  const setup = create();
  const authorization = await setup.value.issue({});
  await setup.value.execute(authorization);
  const capability = await setup.value.issueReconciliation(authorization);
  const reconciliation = setup.value.reconcile(capability);
  await setup.providerBlocked;
  setup.setClock(new Error('clock unavailable'));
  setup.finishProvider('PENDING');
  assert.equal((await reconciliation).reasonCode, 'PROVIDER_PENDING');
  assert.equal(setup.value.inspect(authorization).phase, 'RETRY_CLOCK_PENDING');

  setup.setClock(5000);
  assert.equal((await setup.value.issueReconciliation(authorization)).reasonCode, 'RECONCILIATION_RETRY_DELAY_ACTIVE');
  const delayed = setup.value.inspect(authorization);
  assert.equal(delayed.phase, 'RETRY_DELAY_ACTIVE');
  assert.equal(delayed.retryNotBefore, 6000);
  setup.setClock(5999);
  assert.equal((await setup.value.issueReconciliation(authorization)).reasonCode, 'RECONCILIATION_RETRY_DELAY_ACTIVE');
  setup.setClock(6000);
  assert.equal((await setup.value.issueReconciliation(authorization)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZED');
});

test('repeated invalid recovery samples remain fail closed without synthetic deadline', async () => {
  const setup = create();
  const authorization = await setup.value.issue({});
  await setup.value.execute(authorization);
  const capability = await setup.value.issueReconciliation(authorization);
  const reconciliation = setup.value.reconcile(capability);
  await setup.providerBlocked;
  setup.setClock(Symbol('invalid'));
  setup.finishProvider('PENDING');
  await reconciliation;
  for (const invalid of [Symbol('still-invalid'), new Error('offline')]) {
    setup.setClock(invalid);
    assert.equal((await setup.value.issueReconciliation(authorization)).reasonCode, 'RECONCILIATION_RETRY_CLOCK_INVALID');
    const state = setup.value.inspect(authorization);
    assert.equal(state.phase, 'RETRY_CLOCK_PENDING');
    assert.equal(state.retryNotBefore, null);
  }
});

test('overflow recovery stays pending until a safe clock starts the full delay', async () => {
  const setup = create();
  const authorization = await setup.value.issue({});
  await setup.value.execute(authorization);
  const capability = await setup.value.issueReconciliation(authorization);
  const reconciliation = setup.value.reconcile(capability);
  await setup.providerBlocked;
  setup.setClock(new Error('clock unavailable'));
  setup.finishProvider('PENDING');
  await reconciliation;
  setup.setClock(Number.MAX_SAFE_INTEGER);
  assert.equal((await setup.value.issueReconciliation(authorization)).reasonCode, 'RECONCILIATION_RETRY_CLOCK_INVALID');
  assert.equal(setup.value.inspect(authorization).phase, 'RETRY_CLOCK_PENDING');
  setup.setClock(5000);
  assert.equal((await setup.value.issueReconciliation(authorization)).reasonCode, 'RECONCILIATION_RETRY_DELAY_ACTIVE');
  assert.equal(setup.value.inspect(authorization).retryNotBefore, 6000);
});
