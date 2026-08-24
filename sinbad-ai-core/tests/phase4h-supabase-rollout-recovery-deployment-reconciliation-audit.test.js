'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const auditFactory = require('../../tools/trusted-rollout-recovery-deployment-reconciliation-audit.js');
const adapter = require('../adapters/supabase-rollout-recovery-deployment-reconciliation-audit.js');

const actorHash = 'a'.repeat(64), authorizationHash = 'b'.repeat(64), purposeHash = 'c'.repeat(64);
async function event() { let captured; const audit = auditFactory.create({ durable: true, append: async value => { captured = value; return true; } }); await audit.record({ actorHash, authorizationHash, purposeHash, decision: 'AUTHORIZED', decidedAt: 1000 }); return captured; }
const create = handler => adapter.create({ serviceRole: true, client: { rpc: handler } });

test('implements the exact Phase 4G durable append contract', () => {
  assert.equal(adapter.AUDIT_VERSION, auditFactory.AUDIT_VERSION);
  assert.throws(() => adapter.create(), /service-role/u);
  const value = create(async () => ({ data: 'RECORDED', error: null }));
  assert.deepEqual(Object.keys(value), ['version', 'durable', 'append']);
  assert.equal(value.durable, true);
  assert.ok(Object.isFrozen(value));
});

test('appends exact minimal fields and accepts idempotent replay', async () => {
  const value = await event();
  for (const data of ['RECORDED', 'ALREADY_RECORDED']) {
    let seen;
    assert.equal(await create(async (name, args) => { seen = [name, args]; return { data, error: null }; }).append(value), true);
    assert.deepEqual(seen, ['append_rollout_recovery_deployment_reconciliation_audit', { p_actor_hash: actorHash, p_authorization_hash: authorizationHash, p_purpose_hash: purposeHash, p_decision: 'AUTHORIZED', p_decided_at_ms: 1000, p_event_hash: value.eventHash }]);
  }
});

test('invalid denied malformed and transport failures fail closed', async () => {
  const value = await event();
  let calls = 0;
  const unavailable = create(async () => { calls++; throw new Error('offline'); });
  assert.equal(await unavailable.append({ ...value, eventHash: 'bad' }), false);
  assert.equal(calls, 0);
  assert.equal(await unavailable.append(value), false);
  for (const response of [{ data: 'DENIED', error: null }, { data: 'HASH_MISMATCH', error: null }, { data: true, error: null }, { data: 'RECORDED', error: {} }]) assert.equal(await create(async () => response).append(value), false);
});

test('migration recomputes hashes and enforces immutable service-role-only storage', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20260822_rollout_recovery_deployment_reconciliation_audit.sql'), 'utf8');
  for (const pattern of [/^begin;/iu, /create extension if not exists pgcrypto/iu, /enable row level security/iu, /rows are immutable/iu, /before update or delete/iu, /before truncate/iu, /auth\.role\(\)<>'service_role'/iu, /p_event_hash<>v_expected/iu, /on conflict \(event_hash\) do nothing/iu, /return 'ALREADY_RECORDED'/iu, /return 'CONFLICT'/iu, /grant execute on function public\.append_rollout_recovery_deployment_reconciliation_audit/iu, /commit;/iu]) assert.match(sql, pattern);
  for (const fragment of ["'sinbad-rollout-recovery-deployment-reconciliation-audit/4G-v1'", 'p_actor_hash || chr(10)', 'p_authorization_hash || chr(10)', 'p_purpose_hash || chr(10)']) assert.ok(sql.includes(fragment));
});

test('adapter remains outside package exports', () => {
  assert.equal(require('../package.json').exports['./supabase-rollout-recovery-deployment-reconciliation-audit'], undefined);
});
