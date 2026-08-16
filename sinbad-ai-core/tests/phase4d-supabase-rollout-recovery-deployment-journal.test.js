'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const journal = require('../adapters/supabase-rollout-recovery-deployment-journal.js');
const contract = require('../../tools/trusted-rollout-recovery-journaled-deployment.js');

const hash = 'a'.repeat(64);
const create = handler => journal.create({ serviceRole: true, client: { rpc: handler } });

test('implements the exact durable Phase 4C journal contract', () => {
  assert.equal(journal.JOURNAL_VERSION, contract.JOURNAL_VERSION);
  assert.throws(() => journal.create(), /service-role/u);
  const value = create(async () => ({ data: null, error: null }));
  assert.deepEqual(Object.keys(value), ['version', 'durable', 'begin', 'settle', 'inspect']);
  assert.equal(value.durable, true);
  assert.ok(Object.isFrozen(value));
});

test('uses exact content-free deployment journal RPCs', async () => {
  const calls = [];
  const value = create(async (name, args) => {
    calls.push([name, args]);
    if (name.startsWith('begin_')) return { data: 'BEGUN', error: null };
    if (name.startsWith('settle_')) return { data: 'SETTLED', error: null };
    return { data: [{ status: 'UNKNOWN', started_at: '2026-08-13T00:00:00Z', updated_at: '2026-08-13T00:01:00Z' }], error: null };
  });
  assert.equal((await value.begin(hash)).status, 'BEGUN');
  assert.equal((await value.settle(hash, 'PENDING', 'UNKNOWN')).status, 'SETTLED');
  assert.equal((await value.inspect(hash)).state.status, 'UNKNOWN');
  assert.deepEqual(calls, [
    ['begin_rollout_recovery_deployment', { p_authorization_hash: hash }],
    ['settle_rollout_recovery_deployment', { p_authorization_hash: hash, p_expected_status: 'PENDING', p_status: 'UNKNOWN' }],
    ['inspect_rollout_recovery_deployment', { p_authorization_hash: hash }],
  ]);
});

test('invalid transport malformed rows and closed RPC outcomes fail closed', async () => {
  let calls = 0;
  const unavailable = create(async () => { calls++; throw new Error('offline'); });
  assert.equal((await unavailable.begin('bad')).status, 'INVALID');
  assert.equal((await unavailable.settle(hash, 'UNKNOWN', 'UNKNOWN')).status, 'INVALID');
  assert.equal(calls, 0);
  assert.equal((await unavailable.begin(hash)).status, 'UNAVAILABLE');
  for (const status of ['EXISTS', 'DENIED']) assert.equal((await create(async () => ({ data: status, error: null })).begin(hash)).status, status);
  for (const status of ['ALREADY_SETTLED', 'CONFLICT', 'DENIED']) assert.equal((await create(async () => ({ data: status, error: null })).settle(hash, 'PENDING', 'APPLIED')).status, status);
  for (const data of [[{}, {}], [{ status: 'APPLIED', started_at: 'bad', updated_at: 'bad' }]]) assert.equal((await create(async () => ({ data, error: null })).inspect(hash)).status, 'UNAVAILABLE');
});

test('migration enforces service-role-only monotonic compare-and-set journal', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20260821_rollout_recovery_deployment_journal.sql'), 'utf8');
  for (const pattern of [/^begin;/iu, /enable row level security/iu, /auth\.role\(\)<>'service_role'/iu, /on conflict \(authorization_hash\) do nothing/iu, /p_expected_status not in \('PENDING','UNKNOWN'\)/iu, /status=p_expected_status/iu, /return 'ALREADY_SETTLED'/iu, /return 'CONFLICT'/iu, /revoke all on function public\.begin_rollout_recovery_deployment\(text\)/iu, /grant execute on function public\.inspect_rollout_recovery_deployment\(text\) to service_role/iu, /commit;/iu]) assert.match(sql, pattern);
});
