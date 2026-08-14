'use strict';

const VERSION = 'sinbad-universal-core-public-api-gate/1-v1';
const CONTRACT_VERSION = 'sinbad-universal-core-public-api/1-draft';
const PACKAGE_NAME = '@sinbad-ai/core';
const ALLOWED_FIELDS = Object.freeze([
  'version',
  'packageName',
  'contractVersion',
  'compatibilityEvidenceHash',
  'securityReviewEvidenceHash',
  'releaseDecisionId'
]);
const HASH = /^[a-f0-9]{64}$/u;
const DECISION_ID = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;

function blocked(reasonCode, gaps) {
  return Object.freeze({
    version: VERSION,
    status: 'UNIVERSAL_CORE_PUBLIC_API_PUBLICATION_BLOCKED',
    reasonCode,
    publishAllowed: false,
    packageName: PACKAGE_NAME,
    contractVersion: CONTRACT_VERSION,
    assuranceGaps: Object.freeze([...gaps])
  });
}

function isPlainRecord(value) {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}

function hasSafeShape(value) {
  if (!isPlainRecord(value)) return false;
  const names = Object.getOwnPropertyNames(value);
  if (Object.getOwnPropertySymbols(value).length || names.length !== ALLOWED_FIELDS.length) return false;
  if (names.some(name => !ALLOWED_FIELDS.includes(name))) return false;
  return names.every(name => {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    return descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable;
  });
}

function assessPublicationRequest(candidate) {
  if (!hasSafeShape(candidate)) {
    return blocked('UNIVERSAL_CORE_PUBLIC_API_REQUEST_INVALID', ['STRICT_REQUEST_VALIDATION_REQUIRED']);
  }
  if (ALLOWED_FIELDS.some(field => typeof candidate[field] !== 'string' || candidate[field].length > 128)) {
    return blocked('UNIVERSAL_CORE_PUBLIC_API_REQUEST_INVALID', ['STRING_FIELD_VALIDATION_REQUIRED']);
  }
  if (
    candidate.version !== VERSION ||
    candidate.packageName !== PACKAGE_NAME ||
    candidate.contractVersion !== CONTRACT_VERSION ||
    !HASH.test(candidate.compatibilityEvidenceHash) ||
    !HASH.test(candidate.securityReviewEvidenceHash) ||
    !DECISION_ID.test(candidate.releaseDecisionId)
  ) {
    return blocked('UNIVERSAL_CORE_PUBLIC_API_REQUEST_INVALID', ['BINDING_RELEASE_EVIDENCE_REQUIRED']);
  }
  return blocked('UNIVERSAL_CORE_PUBLIC_API_RELEASE_DECISION_REQUIRED', [
    'SIGNED_COMPATIBILITY_EVIDENCE_NOT_VERIFIED',
    'SIGNED_SECURITY_REVIEW_NOT_VERIFIED',
    'EXPLICIT_RELEASE_DECISION_NOT_VERIFIED',
    'PACKED_CONSUMER_FIXTURE_NOT_VERIFIED'
  ]);
}

module.exports = Object.freeze({ VERSION, CONTRACT_VERSION, PACKAGE_NAME, assessPublicationRequest });
