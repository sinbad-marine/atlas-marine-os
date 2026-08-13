'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const verifier = require('../adapters/supabase-rollout-recovery-authorization-audit-verifier.js');

function row() { const value = { id: 1, actor_hash: 'a'.repeat(64), attestation_hash: 'b'.repeat(64), purpose_hash: 'c'.repeat(64), decision: 'AUTHORIZED', decided_at_ms: 1001 }; value.event_hash = createHash('sha256').update([verifier.EVENT_VERSION, value.actor_hash, value.attestation_hash, value.purpose_hash, value.decision, value.decided_at_ms].join('\n')).digest('hex'); return value; }

test('advertises an exact frozen authorization audit row contract', () => {
  const value = verifier.rowSnapshot(row());
  assert.equal(Object.getPrototypeOf(value), null);
  assert.ok(Object.isFrozen(value));
  assert.deepEqual(Object.keys(value), verifier.ROW_FIELDS);
});

test('authorization audit row accessors fail closed without invocation', () => {
  for (const name of verifier.ROW_FIELDS) {
    const value = row(); let calls = 0;
    Object.defineProperty(value, name, { get() { calls++; throw new Error('must not run'); } });
    assert.equal(verifier.parse([value]), null);
    assert.equal(calls, 0, name);
  }
});

test('descriptor traps inherited and coercive authorization audit fields fail closed', () => {
  let calls = 0;
  const malicious = { toString() { calls++; throw new Error('must not run'); }, valueOf() { calls++; throw new Error('must not run'); } };
  for (const value of [Object.create(row()), new Proxy(row(), { getOwnPropertyDescriptor() { throw new Error('host failure'); } }), { ...row(), id: malicious }, { ...row(), attestation_hash: malicious }, { ...row(), decided_at_ms: '1001' }]) assert.equal(verifier.parse([value]), null);
  assert.equal(calls, 0);
});
