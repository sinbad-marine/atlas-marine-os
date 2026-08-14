'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const isolation = require('../engine-isolation-profile-contracts.js');

const profile = (overrides = {}) => ({ version: isolation.VERSION, profileId: 'isolated-content-engine', engineId: 'design-engine', filesystemAccess: 'NONE', networkAccess: 'NONE', processExecution: 'NONE', environmentAccess: 'NONE', secretAccess: 'NONE', dynamicModuleLoad: false, nativeCode: false, memoryLimitMiB: 256, ...overrides });

test('a strict inert profile remains activation-blocked pending real enforcement', () => {
  const result = isolation.assessProfile(profile());
  assert.equal(result.reasonCode, 'ENGINE_ISOLATION_ENFORCEMENT_UNVERIFIED');
  assert.equal(result.isolationVerified, false);
  assert.equal(result.loadAllowed, false);
  assert.equal(result.executeAllowed, false);
  assert.equal(result.activationAllowed, false);
  assert.ok(result.assuranceGaps.length > 0);
});

test('rejects every declared authority and unsafe runtime feature', () => {
  for (const field of ['filesystemAccess', 'networkAccess', 'processExecution', 'environmentAccess', 'secretAccess']) {
    assert.equal(isolation.assessProfile(profile({ [field]: 'READ_ONLY' })).reasonCode, 'ENGINE_ISOLATION_PROFILE_UNSAFE');
  }
  for (const changed of [{ dynamicModuleLoad: true }, { nativeCode: true }, { memoryLimitMiB: 0 }, { memoryLimitMiB: 4097 }, { memoryLimitMiB: 256.5 }]) {
    assert.equal(isolation.assessProfile(profile(changed)).reasonCode, 'ENGINE_ISOLATION_PROFILE_UNSAFE');
  }
});

test('hostile shapes fail closed without invoking accessors or coercion', () => {
  let reads = 0;
  const accessor = profile();
  Object.defineProperty(accessor, 'engineId', { enumerable: true, get() { reads += 1; return 'design-engine'; } });
  const coercive = { toString() { reads += 1; return 'NONE'; } };
  for (const value of [null, {}, [], { ...profile(), extra: true }, accessor, profile({ networkAccess: coercive })]) {
    const result = isolation.assessProfile(value);
    assert.match(result.status, /BLOCKED$/u);
    assert.equal(result.activationAllowed, false);
  }
  assert.equal(reads, 0);
});

test('all results are immutable deny-only and module exports no runtime', () => {
  for (const value of [profile(), profile({ filesystemAccess: 'WRITE' }), null]) {
    const result = isolation.assessProfile(value);
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.assuranceGaps));
    assert.equal(result.isolationVerified, false);
    assert.equal(result.loadAllowed || result.executeAllowed || result.activationAllowed, false);
  }
  assert.deepEqual(Object.keys(isolation), ['VERSION', 'assessProfile']);
});
