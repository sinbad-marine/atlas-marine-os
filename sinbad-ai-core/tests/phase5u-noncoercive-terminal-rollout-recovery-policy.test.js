'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const recovery = require('../adapters/trusted-terminal-rollout-recovery.js');

const hash = 'c'.repeat(64);
function journal() { return { version: recovery.EXPECTED_JOURNAL_VERSION, durable: true, async inspect() { return { status: 'FOUND', state: { status: 'UNKNOWN' } }; }, async settle() { return { status: 'SETTLED' }; } }; }
function options() { return { activationJournal: journal(), resolve: async () => 'APPLIED', recoveryTimeoutMs: 5000 }; }

test('recovery policy rejects accessors traps strings bigint and coercion', () => {
  let hooks = 0;
  const malicious = { valueOf() { hooks++; throw new Error('must not run'); }, [Symbol.toPrimitive]() { hooks++; throw new Error('must not run'); } };
  for (const changed of [{ recoveryTimeoutMs: malicious }, { recoveryTimeoutMs: '5000' }, { recoveryTimeoutMs: 5000n }]) assert.throws(() => recovery.create({ ...options(), ...changed }), /timeout/u);
  for (const field of ['activationJournal', 'resolve', 'diagnose', 'recoveryTimeoutMs']) { const value = options(); Object.defineProperty(value, field, { get() { hooks++; throw new Error('must not run'); } }); assert.throws(() => recovery.create(value), /recovery policy/u); }
  const trapped = new Proxy(options(), { getOwnPropertyDescriptor(target, field) { if (field === 'recoveryTimeoutMs') throw new Error('host failure'); return Reflect.getOwnPropertyDescriptor(target, field); } });
  assert.throws(() => recovery.create(trapped), /recovery policy/u);
  assert.equal(hooks, 0);
});

test('recovery captures resolver timeout and journal methods before mutation', async () => {
  let inspectCalls = 0, settleCalls = 0, resolveCalls = 0, replacementCalls = 0;
  const durable = journal(); durable.inspect = async () => { inspectCalls++; return { status: 'FOUND', state: { status: 'UNKNOWN' } }; }; durable.settle = async () => { settleCalls++; return { status: 'SETTLED' }; };
  const source = { activationJournal: durable, resolve: async () => { resolveCalls++; return 'APPLIED'; }, recoveryTimeoutMs: 5000 }, value = recovery.create(source);
  source.recoveryTimeoutMs = 1; source.resolve = async () => { replacementCalls++; throw new Error('must not run'); }; durable.inspect = source.resolve; durable.settle = source.resolve;
  const result = await value.recover(hash);
  assert.equal(result.status, 'ROLLOUT_RECOVERY_APPLIED');
  assert.equal(inspectCalls, 1);
  assert.equal(settleCalls, 1);
  assert.equal(resolveCalls, 1);
  assert.equal(replacementCalls, 0);
});

test('recovery journal rejects accessors descriptor traps and inherited methods', () => {
  let hooks = 0;
  for (const field of ['version', 'durable', 'inspect', 'settle']) { const durable = journal(); Object.defineProperty(durable, field, { get() { hooks++; throw new Error('must not run'); } }); assert.throws(() => recovery.create({ ...options(), activationJournal: durable }), /activationJournal/u); }
  assert.throws(() => recovery.create({ ...options(), activationJournal: Object.create(journal()) }), /activationJournal/u);
  assert.throws(() => recovery.create({ ...options(), activationJournal: new Proxy(journal(), { getOwnPropertyDescriptor() { throw new Error('host failure'); } }) }), /activationJournal/u);
  assert.equal(hooks, 0);
});
