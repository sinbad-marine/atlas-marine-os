'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const journal = require('../adapters/supabase-rollout-recovery-deployment-journal.js');

const hash = 'a'.repeat(64);
const row = () => ({ status: 'UNKNOWN', started_at: '2026-08-13T00:00:00Z', updated_at: '2026-08-13T00:01:00Z' });
const create = data => journal.create({ serviceRole: true, client: { rpc: async () => ({ data: [data], error: null }) } });

test('advertises an exact frozen journal row contract', () => {
  const value = journal.rowSnapshot(row());
  assert.equal(Object.getPrototypeOf(value), null);
  assert.ok(Object.isFrozen(value));
  assert.deepEqual(Object.keys(value), journal.ROW_FIELDS);
});

test('journal row accessors fail closed without invocation', async () => {
  for (const name of journal.ROW_FIELDS) {
    const value = row(); let calls = 0;
    Object.defineProperty(value, name, { get() { calls++; throw new Error('must not run'); } });
    assert.equal((await create(value).inspect(hash)).status, 'UNAVAILABLE');
    assert.equal(calls, 0, name);
  }
});

test('descriptor traps inherited and coercive row values fail closed', async () => {
  let calls = 0;
  const malicious = { toString() { calls++; throw new Error('must not run'); }, valueOf() { calls++; throw new Error('must not run'); } };
  for (const value of [Object.create(row()), new Proxy(row(), { getOwnPropertyDescriptor() { throw new Error('host failure'); } }), { ...row(), status: malicious }, { ...row(), started_at: malicious }]) assert.equal((await create(value).inspect(hash)).status, 'UNAVAILABLE');
  assert.equal(calls, 0);
});
