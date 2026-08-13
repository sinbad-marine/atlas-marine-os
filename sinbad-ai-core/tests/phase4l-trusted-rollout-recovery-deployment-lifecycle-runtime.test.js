'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lifecycle = require('../../tools/trusted-rollout-recovery-deployment-lifecycle-runtime.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

const commit = 'a'.repeat(40);
const deploymentReadiness = { READINESS_VERSION: readiness.READINESS_VERSION, verify: async () => ({ version: readiness.READINESS_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_READY', reasonCode: null, commit, eventCount: 0, pageCount: 1, watermarkId: null }) };

function create(overrides = {}) {
  const calls = [];
  const client = { async rpc(name, args) {
    calls.push([name, args]);
    if (name === 'begin_rollout_recovery_deployment') return { data: 'BEGUN', error: null };
    if (name === 'settle_rollout_recovery_deployment') return { data: 'SETTLED', error: null };
    if (name === 'inspect_rollout_recovery_deployment') return { data: [{ status: 'UNKNOWN', started_at: '2026-08-13T00:00:00Z', updated_at: '2026-08-13T00:00:01Z' }], error: null };
    if (name === 'verify_rollout_recovery_deployment_reconciliation_audit_access') return { data: true, error: null };
    if (name === 'list_rollout_recovery_deployment_reconciliation_audit') return { data: [], error: null };
    if (name === 'append_rollout_recovery_deployment_reconciliation_audit') return { data: 'RECORDED', error: null };
    throw new Error(`Unexpected RPC: ${name}`);
  } };
  const value = lifecycle.create({ client, serviceRole: true, deploymentReadiness, deploy: async () => 'OTHER', deploymentPurpose: 'supabase.rollout-recovery', deploymentTimeoutMs: 1000, resolve: async () => 'APPLIED', reconciliationTimeoutMs: 1000, authorize: async () => true, now: () => 1000, actorHash: 'b'.repeat(64), reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 1000, authorizationTimeoutMs: 1000, auditPageSize: 100, auditMaxEvents: 10000, ...overrides });
  return { value, calls };
}

test('exposes one frozen lifecycle from deployment through reconciliation', async () => {
  const { value } = create();
  assert.deepEqual(Object.keys(value), ['version', 'preflight', 'issue', 'execute', 'issueReconciliation', 'reconcile']);
  assert.ok(Object.isFrozen(value));
  assert.equal((await value.preflight()).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_RUNTIME_READY');
});

test('reconciles only an exact same-instance unsettled deployment', async () => {
  const { value, calls } = create();
  const authorization = await value.issue({ commit });
  assert.equal((await value.execute(authorization)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_UNSETTLED');
  const capability = await value.issueReconciliation(authorization);
  assert.equal(capability.status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZED');
  assert.equal((await value.reconcile(capability)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_APPLIED');
  assert.ok(calls.some(([name, args]) => name === 'settle_rollout_recovery_deployment' && args.p_expected_status === 'UNKNOWN' && args.p_status === 'APPLIED'));
});

test('copy unexecuted terminal and replayed deployment sources cannot request reconciliation', async () => {
  const { value } = create();
  const unexecuted = await value.issue({});
  assert.equal((await value.issueReconciliation(unexecuted)).reasonCode, 'RECONCILIATION_SOURCE_DENIED');
  assert.equal((await value.issueReconciliation({ ...unexecuted })).reasonCode, 'RECONCILIATION_SOURCE_DENIED');

  const terminal = create({ deploy: async () => 'APPLIED' }).value;
  const applied = await terminal.issue({});
  assert.equal((await terminal.execute(applied)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_APPLIED');
  assert.equal((await terminal.issueReconciliation(applied)).reasonCode, 'RECONCILIATION_SOURCE_DENIED');

  assert.equal((await value.execute(unexecuted)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_UNSETTLED');
  assert.equal((await value.issueReconciliation(unexecuted)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZED');
  assert.equal((await value.issueReconciliation(unexecuted)).reasonCode, 'RECONCILIATION_SOURCE_DENIED');
});

test('blocked reconciliation authorization may be retried after audit recovery', async () => {
  let capability = false;
  const value = create({ client: { async rpc(name) {
    if (name === 'verify_rollout_recovery_deployment_reconciliation_audit_access') return { data: capability, error: null };
    if (name === 'list_rollout_recovery_deployment_reconciliation_audit') return { data: [], error: null };
    if (name === 'append_rollout_recovery_deployment_reconciliation_audit') return { data: 'RECORDED', error: null };
    if (name === 'begin_rollout_recovery_deployment') return { data: 'BEGUN', error: null };
    if (name === 'settle_rollout_recovery_deployment') return { data: 'SETTLED', error: null };
    throw new Error(`Unexpected RPC: ${name}`);
  } } }).value;
  const authorization = await value.issue({});
  await value.execute(authorization);
  const blocked = await value.issueReconciliation(authorization);
  capability = true;
  const authorized = await value.issueReconciliation(authorization);
  assert.equal(blocked.reasonCode, 'AUDIT_CAPABILITY_DENIED');
  assert.equal(authorized.status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZED');
});

test('concurrent rejected execution cannot overwrite the owning unsettled outcome', async () => {
  let finish;
  let started;
  const entered = new Promise(resolve => { started = resolve; });
  const { value } = create({ deploy: async () => { started(); return new Promise(resolve => { finish = resolve; }); } });
  const authorization = await value.issue({});
  const first = value.execute(authorization);
  await entered;
  assert.equal((await value.execute(authorization)).reasonCode, 'DEPLOYMENT_AUTHORIZATION_DENIED');
  finish('OTHER');
  assert.equal((await first).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_UNSETTLED');
  assert.equal((await value.issueReconciliation(authorization)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZED');
});

test('requires the server trust boundary and remains outside package exports', () => {
  assert.throws(() => lifecycle.create(), /service-role/u);
  assert.equal(require('../package.json').exports['./trusted-rollout-recovery-deployment-lifecycle-runtime'], undefined);
});
