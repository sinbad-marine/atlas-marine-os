'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const recovery = require('../adapters/supabase-terminal-recovery.js');

const actorHash = 'b'.repeat(64);
function create(rpc) { return recovery.create({ serviceRole: true, actorHash, client: { rpc } }); }

test('recovery limits and inspect policy reject coercion accessors and traps before RPC', async () => {
  let hooks = 0, rpcCalls = 0;
  const malicious = { valueOf() { hooks++; throw new Error('must not run'); }, [Symbol.toPrimitive]() { hooks++; throw new Error('must not run'); } };
  const value = create(async () => { rpcCalls++; throw new Error('must not run'); });
  for (const limit of [malicious, '10', 10n]) assert.deepEqual(await value.listExpired(limit), []);
  for (const [field, replacement] of [['limit', malicious], ['slaMs', malicious], ['limit', '10'], ['slaMs', 30000n]]) assert.equal((await value.inspect({ limit: 10, slaMs: 30000, [field]: replacement })).reasonCode, 'RECOVERY_INVALID_INSPECT_ARGS');
  for (const field of ['limit', 'slaMs', 'now']) { const input = { limit: 10, slaMs: 30000, now: () => 1000 }; Object.defineProperty(input, field, { get() { hooks++; throw new Error('must not run'); } }); assert.equal((await value.inspect(input)).reasonCode, 'RECOVERY_INVALID_INSPECT_ARGS'); }
  assert.equal((await value.inspect(new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('host failure'); } }))).reasonCode, 'RECOVERY_INVALID_INSPECT_ARGS');
  assert.equal(hooks, 0);
  assert.equal(rpcCalls, 0);
});

test('recovery clock rejects coercive results without conversion hooks', async () => {
  let hooks = 0, rpcCalls = 0;
  const malicious = { valueOf() { hooks++; throw new Error('must not run'); }, [Symbol.toPrimitive]() { hooks++; throw new Error('must not run'); } };
  const value = create(async () => { rpcCalls++; throw new Error('must not run'); });
  assert.equal((await value.inspect({ limit: 10, slaMs: 30000, now: () => malicious })).reasonCode, 'RECOVERY_INVALID_INSPECT_ARGS');
  assert.equal(hooks, 0);
  assert.equal(rpcCalls, 0);
});

test('recovery claim rows reject accessors traps inherited and coercive fields', async () => {
  const base = { claim_key: 'a'.repeat(64), claimed_at: '2026-08-13T00:00:00Z', lease_expires_at: '2026-08-13T00:01:00Z' };
  let hooks = 0;
  const malicious = { toString() { hooks++; throw new Error('must not run'); }, valueOf() { hooks++; throw new Error('must not run'); } };
  const rows = [Object.create(base), new Proxy(base, { getOwnPropertyDescriptor() { throw new Error('host failure'); } }), { ...base, claim_key: malicious }];
  for (const row of rows) { const value = create(async name => name === 'verify_terminal_recovery_access' ? { data: true, error: null } : { data: [row], error: null }); assert.equal((await value.inspect({ slaMs: 30000, now: () => Date.parse('2026-08-13T00:02:00Z') })).reasonCode, 'RECOVERY_DATA_INTEGRITY_FAILED'); }
  const accessor = { ...base }; Object.defineProperty(accessor, 'claimed_at', { get() { hooks++; throw new Error('must not run'); } });
  const value = create(async name => name === 'verify_terminal_recovery_access' ? { data: true, error: null } : { data: [accessor], error: null });
  assert.equal((await value.inspect({ slaMs: 30000, now: () => Date.parse('2026-08-13T00:02:00Z') })).reasonCode, 'RECOVERY_DATA_INTEGRITY_FAILED');
  assert.equal(hooks, 0);
});
