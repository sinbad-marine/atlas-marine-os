'use strict';

const VERSION = 'sinbad-voice-profile-registry/2b-v1';
const REFERENCE_FORMAT = 'WAV_PCM_S16LE_MONO_22050';
const FIELDS = Object.freeze([
  'version', 'profileId', 'tenantId', 'personId', 'consentRef',
  'authorizedUserRef', 'languageRef', 'referenceAudioHash',
  'referenceFormat', 'modelHash', 'configHash', 'revocationEpoch',
  'createdAt', 'expiresAt', 'status'
]);
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const id = value => typeof value === 'string' && ID.test(value);
const hash = value => typeof value === 'string' && HASH.test(value);
const time = value => Number.isSafeInteger(value) && value >= 0;

function snapshot(input) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.getPrototypeOf(input) !== Object.prototype ||
        Object.getOwnPropertySymbols(input).length) return null;
    const names = Object.getOwnPropertyNames(input);
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (names.length !== FIELDS.length || FIELDS.some(field =>
      !names.includes(field) || !descriptors[field] ||
      !Object.hasOwn(descriptors[field], 'value') || !descriptors[field].enumerable)) return null;
    const value = Object.fromEntries(FIELDS.map(field => [field, descriptors[field].value]));
    if (value.version !== VERSION || value.referenceFormat !== REFERENCE_FORMAT ||
        value.status !== 'CANDIDATE') return null;
    for (const field of ['profileId', 'tenantId', 'personId', 'consentRef',
      'authorizedUserRef', 'languageRef']) if (!id(value[field])) return null;
    for (const field of ['referenceAudioHash', 'modelHash', 'configHash']) {
      if (!hash(value[field])) return null;
    }
    if (!Number.isSafeInteger(value.revocationEpoch) || value.revocationEpoch < 0 ||
        !time(value.createdAt) || !time(value.expiresAt) || value.expiresAt <= value.createdAt) return null;
    return Object.freeze(value);
  } catch {
    return null;
  }
}

function serialize(input) {
  const value = snapshot(input);
  return value ? JSON.stringify(value) : null;
}

function deserialize(text) {
  if (typeof text !== 'string' || text.length > 32768) return null;
  try {
    const value = snapshot(JSON.parse(text));
    return value && serialize(value) === text ? value : null;
  } catch {
    return null;
  }
}

function assess(input) {
  const blocked = (reasonCode, profile = null) => Object.freeze({
    version: VERSION,
    status: 'VOICE_PROFILE_RESOLUTION_BLOCKED',
    reasonCode,
    profileId: profile?.profileId ?? null,
    referenceAudioHash: profile?.referenceAudioHash ?? null,
    profileResolved: false,
    referencePathDisclosed: false,
    referenceAudioVerified: false,
    consentVerified: false,
    revocationVerified: false,
    modelVerified: false,
    synthesisAllowed: false,
    playbackAllowed: false,
    activationAllowed: false
  });
  try {
    const fields = [
      'expectedProfileId', 'expectedTenantId', 'expectedPersonId',
      'expectedConsentRef', 'expectedAuthorizedUserRef', 'expectedLanguageRef',
      'expectedReferenceAudioHash', 'expectedModelHash', 'expectedConfigHash',
      'expectedRevocationEpoch', 'expectedNow', 'profile'
    ];
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.getPrototypeOf(input) !== Object.prototype ||
        Object.getOwnPropertySymbols(input).length) return blocked('REQUEST_INVALID');
    const names = Object.getOwnPropertyNames(input);
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (names.length !== fields.length || fields.some(field =>
      !names.includes(field) || !descriptors[field] ||
      !Object.hasOwn(descriptors[field], 'value') || !descriptors[field].enumerable)) {
      return blocked('REQUEST_INVALID');
    }
    for (const field of ['expectedProfileId', 'expectedTenantId', 'expectedPersonId',
      'expectedConsentRef', 'expectedAuthorizedUserRef', 'expectedLanguageRef']) {
      if (!id(descriptors[field].value)) return blocked('REQUEST_INVALID');
    }
    for (const field of ['expectedReferenceAudioHash', 'expectedModelHash', 'expectedConfigHash']) {
      if (!hash(descriptors[field].value)) return blocked('REQUEST_INVALID');
    }
    if (!Number.isSafeInteger(descriptors.expectedRevocationEpoch.value) ||
        descriptors.expectedRevocationEpoch.value < 0 || !time(descriptors.expectedNow.value)) {
      return blocked('REQUEST_INVALID');
    }
    const profile = snapshot(descriptors.profile.value);
    if (!profile) return blocked('CANDIDATE_SNAPSHOT_INVALID');
    if (profile.profileId !== descriptors.expectedProfileId.value ||
        profile.tenantId !== descriptors.expectedTenantId.value ||
        profile.personId !== descriptors.expectedPersonId.value) {
      return blocked('VOICE_PROFILE_SCOPE_MISMATCH');
    }
    if (profile.consentRef !== descriptors.expectedConsentRef.value ||
        profile.authorizedUserRef !== descriptors.expectedAuthorizedUserRef.value ||
        profile.languageRef !== descriptors.expectedLanguageRef.value) {
      return blocked('VOICE_PROFILE_AUTHORIZATION_BINDING_MISMATCH');
    }
    if (profile.referenceAudioHash !== descriptors.expectedReferenceAudioHash.value ||
        profile.modelHash !== descriptors.expectedModelHash.value ||
        profile.configHash !== descriptors.expectedConfigHash.value) {
      return blocked('VOICE_PROFILE_ARTIFACT_BINDING_MISMATCH');
    }
    if (profile.revocationEpoch !== descriptors.expectedRevocationEpoch.value) {
      return blocked('VOICE_PROFILE_REVOCATION_EPOCH_MISMATCH');
    }
    if (profile.createdAt > descriptors.expectedNow.value || profile.expiresAt <= descriptors.expectedNow.value) {
      return blocked('VOICE_PROFILE_TIME_INVALID');
    }
    return blocked('SERVER_PROFILE_CUSTODY_CONSENT_REVOCATION_AND_RELEASE_ASSURANCE_REQUIRED', profile);
  } catch {
    return blocked('ASSESSOR_FAULT');
  }
}

module.exports = Object.freeze({ VERSION, REFERENCE_FORMAT, FIELDS, snapshot, serialize, deserialize, assess });
