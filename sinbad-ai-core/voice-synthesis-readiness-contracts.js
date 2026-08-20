'use strict';

const VERSION = 'sinbad-voice-synthesis-readiness/2a-v1';
const FIELDS = Object.freeze([
  'version', 'requestId', 'tenantId', 'personId', 'voiceProfileRef',
  'consentRef', 'disclosureRef', 'purposeRef', 'languageRef',
  'authorizedUserRef', 'referenceAudioHash', 'modelHash', 'configHash',
  'textHash', 'requestedAt', 'expiresAt', 'firstByteTimeoutMs',
  'maxTextLength', 'status'
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
    if (value.version !== VERSION || value.status !== 'PENDING_REVIEW') return null;
    for (const field of ['requestId', 'tenantId', 'personId', 'voiceProfileRef',
      'consentRef', 'disclosureRef', 'purposeRef', 'languageRef', 'authorizedUserRef']) {
      if (!id(value[field])) return null;
    }
    for (const field of ['referenceAudioHash', 'modelHash', 'configHash', 'textHash']) {
      if (!hash(value[field])) return null;
    }
    if (!time(value.requestedAt) || !time(value.expiresAt) || value.expiresAt <= value.requestedAt ||
        !Number.isSafeInteger(value.firstByteTimeoutMs) || value.firstByteTimeoutMs < 1000 || value.firstByteTimeoutMs > 120000 ||
        !Number.isSafeInteger(value.maxTextLength) || value.maxTextLength < 1 || value.maxTextLength > 4000) return null;
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
  const blocked = (reasonCode, request = null, gaps = []) => Object.freeze({
    version: VERSION,
    status: 'VOICE_SYNTHESIS_READINESS_BLOCKED',
    reasonCode,
    requestId: request?.requestId ?? null,
    voiceProfileRef: request?.voiceProfileRef ?? null,
    assuranceGaps: Object.freeze([...gaps]),
    profileResolved: false,
    consentVerified: false,
    referenceAudioVerified: false,
    modelVerified: false,
    conditioningCacheAllowed: false,
    synthesisAllowed: false,
    playbackAllowed: false,
    activationAllowed: false
  });
  try {
    const expectedFields = ['expectedTenantId', 'expectedPersonId', 'expectedVoiceProfileRef', 'expectedNow', 'request'];
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.getPrototypeOf(input) !== Object.prototype || Object.getOwnPropertySymbols(input).length) {
      return blocked('REQUEST_INVALID');
    }
    const names = Object.getOwnPropertyNames(input);
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (names.length !== expectedFields.length || expectedFields.some(field =>
      !names.includes(field) || !descriptors[field] || !Object.hasOwn(descriptors[field], 'value') ||
      !descriptors[field].enumerable)) return blocked('REQUEST_INVALID');
    if (!id(descriptors.expectedTenantId.value) || !id(descriptors.expectedPersonId.value) ||
        !id(descriptors.expectedVoiceProfileRef.value) || !time(descriptors.expectedNow.value)) {
      return blocked('REQUEST_INVALID');
    }
    const request = snapshot(descriptors.request.value);
    if (!request) return blocked('CANDIDATE_SNAPSHOT_INVALID');
    if (request.tenantId !== descriptors.expectedTenantId.value ||
        request.personId !== descriptors.expectedPersonId.value ||
        request.voiceProfileRef !== descriptors.expectedVoiceProfileRef.value) {
      return blocked('VOICE_PROFILE_SCOPE_MISMATCH', request);
    }
    if (request.requestedAt > descriptors.expectedNow.value || request.expiresAt <= descriptors.expectedNow.value) {
      return blocked('REQUEST_TIME_INVALID', request);
    }
    return blocked('VOICE_V2_ACTIVATION_ASSURANCE_REQUIRED', request, [
      'AUTHENTICATED_OWNER_CONSENT_NOT_VERIFIED',
      'REVOCATION_STATE_NOT_VERIFIED',
      'SERVER_CONTROLLED_PROFILE_RESOLUTION_NOT_VERIFIED',
      'REFERENCE_WAV_FORMAT_AND_HASH_NOT_VERIFIED',
      'MODEL_AND_CONFIG_HASH_NOT_VERIFIED',
      'DISCLOSURE_WATERMARK_AND_PROVENANCE_NOT_VERIFIED',
      'QUEUE_TIMEOUT_CANCELLATION_AND_ERASURE_NOT_VERIFIED',
      'INDEPENDENT_SECURITY_PRIVACY_AND_RELEASE_REVIEW_REQUIRED'
    ]);
  } catch {
    return blocked('ASSESSOR_FAULT');
  }
}

module.exports = Object.freeze({ VERSION, FIELDS, snapshot, serialize, deserialize, assess });
