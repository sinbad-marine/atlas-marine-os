'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const contract = require('../voice-synthesis-readiness-contracts.js');
const hash = character => character.repeat(64);
const candidate = (overrides = {}) => ({
  version: contract.VERSION, requestId: 'request-1', tenantId: 'tenant-1',
  personId: 'person-1', voiceProfileRef: 'voice-1', consentRef: 'consent-1',
  disclosureRef: 'disclosure-1', purposeRef: 'training-purpose', languageRef: 'tr',
  authorizedUserRef: 'user-1', referenceAudioHash: hash('a'), modelHash: hash('b'),
  configHash: hash('c'), textHash: hash('d'), requestedAt: 1000, expiresAt: 61000,
  firstByteTimeoutMs: 30000, maxTextLength: 4000, status: 'PENDING_REVIEW', ...overrides
});
const request = (overrides = {}) => ({
  expectedTenantId: 'tenant-1', expectedPersonId: 'person-1',
  expectedVoiceProfileRef: 'voice-1', expectedNow: 2000, request: candidate(), ...overrides
});

test('snapshots and canonically serializes an inert synthesis readiness candidate', () => {
  const value = contract.snapshot(candidate());
  assert.ok(value);
  assert.ok(Object.isFrozen(value));
  assert.deepEqual(contract.deserialize(contract.serialize(value)), value);
});

test('binds request profile reference model config audio and text hashes without paths', () => {
  const value = contract.snapshot(candidate());
  assert.deepEqual(Object.keys(value), contract.FIELDS);
  assert.equal(Object.keys(value).some(field => /path|wav|audioBytes|text$/u.test(field)), false);
  for (const field of ['referenceAudioHash', 'modelHash', 'configHash', 'textHash']) {
    assert.equal(contract.snapshot(candidate({ [field]: 'invalid' })), null);
  }
});

test('rejects hostile accessors prototypes symbols extras coercion and invalid bounds', () => {
  let reads = 0;
  const hostile = candidate();
  Object.defineProperty(hostile, 'voiceProfileRef', { enumerable: true, get() { reads++; return 'voice-1'; } });
  for (const value of [null, {}, [], hostile, Object.assign(Object.create(null), candidate()),
    Object.assign(Object.create({ inherited: true }), candidate()), { ...candidate(), extra: true },
    { ...candidate(), [Symbol('hidden')]: true }, candidate({ firstByteTimeoutMs: '30000' }),
    candidate({ firstByteTimeoutMs: 999 }), candidate({ firstByteTimeoutMs: 120001 }),
    candidate({ maxTextLength: 0 }), candidate({ maxTextLength: 4001 }),
    candidate({ expiresAt: 1000 }), candidate({ requestedAt: 1.5 })]) {
    assert.equal(contract.snapshot(value), null);
  }
  assert.equal(reads, 0);
});

test('scope and trusted time mismatches remain explicitly blocked', () => {
  assert.equal(contract.assess(request({ expectedTenantId: 'other' })).reasonCode, 'VOICE_PROFILE_SCOPE_MISMATCH');
  assert.equal(contract.assess(request({ expectedPersonId: 'other' })).reasonCode, 'VOICE_PROFILE_SCOPE_MISMATCH');
  assert.equal(contract.assess(request({ expectedVoiceProfileRef: 'other' })).reasonCode, 'VOICE_PROFILE_SCOPE_MISMATCH');
  assert.equal(contract.assess(request({ expectedNow: 999 })).reasonCode, 'REQUEST_TIME_INVALID');
  assert.equal(contract.assess(request({ expectedNow: 61000 })).reasonCode, 'REQUEST_TIME_INVALID');
});

test('complete readiness metadata still grants no voice capability', () => {
  const value = contract.assess(request());
  assert.equal(value.reasonCode, 'VOICE_V2_ACTIVATION_ASSURANCE_REQUIRED');
  assert.equal(value.requestId, 'request-1');
  assert.equal(value.voiceProfileRef, 'voice-1');
  assert.ok(value.assuranceGaps.length >= 8);
  for (const [field, enabled] of Object.entries(value)) {
    if (/Verified$|Allowed$|Resolved$/u.test(field)) assert.equal(enabled, false, field);
  }
  assert.ok(Object.isFrozen(value));
  assert.ok(Object.isFrozen(value.assuranceGaps));
});

test('module is private and exposes no runtime operation', () => {
  assert.deepEqual(Object.keys(contract), ['VERSION', 'FIELDS', 'snapshot', 'serialize', 'deserialize', 'assess']);
  assert.equal(require('../package.json').exports?.['./voice-synthesis-readiness-contracts'], undefined);
  for (const key of Object.keys(contract)) assert.doesNotMatch(key, /synthesize|upload|spawn|play|activate|approve/iu);
});
