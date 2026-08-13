'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const authorization = require('../adapters/rollout-recovery-authorization-audit-readiness.js');
const reconciliation = require('../../tools/rollout-recovery-deployment-reconciliation-audit-readiness.js');

for (const [name, readiness] of [['authorization', authorization], ['reconciliation', reconciliation]]) {
  const verifier = Object.freeze({ version: readiness.EXPECTED_VERIFIER_VERSION, scan: async () => null });

  test(`${name} readiness snapshots a frozen null-prototype policy`, () => {
    const value = readiness.policy({ auditVerifier: verifier, pageSize: 25, maxEvents: 100 });
    assert.equal(Object.getPrototypeOf(value), null);
    assert.ok(Object.isFrozen(value));
    assert.deepEqual({ ...value }, { auditVerifier: verifier, pageSize: 25, maxEvents: 100 });
  });

  test(`${name} readiness rejects accessors and descriptor traps without invocation`, () => {
    for (const field of ['auditVerifier', 'pageSize', 'maxEvents']) {
      let calls = 0;
      const options = { auditVerifier: verifier, pageSize: 25, maxEvents: 100 };
      Object.defineProperty(options, field, { get() { calls++; throw new Error('must not run'); } });
      assert.throws(() => readiness.create(options), /policy/u);
      assert.equal(calls, 0, field);
    }
    assert.throws(() => readiness.create(new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('host failure'); } })), /policy/u);
  });

  test(`${name} readiness rejects coercive and non-integer policy values`, () => {
    let calls = 0;
    const malicious = { valueOf() { calls++; throw new Error('must not run'); }, [Symbol.toPrimitive]() { calls++; throw new Error('must not run'); } };
    for (const changed of [{ pageSize: malicious }, { maxEvents: malicious }, { pageSize: '25' }, { maxEvents: 100n }, { pageSize: 0 }, { pageSize: 501 }, { pageSize: 100, maxEvents: 99 }]) {
      assert.throws(() => readiness.create({ auditVerifier: verifier, pageSize: 25, maxEvents: 100, ...changed }), /policy/u);
    }
    assert.equal(calls, 0);
  });
}
