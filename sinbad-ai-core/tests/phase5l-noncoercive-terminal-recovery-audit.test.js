'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const audit = require('../adapters/supabase-terminal-recovery-audit.js');

function create(handler) { return audit.create({ serviceRole: true, client: { rpc: handler } }); }

test('terminal audit pagination rejects accessors traps and coercion before RPC', async () => {
  let hooks = 0, rpcCalls = 0;
  const malicious = { valueOf() { hooks++; throw new Error('must not run'); }, [Symbol.toPrimitive]() { hooks++; throw new Error('must not run'); } };
  const value = create(async () => { rpcCalls++; throw new Error('must not run'); });
  for (const [method, base, field] of [['inspect', { limit: 10, beforeId: null }, 'limit'], ['inspect', { limit: 10, beforeId: null }, 'beforeId'], ['scan', { pageSize: 10, maxEvents: 100 }, 'pageSize'], ['scan', { pageSize: 10, maxEvents: 100 }, 'maxEvents']]) {
    for (const replacement of [malicious, '10', 10n]) assert.match((await value[method]({ ...base, [field]: replacement })).reasonCode, /AUDIT_INVALID_/u);
    const accessor = { ...base }; Object.defineProperty(accessor, field, { get() { hooks++; throw new Error('must not run'); } });
    assert.match((await value[method](accessor)).reasonCode, /AUDIT_INVALID_/u);
    assert.match((await value[method](new Proxy(base, { getOwnPropertyDescriptor() { throw new Error('host failure'); } }))).reasonCode, /AUDIT_INVALID_/u);
  }
  assert.equal(hooks, 0);
  assert.equal(rpcCalls, 0);
});

test('terminal audit rows reject accessors traps inherited and coercive fields', async () => {
  const base = { id: 1, event_time_ms: 1786615200001, claim_key: 'a'.repeat(64), actor_hash: 'b'.repeat(64), action: 'OPERATOR_QUARANTINED', reason_code: 'PROCESS_CRASH', created_at: new Date(1786615200001).toISOString(), event_hash: 'c'.repeat(64) };
  let hooks = 0;
  const malicious = { toString() { hooks++; throw new Error('must not run'); }, valueOf() { hooks++; throw new Error('must not run'); } };
  const rows = [Object.create(base), new Proxy(base, { getOwnPropertyDescriptor() { throw new Error('host failure'); } }), { ...base, claim_key: malicious }];
  for (const row of rows) {
    const value = create(async name => name === 'verify_terminal_recovery_audit_access' ? { data: true, error: null } : { data: [row], error: null });
    assert.equal((await value.inspect()).status, 'AUDIT_INTEGRITY_FAILED');
  }
  const accessor = { ...base }; Object.defineProperty(accessor, 'id', { get() { hooks++; throw new Error('must not run'); } });
  const value = create(async name => name === 'verify_terminal_recovery_audit_access' ? { data: true, error: null } : { data: [accessor], error: null });
  assert.equal((await value.inspect()).status, 'AUDIT_INTEGRITY_FAILED');
  assert.equal(hooks, 0);
});
