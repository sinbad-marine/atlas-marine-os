'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../adapters/supabase-durable-idempotency-store.js');

const key = 'a'.repeat(64), token = '123e4567-e89b-12d3-a456-426614174000';
function options(rpc) { return { serviceRole: true, claimLeaseMs: 30000, client: { rpc } }; }

test('idempotency lease policy rejects accessors traps bigint strings and coercion', () => {
  let hooks = 0;
  const malicious = { valueOf() { hooks++; throw new Error('must not run'); }, [Symbol.toPrimitive]() { hooks++; throw new Error('must not run'); } };
  for (const value of [malicious, '30000', 30000n]) assert.throws(() => store.create({ ...options(async () => null), claimLeaseMs: value }), /claimLeaseMs/u);
  const accessor = options(async () => null); Object.defineProperty(accessor, 'claimLeaseMs', { get() { hooks++; throw new Error('must not run'); } });
  assert.throws(() => store.create(accessor), /claimLeaseMs/u);
  const trapped = new Proxy(options(async () => null), { getOwnPropertyDescriptor(target, field) { if (field === 'claimLeaseMs') throw new Error('host failure'); return Reflect.getOwnPropertyDescriptor(target, field); } });
  assert.throws(() => store.create(trapped), /claimLeaseMs/u);
  assert.equal(hooks, 0);
});

test('claim rejects coercive keys before RPC and coercive tokens after RPC', async () => {
  let hooks = 0, rpcCalls = 0;
  const malicious = { toString() { hooks++; throw new Error('must not run'); }, valueOf() { hooks++; throw new Error('must not run'); } };
  const value = store.create(options(async () => { rpcCalls++; return { data: token, error: null }; }));
  assert.equal(await value.claim(malicious), false);
  assert.equal(rpcCalls, 0);
  const tokenValue = store.create(options(async () => ({ data: malicious, error: null })));
  assert.equal(await tokenValue.claim(key), false);
  assert.equal(hooks, 0);
});

test('claim preserves exact primitive key lease and token RPC contract', async () => {
  const calls = [];
  const value = store.create(options(async (name, args) => { calls.push([name, args]); return { data: token, error: null }; }));
  assert.equal(await value.claim(key), true);
  assert.deepEqual(calls, [['claim_terminal_delivery', { p_claim_key: key, p_lease_ms: 30000 }]]);
});
