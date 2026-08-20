'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../voice-profile-registry-contracts.js');
const h = character => character.repeat(64);
const profile = (overrides = {}) => ({
  version: c.VERSION, profileId: 'voice-1', tenantId: 'tenant-1', personId: 'person-1',
  consentRef: 'consent-1', authorizedUserRef: 'user-1', languageRef: 'tr',
  referenceAudioHash: h('a'), referenceFormat: c.REFERENCE_FORMAT,
  modelHash: h('b'), configHash: h('c'), revocationEpoch: 3,
  createdAt: 1000, expiresAt: 61000, status: 'CANDIDATE', ...overrides
});
const request = (overrides = {}) => ({
  expectedProfileId: 'voice-1', expectedTenantId: 'tenant-1', expectedPersonId: 'person-1',
  expectedConsentRef: 'consent-1', expectedAuthorizedUserRef: 'user-1',
  expectedLanguageRef: 'tr', expectedReferenceAudioHash: h('a'),
  expectedModelHash: h('b'), expectedConfigHash: h('c'),
  expectedRevocationEpoch: 3, expectedNow: 2000, profile: profile(), ...overrides
});

test('canonically snapshots only the fixed hash-addressed profile shape', () => {
  const value = c.snapshot(profile());
  assert.ok(value && Object.isFrozen(value));
  assert.deepEqual(Object.keys(value), c.FIELDS);
  assert.deepEqual(c.deserialize(c.serialize(value)), value);
  assert.equal(Object.keys(value).some(key => /path|bytes|embedding|latent|speaker.?idx/iu.test(key)), false);
});

test('rejects paths raw media unsupported formats and authority-shaped extras', () => {
  for (const value of [profile({ referenceFormat: 'MP3' }), profile({ referenceAudioHash: 'C:\\voice.wav' }),
    { ...profile(), referencePath: 'C:\\voice.wav' }, { ...profile(), audioBytes: 'AAAA' },
    { ...profile(), speakerIdx: 'speaker-1' }, { ...profile(), approved: true }]) {
    assert.equal(c.snapshot(value), null);
  }
});

test('rejects hostile descriptors prototypes symbols coercion and invalid lifetime', () => {
  let reads = 0;
  const hostile = profile();
  Object.defineProperty(hostile, 'profileId', { enumerable: true, get() { reads++; return 'voice-1'; } });
  for (const value of [null, {}, [], hostile, Object.assign(Object.create(null), profile()),
    Object.assign(Object.create({ inherited: true }), profile()), { ...profile(), [Symbol('x')]: true },
    profile({ revocationEpoch: '3' }), profile({ expiresAt: 1000 })]) assert.equal(c.snapshot(value), null);
  assert.equal(reads, 0);
});

test('binds scope authorization artifacts revocation epoch and trusted time', () => {
  for (const [field, value, reason] of [
    ['expectedProfileId', 'other', 'VOICE_PROFILE_SCOPE_MISMATCH'],
    ['expectedTenantId', 'other', 'VOICE_PROFILE_SCOPE_MISMATCH'],
    ['expectedPersonId', 'other', 'VOICE_PROFILE_SCOPE_MISMATCH'],
    ['expectedConsentRef', 'other', 'VOICE_PROFILE_AUTHORIZATION_BINDING_MISMATCH'],
    ['expectedAuthorizedUserRef', 'other', 'VOICE_PROFILE_AUTHORIZATION_BINDING_MISMATCH'],
    ['expectedLanguageRef', 'en', 'VOICE_PROFILE_AUTHORIZATION_BINDING_MISMATCH'],
    ['expectedReferenceAudioHash', h('d'), 'VOICE_PROFILE_ARTIFACT_BINDING_MISMATCH'],
    ['expectedModelHash', h('d'), 'VOICE_PROFILE_ARTIFACT_BINDING_MISMATCH'],
    ['expectedConfigHash', h('d'), 'VOICE_PROFILE_ARTIFACT_BINDING_MISMATCH'],
    ['expectedRevocationEpoch', 4, 'VOICE_PROFILE_REVOCATION_EPOCH_MISMATCH'],
    ['expectedNow', 999, 'VOICE_PROFILE_TIME_INVALID'], ['expectedNow', 61000, 'VOICE_PROFILE_TIME_INVALID']
  ]) assert.equal(c.assess(request({ [field]: value })).reasonCode, reason, field);
});

test('a complete profile remains unresolved and grants no capability or path', () => {
  const value = c.assess(request());
  assert.equal(value.reasonCode, 'SERVER_PROFILE_CUSTODY_CONSENT_REVOCATION_AND_RELEASE_ASSURANCE_REQUIRED');
  assert.equal(value.profileId, 'voice-1');
  assert.equal(value.referenceAudioHash, h('a'));
  for (const field of ['profileResolved', 'referencePathDisclosed', 'referenceAudioVerified',
    'consentVerified', 'revocationVerified', 'modelVerified', 'synthesisAllowed',
    'playbackAllowed', 'activationAllowed']) assert.equal(value[field], false, field);
  assert.ok(Object.isFrozen(value));
});

test('module is private and exposes no resolver storage upload or runtime operation', () => {
  assert.deepEqual(Object.keys(c), ['VERSION', 'REFERENCE_FORMAT', 'FIELDS', 'snapshot', 'serialize', 'deserialize', 'assess']);
  const exports = require('../package.json').exports;
  assert.equal(Object.hasOwn(exports, './voice-profile-registry-contracts'), false);
  assert.equal(Object.values(exports).some(value => String(value).includes('voice-profile-registry-contracts')), false);
  for (const key of Object.keys(c)) assert.doesNotMatch(key, /resolve|store|upload|spawn|synth|play|activate|approve/iu);
});
