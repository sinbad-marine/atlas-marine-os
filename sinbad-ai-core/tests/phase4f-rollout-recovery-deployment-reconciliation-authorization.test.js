'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const authorization = require('../../tools/trusted-rollout-recovery-deployment-reconciliation-authorization.js');
const reconciliation = require('../../tools/trusted-rollout-recovery-deployment-reconciliation.js');
const audit = require('../../tools/trusted-rollout-recovery-deployment-reconciliation-audit.js');
const readiness = require('../../tools/rollout-recovery-deployment-reconciliation-audit-readiness.js');

const hash = 'a'.repeat(64);
let time;
const journal = (overrides = {}) => ({ version: reconciliation.EXPECTED_JOURNAL_VERSION, durable: true, inspect: async () => ({ status: 'FOUND', state: { status: 'APPLIED' } }), settle: async () => ({ status: 'SETTLED' }), ...overrides });
const authorizationAudit = (overrides = {}) => ({ version: audit.AUDIT_VERSION, durable: true, record: async () => ({ status: 'RECORDED', eventHash: 'd'.repeat(64) }), ...overrides });
const auditReadiness = (overrides = {}) => ({ version: readiness.READINESS_VERSION, check: async () => ({ version: readiness.READINESS_VERSION, status: 'RECONCILIATION_AUDIT_READINESS_READY', reasonCode: null, eventCount: 0, pageCount: 1, watermarkId: null }), ...overrides });
const options = (overrides = {}) => ({ deploymentJournal: journal(), resolve: async () => 'APPLIED', reconciliationTimeoutMs: 1000, authorize: async () => true, authorizationAudit: authorizationAudit(), auditReadiness: auditReadiness(), now: () => time, actorHash: 'b'.repeat(64), reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 1000, authorizationTimeoutMs: 1000, ...overrides });

test('issues an opaque authorization and reconciles exactly once', async () => {
  time = 1000;
  const value = authorization.create(options());
  const capability = await value.issue(hash);
  assert.equal(capability.status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZED');
  assert.equal('authorizationHash' in capability, false);
  assert.equal((await value.reconcile(capability)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_APPLIED');
  assert.equal((await value.reconcile(capability)).reasonCode, 'RECONCILIATION_AUTHORIZATION_DENIED');
});

test('denial non-boolean timeout exception and invalid hash issue no capability', async () => {
  time = 1000;
  for (const authorize of [async () => false, async () => 'true', async () => { throw new Error('denied'); }, async () => new Promise(() => {})]) {
    const value = authorization.create(options({ authorize }));
    assert.equal((await value.issue(hash)).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZATION_BLOCKED');
  }
  assert.equal((await authorization.create(options()).issue('bad')).reasonCode, 'AUTHORIZATION_HASH_INVALID');
});

test('copies other instances expiry and clock rollback fail closed', async () => {
  time = 1000;
  const first = authorization.create(options());
  const capability = await first.issue(hash);
  assert.equal((await first.reconcile({ ...capability })).reasonCode, 'RECONCILIATION_AUTHORIZATION_DENIED');
  assert.equal((await authorization.create(options()).reconcile(capability)).reasonCode, 'RECONCILIATION_AUTHORIZATION_DENIED');
  time = 2000;
  assert.equal((await first.reconcile(capability)).reasonCode, 'RECONCILIATION_AUTHORIZATION_DENIED');
  time = 1999;
  assert.equal((await first.reconcile(capability)).reasonCode, 'RECONCILIATION_AUTHORIZATION_DENIED');
});

test('concurrent use consumes capability before reconciliation awaits', async () => {
  time = 1000;
  let finish;
  let resolves = 0;
  let started;
  const entered = new Promise(resolve => { started = resolve; });
  const value = authorization.create(options({ deploymentJournal: journal({ inspect: async () => ({ status: 'FOUND', state: { status: 'UNKNOWN' } }) }), resolve: async () => { resolves++; started(); return new Promise(resolve => { finish = resolve; }); } }));
  const capability = await value.issue(hash);
  const first = value.reconcile(capability);
  await entered;
  assert.equal((await value.reconcile(capability)).reasonCode, 'RECONCILIATION_AUTHORIZATION_DENIED');
  finish('APPLIED');
  assert.equal((await first).status, 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_APPLIED');
  assert.equal(resolves, 1);
});

test('construction requires bounded purpose-bound dependencies', () => {
  assert.throws(() => authorization.create(), /required/u);
  for (const changed of [{ actorHash: 'bad' }, { reconciliationPurpose: '' }, { authorizationTtlMs: 999 }, { authorizationTimeoutMs: 300001 }, { now: null }, { authorizationAudit: null }, { auditReadiness: null }]) assert.throws(() => authorization.create(options(changed)), /required|policy|authorizationAudit|auditReadiness/u);
});

test('audit readiness denial is durably recorded before operator callback is skipped', async () => {
  time = 1000;
  let authorizations = 0;
  const events = [];
  const value = authorization.create(options({ auditReadiness: auditReadiness({ check: async () => ({ version: readiness.READINESS_VERSION, status: 'RECONCILIATION_AUDIT_READINESS_BLOCKED', reasonCode: 'AUDIT_SCAN_LIMIT_REACHED', eventCount: 100, pageCount: 1, watermarkId: 100 }) }), authorize: async () => { authorizations++; return true; }, authorizationAudit: authorizationAudit({ record: async event => { events.push(event); return { status: 'RECORDED', eventHash: 'd'.repeat(64) }; } }) }));
  const result = await value.issue(hash);
  assert.equal(result.reasonCode, 'AUDIT_SCAN_LIMIT_REACHED');
  assert.equal(authorizations, 0);
  assert.equal(events[0].decision, 'DENIED');
});
