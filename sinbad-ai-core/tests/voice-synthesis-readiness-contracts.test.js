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
  expectedVoiceProfileRef: 'voice-1', expectedConsentRef: 'consent-1',
  expectedDisclosureRef: 'disclosure-1', expectedPurposeRef: 'training-purpose',
  expectedLanguageRef: 'tr', expectedAuthorizedUserRef: 'user-1',
  expectedReferenceAudioHash: hash('a'), expectedModelHash: hash('b'),
  expectedConfigHash: hash('c'), expectedTextHash: hash('d'),
  expectedFirstByteTimeoutMs: 30000, expectedMaxTextLength: 4000,
  expectedNow: 2000, request: candidate(), ...overrides
});
const GAPS = [
  'AUTHENTICATED_OWNER_CONSENT_NOT_VERIFIED',
  'REVOCATION_STATE_NOT_VERIFIED',
  'SERVER_CONTROLLED_PROFILE_RESOLUTION_NOT_VERIFIED',
  'REFERENCE_WAV_FORMAT_AND_HASH_NOT_VERIFIED',
  'MODEL_AND_CONFIG_HASH_NOT_VERIFIED',
  'DISCLOSURE_WATERMARK_AND_PROVENANCE_NOT_VERIFIED',
  'QUEUE_TIMEOUT_CANCELLATION_AND_ERASURE_NOT_VERIFIED',
  'INDEPENDENT_SECURITY_PRIVACY_AND_RELEASE_REVIEW_REQUIRED'
];

test('snapshots and canonically serializes an inert synthesis readiness candidate', () => {
  const value = contract.snapshot(candidate());
  assert.ok(value);
  assert.ok(Object.isFrozen(value));
  const wire = contract.serialize(value);
  assert.deepEqual(contract.deserialize(wire), value);
  assert.equal(contract.deserialize(JSON.stringify(candidate(), null, 2)), null);
  const reordered = Object.fromEntries([...Object.entries(candidate())].reverse());
  assert.equal(contract.deserialize(JSON.stringify(reordered)), null);
  assert.equal(contract.deserialize(`${wire} `), null);
  assert.equal(contract.deserialize(`${wire}{}`), null);
  assert.equal(contract.deserialize(wire.replace('"requestId":"request-1"', '"requestId":"other","requestId":"request-1"')), null);
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

test('binds every asserted principal consent artifact and policy value to trusted expectations', () => {
  for (const [field, value, reason] of [
    ['expectedConsentRef', 'other', 'CONSENT_PRINCIPAL_BINDING_MISMATCH'],
    ['expectedAuthorizedUserRef', 'other', 'CONSENT_PRINCIPAL_BINDING_MISMATCH'],
    ['expectedDisclosureRef', 'other', 'DISCLOSURE_PURPOSE_LANGUAGE_BINDING_MISMATCH'],
    ['expectedPurposeRef', 'other', 'DISCLOSURE_PURPOSE_LANGUAGE_BINDING_MISMATCH'],
    ['expectedLanguageRef', 'en', 'DISCLOSURE_PURPOSE_LANGUAGE_BINDING_MISMATCH'],
    ['expectedReferenceAudioHash', hash('e'), 'SYNTHESIS_ARTIFACT_BINDING_MISMATCH'],
    ['expectedModelHash', hash('e'), 'SYNTHESIS_ARTIFACT_BINDING_MISMATCH'],
    ['expectedConfigHash', hash('e'), 'SYNTHESIS_ARTIFACT_BINDING_MISMATCH'],
    ['expectedTextHash', hash('e'), 'SYNTHESIS_ARTIFACT_BINDING_MISMATCH'],
    ['expectedFirstByteTimeoutMs', 20000, 'SYNTHESIS_POLICY_BINDING_MISMATCH'],
    ['expectedMaxTextLength', 2000, 'SYNTHESIS_POLICY_BINDING_MISMATCH']
  ]) assert.equal(contract.assess(request({ [field]: value })).reasonCode, reason, field);
});

test('rejects malformed and hostile assessor envelopes without invoking accessors', () => {
  let reads = 0;
  const hostile = request();
  Object.defineProperty(hostile, 'expectedTenantId', { enumerable: true, get() { reads++; return 'tenant-1'; } });
  for (const value of [null, {}, [], hostile, Object.assign(Object.create(null), request()),
    Object.assign(Object.create({ inherited: true }), request()), { ...request(), extra: true },
    { ...request(), [Symbol('hidden')]: true }, request({ expectedNow: '2000' })]) {
    assert.equal(contract.assess(value).reasonCode, 'REQUEST_INVALID');
  }
  assert.equal(contract.assess(request({ request: { ...candidate(), extra: true } })).reasonCode, 'CANDIDATE_SNAPSHOT_INVALID');
  assert.equal(reads, 0);
});

test('complete readiness metadata still grants no voice capability', () => {
  const value = contract.assess(request());
  assert.equal(value.reasonCode, 'VOICE_V2_ACTIVATION_ASSURANCE_REQUIRED');
  assert.equal(value.requestId, 'request-1');
  assert.equal(value.voiceProfileRef, 'voice-1');
  assert.deepEqual(value.assuranceGaps, GAPS);
  for (const field of ['profileResolved', 'consentVerified', 'referenceAudioVerified',
    'modelVerified', 'conditioningCacheAllowed', 'synthesisAllowed', 'playbackAllowed',
    'activationAllowed']) assert.equal(value[field], false, field);
  assert.ok(Object.isFrozen(value));
  assert.ok(Object.isFrozen(value.assuranceGaps));
});

test('module is private and exposes no runtime operation', () => {
  assert.deepEqual(Object.keys(contract), ['VERSION', 'FIELDS', 'snapshot', 'serialize', 'deserialize', 'assess']);
  const exports = require('../package.json').exports;
  assert.ok(exports && Object.getPrototypeOf(exports) === Object.prototype);
  assert.equal(Object.hasOwn(exports, './voice-synthesis-readiness-contracts'), false);
  assert.equal(Object.values(exports).some(value => String(value).includes('voice-synthesis-readiness-contracts')), false);
  for (const key of Object.keys(contract)) assert.doesNotMatch(key, /synthesize|upload|spawn|play|activate|approve/iu);
});
