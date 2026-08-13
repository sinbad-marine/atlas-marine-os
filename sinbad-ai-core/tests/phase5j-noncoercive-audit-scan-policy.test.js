'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const authorization = require('../adapters/supabase-rollout-recovery-authorization-audit-verifier.js');
const reconciliation = require('../adapters/supabase-rollout-recovery-deployment-reconciliation-audit-verifier.js');

for (const [name, verifier] of [['authorization', authorization], ['reconciliation', reconciliation]]) {
  test(`${name} verifier snapshots a frozen null-prototype scan policy`, () => {
    const value = verifier.scanPolicy({ pageSize: 25, maxEvents: 100 });
    assert.equal(Object.getPrototypeOf(value), null);
    assert.ok(Object.isFrozen(value));
    assert.deepEqual({ ...value }, { pageSize: 25, maxEvents: 100 });
    const defaults = verifier.scanPolicy({});
    assert.equal(Object.getPrototypeOf(defaults), null);
    assert.ok(Object.isFrozen(defaults));
    assert.deepEqual({ ...defaults }, { pageSize: 100, maxEvents: 10000 });
  });

  test(`${name} scan policy accessors and descriptor traps fail without invocation`, () => {
    for (const field of ['pageSize', 'maxEvents']) {
      let calls = 0; const input = {};
      Object.defineProperty(input, field, { get() { calls++; throw new Error('must not run'); } });
      assert.equal(verifier.scanPolicy(input), null);
      assert.equal(calls, 0, field);
    }
    assert.equal(verifier.scanPolicy(new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('host failure'); } })), null);
  });

  test(`${name} scan policy rejects coercive and non-integer values`, async () => {
    let calls = 0;
    const malicious = { valueOf() { calls++; throw new Error('must not run'); }, [Symbol.toPrimitive]() { calls++; throw new Error('must not run'); } };
    for (const changed of [{ pageSize: malicious }, { maxEvents: malicious }, { pageSize: '25' }, { maxEvents: 1n }, { pageSize: 0 }, { pageSize: 501 }, { pageSize: 100, maxEvents: 99 }]) assert.equal(verifier.scanPolicy(changed), null);
    assert.equal(calls, 0);
  });
}
