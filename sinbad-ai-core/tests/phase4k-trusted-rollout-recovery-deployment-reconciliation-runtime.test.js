'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('../../tools/trusted-rollout-recovery-deployment-reconciliation-runtime.js');

const authorizationHash = 'a'.repeat(64);
const actorHash = 'b'.repeat(64);

function create(overrides = {}) {
  const calls = [];
  const client = { async rpc(name, args) {
    calls.push([name, args]);
    if (name === 'verify_rollout_recovery_deployment_reconciliation_audit_access') return { data: true, error: null };
    if (name === 'list_rollout_recovery_deployment_reconciliation_audit') return { data: [], error: null };
    if (name === 'append_rollout_recovery_deployment_reconciliation_audit') return { data: 'RECORDED', error: null };
    if (name === 'inspect_rollout_recovery_deployment') return { data: [{ status: 'APPLIED', started_at: '2026-08-13T00:00:00Z', updated_at: '2026-08-13T00:00:01Z' }], error: null };
    throw new Error(`Unexpected RPC: ${name}`);
  } };
  const value = runtime.create({ client, serviceRole: true, resolve: async () => 'APPLIED', reconciliationTimeoutMs: 1000, authorize: async () => true, now: () => 1000, actorHash, reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 1000, authorizationTimeoutMs: 1000, auditPageSize: 100, auditMaxEvents: 10000, ...overrides });
  return { value, calls };
}

test('composes an exact frozen minimal runtime and passes audit preflight', async () => {
  const { value } = create();
  assert.deepEqual(Object.keys(value), ['version', 'preflight', 'issue', 'reconcile']);
  assert.ok(Object.isFrozen(value));
  assert.deepEqual(await value.preflight(), { version: runtime.RUNTIME_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_RUNTIME_READY', reasonCode: null });
});

test('issues one-use authorization and reconciles through the durable journal', async () => {
  const { value, calls } = create();
  const capability = await value.issue(authorizationHash);
  assert.equal(capability.status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZED');
  assert.equal((await value.reconcile(capability)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_APPLIED');
  assert.equal((await value.reconcile(capability)).reasonCode, 'RECONCILIATION_AUTHORIZATION_DENIED');
  assert.ok(calls.some(([name]) => name === 'append_rollout_recovery_deployment_reconciliation_audit'));
  assert.ok(calls.some(([name]) => name === 'inspect_rollout_recovery_deployment'));
});

test('audit capability outage blocks preflight and skips operator authorization', async () => {
  let authorizations = 0;
  const client = { async rpc(name) {
    if (name === 'verify_rollout_recovery_deployment_reconciliation_audit_access') return { data: false, error: null };
    if (name === 'append_rollout_recovery_deployment_reconciliation_audit') return { data: 'RECORDED', error: null };
    throw new Error(`Unexpected RPC: ${name}`);
  } };
  const { value } = create({ client, authorize: async () => { authorizations++; return true; } });
  assert.equal((await value.preflight()).reasonCode, 'AUDIT_CAPABILITY_DENIED');
  assert.equal((await value.issue(authorizationHash)).reasonCode, 'AUDIT_CAPABILITY_DENIED');
  assert.equal(authorizations, 0);
});

test('invalid trust boundary and unbounded policy fail at construction', () => {
  assert.throws(() => runtime.create(), /service-role/u);
  assert.throws(() => create({ serviceRole: false }), /service-role/u);
  assert.throws(() => create({ auditPageSize: 0 }), /scan policy/u);
  assert.throws(() => create({ reconciliationTimeoutMs: 999 }), /timeout/u);
  assert.throws(() => create({ reconciliationTimeoutMs: '1000' }), /timeout/u);
  assert.throws(() => create({ reconciliationTimeoutMs: 1000n }), /timeout/u);
});

test('server-only runtime remains outside browser package exports', () => {
  assert.equal(require('../package.json').exports['./trusted-rollout-recovery-deployment-reconciliation-runtime'], undefined);
});
