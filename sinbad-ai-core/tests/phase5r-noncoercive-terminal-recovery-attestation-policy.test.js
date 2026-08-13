'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const attestation = require('../adapters/supabase-terminal-recovery-attestation.js');

const actorHash = 'b'.repeat(64);
function healthy() { return async name => name.startsWith('verify_') ? { data: true, error: null } : { data: [], error: null }; }
function options() { return { serviceRole: true, actorHash, client: { rpc: healthy() }, limit: 10, slaMs: 120000, pageSize: 10, maxEvents: 100, ttlMs: 5000, purpose: 'terminal-rollout', now: () => 1000 }; }

test('attestation policy rejects accessors traps boxed and coercive values', () => {
  let hooks = 0;
  const malicious = { toString() { hooks++; throw new Error('must not run'); }, valueOf() { hooks++; throw new Error('must not run'); }, [Symbol.toPrimitive]() { hooks++; throw new Error('must not run'); } };
  for (const changed of [{ ttlMs: malicious }, { ttlMs: '5000' }, { ttlMs: 5000n }, { purpose: malicious }, { purpose: new String('terminal-rollout') }]) assert.throws(() => attestation.create({ ...options(), ...changed }), /TTL|clock|purpose/u);
  for (const field of ['ttlMs', 'purpose', 'now']) { const value = options(); Object.defineProperty(value, field, { get() { hooks++; throw new Error('must not run'); } }); assert.throws(() => attestation.create(value), /TTL|clock|purpose/u); }
  const trapped = new Proxy(options(), { getOwnPropertyDescriptor(target, field) { if (['ttlMs', 'purpose', 'now'].includes(field)) throw new Error('host failure'); return Reflect.getOwnPropertyDescriptor(target, field); } });
  assert.throws(() => attestation.create(trapped), /TTL|clock|purpose/u);
  assert.equal(hooks, 0);
});

test('attestation clock rejects coercive samples without conversion hooks', async () => {
  let hooks = 0, samples = 0;
  const malicious = { valueOf() { hooks++; throw new Error('must not run'); }, [Symbol.toPrimitive]() { hooks++; throw new Error('must not run'); } };
  const value = attestation.create({ ...options(), now: () => ++samples === 1 ? 1000 : malicious });
  const result = await value.issue();
  assert.equal(result.reasonCode, 'ATTESTATION_CLOCK_INVALID');
  assert.equal(hooks, 0);
});

test('attestation captures ttl purpose and clock before later mutation', async () => {
  let originalCalls = 0, replacementCalls = 0;
  const source = options(); source.now = () => { originalCalls++; return 1000; };
  const value = attestation.create(source);
  source.ttlMs = 1; source.purpose = 'other'; source.now = () => { replacementCalls++; throw new Error('must not run'); };
  const result = await value.issue();
  assert.equal(result.status, 'READINESS_ATTESTED');
  assert.equal(result.expiresAt, 6000);
  assert.equal(originalCalls, 2);
  assert.equal(replacementCalls, 0);
});
