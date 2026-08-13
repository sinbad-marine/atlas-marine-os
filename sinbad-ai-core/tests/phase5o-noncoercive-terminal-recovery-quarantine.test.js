'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const recovery = require('../adapters/supabase-terminal-recovery.js');

const actorHash = 'b'.repeat(64), claimKey = 'a'.repeat(64);
function options(rpc) { return { serviceRole: true, actorHash, client: { rpc } }; }

test('recovery construction rejects actor identity accessors traps and coercion', () => {
  let hooks = 0;
  const malicious = { toString() { hooks++; throw new Error('must not run'); }, valueOf() { hooks++; throw new Error('must not run'); } };
  for (const actor of [malicious, 1, new String(actorHash)]) assert.throws(() => recovery.create({ ...options(async () => null), actorHash: actor }), /operator identity/u);
  const accessor = options(async () => null); Object.defineProperty(accessor, 'actorHash', { get() { hooks++; throw new Error('must not run'); } });
  assert.throws(() => recovery.create(accessor), /operator identity/u);
  const trapped = new Proxy(options(async () => null), { getOwnPropertyDescriptor(target, field) { if (field === 'actorHash') throw new Error('host failure'); return Reflect.getOwnPropertyDescriptor(target, field); } });
  assert.throws(() => recovery.create(trapped), /operator identity/u);
  assert.equal(hooks, 0);
});

test('quarantine rejects accessors traps inherited and coercive values before RPC', async () => {
  let hooks = 0, rpcCalls = 0;
  const malicious = { toString() { hooks++; throw new Error('must not run'); }, valueOf() { hooks++; throw new Error('must not run'); } };
  const value = recovery.create(options(async () => { rpcCalls++; throw new Error('must not run'); }));
  const base = { claimKey, reasonCode: 'PROCESS_CRASH' };
  for (const input of [Object.create(base), new Proxy(base, { getOwnPropertyDescriptor() { throw new Error('host failure'); } }), { ...base, claimKey: malicious }, { ...base, reasonCode: malicious }]) assert.equal(await value.quarantine(input), false);
  for (const field of ['claimKey', 'reasonCode']) { const input = { ...base }; Object.defineProperty(input, field, { get() { hooks++; throw new Error('must not run'); } }); assert.equal(await value.quarantine(input), false); }
  assert.equal(hooks, 0);
  assert.equal(rpcCalls, 0);
});
