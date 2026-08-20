'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../adapters/supabase-durable-idempotency-store.js');

const key = 'a'.repeat(64), token = '123e4567-e89b-42d3-a456-426614174000';
const summary = () => ({ status: 'TRUSTED_TERMINAL_DELIVERY_APPLIED', terminalState: 'DELIVERY_SUCCEEDED', outcome: 'DELIVERED', transitionHash: 'b'.repeat(64) });
function create(rpc) { return store.create({ serviceRole: true, claimLeaseMs: 30000, client: { rpc } }); }

test('settlement summary accessors traps symbols inherited and coercive fields fail closed', async () => {
  let hooks = 0, settleCalls = 0;
  const malicious = { toString() { hooks++; throw new Error('must not run'); }, valueOf() { hooks++; throw new Error('must not run'); } };
  const value = create(async name => name === 'claim_terminal_delivery' ? { data: token, error: null } : (settleCalls++, { data: true, error: null }));
  assert.equal(await value.claim(key), true);
  const invalid = [Object.create(summary()), new Proxy(summary(), { ownKeys() { throw new Error('host failure'); } }), { ...summary(), transitionHash: malicious }, { ...summary(), [Symbol('hidden')]: 'x' }];
  for (const input of invalid) assert.equal(await value.settle(key, input), false);
  for (const field of Object.keys(summary())) { const input = summary(); Object.defineProperty(input, field, { enumerable: true, get() { hooks++; throw new Error('must not run'); } }); assert.equal(await value.settle(key, input), false); }
  assert.equal(hooks, 0);
  assert.equal(settleCalls, 0);
});

test('settlement sends a frozen primitive snapshot isolated from source mutation', async () => {
  let captured;
  const value = create(async (name, args) => name === 'claim_terminal_delivery' ? { data: token, error: null } : (captured = args.p_summary, { data: true, error: null }));
  const input = summary();
  assert.equal(await value.claim(key), true);
  assert.equal(await value.settle(key, input), true);
  input.outcome = 'FAILED';
  assert.notEqual(captured, input);
  assert.ok(Object.isFrozen(captured));
  assert.deepEqual(captured, summary());
});

test('settlement rejects coercive keys before summary or RPC work', async () => {
  let hooks = 0, rpcCalls = 0;
  const malicious = { toString() { hooks++; throw new Error('must not run'); }, valueOf() { hooks++; throw new Error('must not run'); } };
  const value = create(async () => { rpcCalls++; throw new Error('must not run'); });
  assert.equal(await value.settle(malicious, summary()), false);
  assert.equal(hooks, 0);
  assert.equal(rpcCalls, 0);
});
