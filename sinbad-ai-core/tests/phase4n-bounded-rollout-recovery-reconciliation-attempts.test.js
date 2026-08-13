'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lifecycle = require('../../tools/trusted-rollout-recovery-deployment-lifecycle-runtime.js');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');

const deploymentReadiness = { READINESS_VERSION: readiness.READINESS_VERSION, verify: async () => ({ version: readiness.READINESS_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_READY', reasonCode: null, commit: 'a'.repeat(40), eventCount: 0, pageCount: 1, watermarkId: null }) };

function create(overrides = {}) {
  let auditWrites = 0;
  let time = 1000;
  const client = { async rpc(name) {
    if (name === 'begin_rollout_recovery_deployment') return { data: 'BEGUN', error: null };
    if (name === 'settle_rollout_recovery_deployment') return { data: 'SETTLED', error: null };
    if (name === 'inspect_rollout_recovery_deployment') return { data: [{ status: 'UNKNOWN', started_at: '2026-08-13T00:00:00Z', updated_at: '2026-08-13T00:00:01Z' }], error: null };
    if (name === 'verify_rollout_recovery_deployment_reconciliation_audit_access') return { data: true, error: null };
    if (name === 'list_rollout_recovery_deployment_reconciliation_audit') return { data: [], error: null };
    if (name === 'append_rollout_recovery_deployment_reconciliation_audit') { auditWrites++; return { data: 'RECORDED', error: null }; }
    throw new Error(`Unexpected RPC: ${name}`);
  } };
  const value = lifecycle.create({ client, serviceRole: true, deploymentReadiness, deploy: async () => 'OTHER', deploymentPurpose: 'supabase.rollout-recovery', deploymentTimeoutMs: 1000, resolve: async () => 'PENDING', reconciliationTimeoutMs: 1000, authorize: async () => true, now: () => time, actorHash: 'b'.repeat(64), reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 5000, authorizationTimeoutMs: 1000, auditPageSize: 100, auditMaxEvents: 10000, maxReconciliationAttempts: 2, reconciliationRetryDelayMs: 1000, reconciliationRetryBackoffFactor: 2, maxReconciliationRetryDelayMs: 8000, ...overrides });
  return { value, auditWrites: () => auditWrites, advance: () => { time += 1000; } };
}

test('requires and advertises an exact bounded attempt policy', () => {
  assert.match(lifecycle.LIFECYCLE_VERSION, /^sinbad-rollout-recovery-deployment-lifecycle-runtime\/4[N-V]-v1$/u);
  for (const maxReconciliationAttempts of [undefined, 0, 11, 1.5]) assert.throws(() => create({ maxReconciliationAttempts }), /attempt policy/u);
});

test('exhausts sequential nonterminal attempts before new audit or operator work', async () => {
  let authorizations = 0;
  const setup = create({ authorize: async () => { authorizations++; return true; } });
  const deployment = await setup.value.issue({});
  await setup.value.execute(deployment);
  for (let attempt = 0; attempt < 2; attempt++) {
    const capability = await setup.value.issueReconciliation(deployment);
    assert.equal(capability.status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZED');
    assert.equal((await setup.value.reconcile(capability)).reasonCode, 'PROVIDER_PENDING');
    setup.advance();
  }
  const writes = setup.auditWrites();
  const exhausted = setup.value.inspect(deployment);
  assert.equal(exhausted.phase, 'RETRY_EXHAUSTED');
  assert.equal(exhausted.retryAfterMs, null);
  assert.equal((await setup.value.issueReconciliation(deployment)).reasonCode, 'RECONCILIATION_RETRY_EXHAUSTED');
  assert.equal(setup.auditWrites(), writes);
  assert.equal(authorizations, 2);
});

test('failed authorization does not consume the attempt budget', async () => {
  let approved = false;
  const setup = create({ maxReconciliationAttempts: 1, authorize: async () => approved });
  const deployment = await setup.value.issue({});
  await setup.value.execute(deployment);
  assert.equal((await setup.value.issueReconciliation(deployment)).reasonCode, 'OPERATOR_AUTHORIZATION_DENIED');
  approved = true;
  assert.equal((await setup.value.issueReconciliation(deployment)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZED');
});
