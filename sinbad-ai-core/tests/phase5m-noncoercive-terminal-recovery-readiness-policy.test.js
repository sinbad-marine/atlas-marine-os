'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const readiness = require('../adapters/supabase-terminal-recovery-readiness.js');

const actorHash = 'b'.repeat(64);
const handler = async () => ({ data: true, error: null });
function base() { return { serviceRole: true, actorHash, client: { rpc: handler }, limit: 10, slaMs: 120000, pageSize: 10, maxEvents: 100, now: () => 1000 }; }

test('readiness policy rejects accessors and descriptor traps without invocation', () => {
  let calls = 0;
  for (const field of ['limit', 'slaMs', 'pageSize', 'maxEvents', 'now']) {
    const options = base();
    Object.defineProperty(options, field, { get() { calls++; throw new Error('must not run'); } });
    assert.throws(() => readiness.create(options), /bounds/u);
  }
  const options = base();
  const trapped = new Proxy(options, { getOwnPropertyDescriptor(target, field) { if (['limit', 'slaMs', 'pageSize', 'maxEvents', 'now'].includes(field)) throw new Error('host failure'); return Reflect.getOwnPropertyDescriptor(target, field); } });
  assert.throws(() => readiness.create(trapped), /bounds/u);
  assert.equal(calls, 0);
});

test('readiness policy rejects coercive and non-integer bounds', () => {
  let calls = 0;
  const malicious = { valueOf() { calls++; throw new Error('must not run'); }, [Symbol.toPrimitive]() { calls++; throw new Error('must not run'); } };
  for (const changed of [{ limit: malicious }, { slaMs: malicious }, { pageSize: malicious }, { maxEvents: malicious }, { limit: '10' }, { slaMs: 120000n }, { pageSize: 0 }, { pageSize: 501 }, { pageSize: 100, maxEvents: 99 }]) assert.throws(() => readiness.create({ ...base(), ...changed }), /bounds/u);
  assert.equal(calls, 0);
});

test('readiness captures policy primitives and clock before later mutation', async () => {
  let originalCalls = 0, replacementCalls = 0;
  const options = base();
  options.now = () => { originalCalls++; return Date.parse('2026-08-13T00:02:00Z'); };
  options.client = { async rpc(name) { if (name.startsWith('verify_')) return { data: true, error: null }; return { data: [], error: null }; } };
  const value = readiness.create(options);
  options.limit = 0; options.pageSize = 0; options.now = () => { replacementCalls++; throw new Error('must not run'); };
  assert.equal((await value.check()).status, 'RECOVERY_READINESS_READY');
  assert.equal(originalCalls, 1);
  assert.equal(replacementCalls, 0);
});
