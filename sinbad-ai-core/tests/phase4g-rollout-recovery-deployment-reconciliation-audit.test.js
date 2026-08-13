'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const audit = require('../../tools/trusted-rollout-recovery-deployment-reconciliation-audit.js');
const authorization = require('../../tools/trusted-rollout-recovery-deployment-reconciliation-authorization.js');
const reconciliation = require('../../tools/trusted-rollout-recovery-deployment-reconciliation.js');
const readiness = require('../../tools/rollout-recovery-deployment-reconciliation-audit-readiness.js');

const actorHash = 'a'.repeat(64);
const authorizationHash = 'b'.repeat(64);
const purposeHash = 'c'.repeat(64);

test('creates deterministic immutable content-minimized audit events', async () => {
  const events = [];
  const value = audit.create({ durable: true, append: async event => { events.push(event); return true; } });
  const first = await value.record({ actorHash, authorizationHash, purposeHash, decision: 'AUTHORIZED', decidedAt: 1000 });
  const second = await value.record({ actorHash, authorizationHash, purposeHash, decision: 'AUTHORIZED', decidedAt: 1000 });
  assert.equal(first.status, 'RECORDED');
  assert.equal(first.eventHash, second.eventHash);
  assert.deepEqual(Object.keys(events[0]), ['version', 'actorHash', 'authorizationHash', 'purposeHash', 'decision', 'decidedAt', 'eventHash']);
  assert.ok(Object.isFrozen(events[0]));
});

test('invalid denied and unavailable append paths fail closed', async () => {
  let calls = 0;
  const value = audit.create({ durable: true, append: async () => { calls++; return false; } });
  assert.equal((await value.record({ actorHash: 'bad' })).status, 'INVALID');
  assert.equal(calls, 0);
  assert.equal((await value.record({ actorHash, authorizationHash, purposeHash, decision: 'DENIED', decidedAt: 1000 })).status, 'DENIED');
  assert.equal((await audit.create({ durable: true, append: async () => { throw new Error('offline'); } }).record({ actorHash, authorizationHash, purposeHash, decision: 'DENIED', decidedAt: 1000 })).status, 'UNAVAILABLE');
});

test('authorization requires durable audit before approved or denied response returns', async () => {
  let time = 1000;
  const journal = { version: reconciliation.EXPECTED_JOURNAL_VERSION, durable: true, inspect: async () => ({ status: 'FOUND', state: { status: 'APPLIED' } }), settle: async () => ({ status: 'SETTLED' }) };
  for (const authorizeDecision of [true, false]) {
    for (const record of [async () => ({ status: 'DENIED', eventHash: 'd'.repeat(64) }), async () => { throw new Error('offline'); }]) {
      const value = authorization.create({ deploymentJournal: journal, resolve: async () => 'APPLIED', reconciliationTimeoutMs: 1000, authorize: async () => authorizeDecision, authorizationAudit: { version: audit.AUDIT_VERSION, durable: true, record }, auditReadiness: { version: readiness.READINESS_VERSION, check: async () => ({ version: readiness.READINESS_VERSION, status: 'RECONCILIATION_AUDIT_READINESS_READY', reasonCode: null }) }, now: () => time, actorHash, reconciliationPurpose: 'deployment.reconciliation', authorizationTtlMs: 1000, authorizationTimeoutMs: 1000 });
      const result = await value.issue(authorizationHash);
      assert.equal(result.reasonCode, 'AUTHORIZATION_AUDIT_REQUIRED');
      assert.equal(result.capabilityHash, null);
      time += 1;
    }
  }
});
