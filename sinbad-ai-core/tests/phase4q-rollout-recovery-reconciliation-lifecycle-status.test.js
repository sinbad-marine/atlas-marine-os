'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lifecycle = require('../../tools/trusted-rollout-recovery-deployment-lifecycle-runtime.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

function create() {
  let time = 1000, rpcCalls = 0, finish;
  let started;
  const entered = new Promise(resolve => { started = resolve; });
  const client = { async rpc(name) {
    rpcCalls++;
    if (name === 'begin_rollout_recovery_deployment') return { data: 'BEGUN', error: null };
    if (name === 'settle_rollout_recovery_deployment') return { data: 'SETTLED', error: null };
    if (name === 'inspect_rollout_recovery_deployment') return { data: [{ status: 'UNKNOWN', started_at: '2026-08-13T00:00:00Z', updated_at: '2026-08-13T00:00:01Z' }], error: null };
    if (name === 'verify_rollout_recovery_deployment_reconciliation_audit_access') return { data: true, error: null };
    if (name === 'list_rollout_recovery_deployment_reconciliation_audit') return { data: [], error: null };
    if (name === 'append_rollout_recovery_deployment_reconciliation_audit') return { data: 'RECORDED', error: null };
    throw new Error(`Unexpected RPC: ${name}`);
  } };
  const deploymentReadiness = { READINESS_VERSION: readiness.READINESS_VERSION, verify: async () => ({ version: readiness.READINESS_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_READY', reasonCode: null, commit: 'a'.repeat(40), eventCount: 0, pageCount: 1, watermarkId: null }) };
  const value = lifecycle.create({ client, serviceRole: true, deploymentReadiness, deploy: async () => 'OTHER', deploymentPurpose: 'supabase.rollout-recovery', deploymentTimeoutMs: 1000, resolve: async () => { started(); return new Promise(resolve => { finish = resolve; }); }, reconciliationTimeoutMs: 1000, authorize: async () => true, now: () => time, actorHash: 'b'.repeat(64), reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 10000, authorizationTimeoutMs: 1000, auditPageSize: 100, auditMaxEvents: 10000, maxReconciliationAttempts: 2, reconciliationRetryDelayMs: 1000, reconciliationRetryBackoffFactor: 2, maxReconciliationRetryDelayMs: 4000 });
  return { value, entered, calls: () => rpcCalls, setTime: next => { time = next; }, finish: result => finish(result) };
}

test('exposes immutable content-free same-instance state without RPC work', async () => {
  assert.match(lifecycle.LIFECYCLE_VERSION, /^sinbad-rollout-recovery-deployment-lifecycle-runtime\/4[Q-U]-v1$/u);
  const setup = create();
  assert.equal(setup.value.inspect({}).phase, 'SOURCE_DENIED');
  const authorization = await setup.value.issue({});
  const calls = setup.calls();
  const state = setup.value.inspect(authorization);
  assert.deepEqual(state, { version: lifecycle.LIFECYCLE_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_LIFECYCLE_STATE', phase: 'EXECUTION_REQUIRED', attemptsUsed: 0, attemptsRemaining: 2, retryNotBefore: null });
  assert.ok(Object.isFrozen(state));
  assert.equal(setup.calls(), calls);
  for (const secret of ['authorizationHash', 'commit', 'actorHash', 'purpose']) assert.equal(secret in state, false);
});

test('reports authorized running delayed ready and closed transitions', async () => {
  const setup = create();
  const authorization = await setup.value.issue({});
  await setup.value.execute(authorization);
  assert.equal(setup.value.inspect(authorization).phase, 'RETRY_READY');
  const capability = await setup.value.issueReconciliation(authorization);
  assert.equal(setup.value.inspect(authorization).phase, 'RECONCILIATION_AUTHORIZED');
  const reconciliation = setup.value.reconcile(capability);
  await setup.entered;
  assert.equal(setup.value.inspect(authorization).phase, 'RECONCILIATION_IN_PROGRESS');
  setup.finish('PENDING');
  await reconciliation;
  const delayed = setup.value.inspect(authorization);
  assert.equal(delayed.phase, 'RETRY_DELAY_ACTIVE');
  assert.equal(delayed.retryNotBefore, 2000);
  setup.setTime(2000);
  assert.equal(setup.value.inspect(authorization).phase, 'RETRY_READY');
});

test('terminal reconciliation closes state and inspection never reopens it', async () => {
  const setup = create();
  const authorization = await setup.value.issue({});
  await setup.value.execute(authorization);
  const capability = await setup.value.issueReconciliation(authorization);
  const reconciliation = setup.value.reconcile(capability);
  await setup.entered;
  setup.finish('APPLIED');
  await reconciliation;
  const calls = setup.calls();
  assert.equal(setup.value.inspect(authorization).phase, 'CLOSED');
  assert.equal(setup.value.inspect({ ...authorization }).phase, 'SOURCE_DENIED');
  assert.equal(setup.calls(), calls);
});
