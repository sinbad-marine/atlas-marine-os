'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const audit = require('../adapters/supabase-terminal-recovery-audit.js');

function create(handler) { return audit.create({ serviceRole: true, client: { rpc: handler } }); }

function validRow(overrides = {}) {
  const value = {
    id: 1,
    event_time_ms: 1786615200001,
    claim_key: 'a'.repeat(64),
    actor_hash: 'b'.repeat(64),
    action: 'OPERATOR_QUARANTINED',
    reason_code: 'PROCESS_CRASH',
    created_at: new Date(1786615200001).toISOString(),
    ...overrides,
  };
  return {
    ...value,
    event_hash: createHash('sha256').update([
      audit.AUDIT_VERSION,
      value.id,
      value.event_time_ms,
      value.claim_key,
      value.actor_hash,
      value.action,
      value.reason_code,
    ].join('\n'), 'utf8').digest('hex'),
  };
}

test('terminal audit default inspect and scan validate golden rows with exact RPC pagination', async () => {
  const inspectCalls = [];
  const inspectValue = create(async (name, args) => {
    inspectCalls.push([name, args]);
    return name === 'verify_terminal_recovery_audit_access'
      ? { data: true, error: null }
      : { data: [validRow()], error: null };
  });
  const inspected = await inspectValue.inspect();
  assert.equal(inspected.status, 'AUDIT_PAGE_VALID');
  assert.equal(inspected.eventCount, 1);
  assert.deepEqual(inspectCalls[1], ['list_terminal_recovery_audit', { p_limit: 100, p_before_id: null }]);

  const scanCalls = [];
  let page = 0;
  const scanValue = create(async (name, args) => {
    scanCalls.push([name, args]);
    if (name === 'verify_terminal_recovery_audit_access') return { data: true, error: null };
    return { data: page++ === 0 ? [validRow()] : [], error: null };
  });
  const scanned = await scanValue.scan();
  assert.equal(scanned.status, 'AUDIT_SCAN_COMPLETE');
  assert.equal(scanned.eventCount, 1);
  assert.equal(scanned.pageCount, 2);
  assert.equal(scanned.watermarkId, 1);
  assert.deepEqual(scanCalls[1], ['list_terminal_recovery_audit', { p_limit: 100, p_before_id: null }]);
  assert.deepEqual(scanCalls[2], ['verify_terminal_recovery_audit_access', {}]);
  assert.deepEqual(scanCalls[3], ['list_terminal_recovery_audit', { p_limit: 100, p_before_id: 1 }]);
});

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
  const base = validRow();
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

test('terminal audit inspect and scan fail closed for non-object and malformed rows', async () => {
  for (const row of [null, 1, 'bad', [], { ...validRow(), event_hash: 'c'.repeat(64) }]) {
    const inspectValue = create(async name => name === 'verify_terminal_recovery_audit_access' ? { data: true, error: null } : { data: [row], error: null });
    assert.equal((await inspectValue.inspect()).status, 'AUDIT_INTEGRITY_FAILED');

    const scanValue = create(async name => name === 'verify_terminal_recovery_audit_access' ? { data: true, error: null } : { data: [row], error: null });
    assert.equal((await scanValue.scan()).status, 'AUDIT_SCAN_INTEGRITY_FAILED');
  }
});
