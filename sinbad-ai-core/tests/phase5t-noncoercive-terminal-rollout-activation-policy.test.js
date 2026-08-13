'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const activation = require('../adapters/trusted-terminal-rollout-activation.js');

const actorHash = 'b'.repeat(64);
function options() { return { serviceRole: true, actorHash, client: { rpc: async name => name.startsWith('verify_') ? { data: true, error: null } : { data: [], error: null } }, limit: 10, slaMs: 120000, pageSize: 10, maxEvents: 100, ttlMs: 5000, purpose: 'terminal-rollout', now: () => 1000, activationTimeoutMs: 5000, activate: async () => true, resolve: async () => 'PENDING' }; }

test('activation policy rejects accessors traps strings bigint and coercion', () => {
  let hooks = 0;
  const malicious = { valueOf() { hooks++; throw new Error('must not run'); }, [Symbol.toPrimitive]() { hooks++; throw new Error('must not run'); } };
  for (const changed of [{ activationTimeoutMs: malicious }, { activationTimeoutMs: '5000' }, { activationTimeoutMs: 5000n }]) assert.throws(() => activation.create({ ...options(), ...changed }), /timeout/u);
  for (const field of ['activate', 'resolve', 'diagnose', 'activationJournal', 'activationTimeoutMs']) { const value = options(); Object.defineProperty(value, field, { get() { hooks++; throw new Error('must not run'); } }); assert.throws(() => activation.create(value), /activate|timeout|functions|journal/u); }
  const trapped = new Proxy(options(), { getOwnPropertyDescriptor(target, field) { if (field === 'activationTimeoutMs') throw new Error('host failure'); return Reflect.getOwnPropertyDescriptor(target, field); } });
  assert.throws(() => activation.create(trapped), /timeout/u);
  assert.equal(hooks, 0);
});

test('activation captures hooks and timeout before later mutation', async () => {
  let originalCalls = 0, replacementCalls = 0;
  const source = options(); source.activate = async () => { originalCalls++; return true; };
  const value = activation.create(source);
  source.activationTimeoutMs = 1; source.activate = async () => { replacementCalls++; throw new Error('must not run'); };
  const attested = await value.issue(), result = await value.activate(attested);
  assert.equal(result.status, 'TRUSTED_ROLLOUT_ACTIVATION_APPLIED');
  assert.equal(originalCalls, 1);
  assert.equal(replacementCalls, 0);
});

test('activation snapshots trusted journal methods before mutation', async () => {
  let beginCalls = 0, settleCalls = 0, replacementCalls = 0;
  const journal = { version: activation.EXPECTED_JOURNAL_VERSION, durable: true, async begin() { beginCalls++; return { status: 'BEGUN' }; }, async settle() { settleCalls++; return { status: 'SETTLED' }; }, async inspect() { return { status: 'ABSENT' }; } };
  const source = { ...options(), activationJournal: journal }, value = activation.create(source);
  journal.begin = async () => { replacementCalls++; throw new Error('must not run'); }; journal.settle = journal.begin; journal.inspect = journal.begin;
  const result = await value.activate(await value.issue());
  assert.equal(result.status, 'TRUSTED_ROLLOUT_ACTIVATION_APPLIED');
  assert.equal(beginCalls, 1);
  assert.equal(settleCalls, 1);
  assert.equal(replacementCalls, 0);
});
