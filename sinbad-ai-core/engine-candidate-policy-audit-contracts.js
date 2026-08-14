'use strict';

const VERSION = 'sinbad-engine-candidate-policy-audit-binding/1-v1';
const KEYS = Object.freeze(['version', 'engineId', 'candidateEvidenceHash', 'provenancePolicyHash', 'licensePolicyHash', 'isolationProfileHash', 'auditReceiptHash', 'policySignaturesVerified', 'isolationAttestationVerified', 'durableAuditVerified', 'revocationChecked']);
const ID = /^[a-z][a-z0-9-]{2,63}$/u;
const HASH = /^[a-f0-9]{64}$/u;

function blocked(reasonCode, engineId = null, gaps = ['POLICY_AUDIT_BINDING_VALIDATION_REQUIRED']) {
  return Object.freeze({
    version: VERSION,
    status: 'ENGINE_CANDIDATE_POLICY_AUDIT_BLOCKED',
    reasonCode,
    engineId: null,
    policyBindingVerified: false,
    durableAuditVerified: false,
    revocationVerified: false,
    ready: false,
    activationAllowed: false,
    assuranceGaps: Object.freeze([...gaps])
  });
}

function exact(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype || Object.getOwnPropertySymbols(input).length) return null;
  const names = Object.getOwnPropertyNames(input);
  if (names.length !== KEYS.length || KEYS.some(key => !names.includes(key))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (KEYS.some(key => !descriptors[key] || !Object.hasOwn(descriptors[key], 'value'))) return null;
  return Object.fromEntries(KEYS.map(key => [key, descriptors[key].value]));
}

function assessBinding(input) {
  try {
    const value = exact(input);
    if (!value || value.version !== VERSION || !ID.test(value.engineId)) return blocked('ENGINE_CANDIDATE_POLICY_AUDIT_BINDING_INVALID');
    const invalidHashes = ['candidateEvidenceHash', 'provenancePolicyHash', 'licensePolicyHash', 'isolationProfileHash', 'auditReceiptHash'].filter(field => typeof value[field] !== 'string' || !HASH.test(value[field]));
    if (invalidHashes.length) return blocked('ENGINE_CANDIDATE_POLICY_AUDIT_BINDING_INVALID', null, invalidHashes.map(field => `${field.toUpperCase()}_INVALID`));
    const authorityClaims = ['policySignaturesVerified', 'isolationAttestationVerified', 'durableAuditVerified', 'revocationChecked'].filter(field => value[field] !== false);
    if (authorityClaims.length) return blocked('ENGINE_CANDIDATE_UNVERIFIED_AUTHORITY_CLAIM', null, authorityClaims.map(field => `${field.toUpperCase()}_MUST_REMAIN_FALSE`));
    return blocked('ENGINE_CANDIDATE_POLICY_AUDIT_EXTERNAL_VERIFICATION_REQUIRED', value.engineId, [
      'POLICY_SIGNATURE_VERIFICATION_REQUIRED',
      'POLICY_APPLICABILITY_VERIFICATION_REQUIRED',
      'ISOLATION_ATTESTATION_VERIFICATION_REQUIRED',
      'DURABLE_APPEND_ONLY_AUDIT_VERIFICATION_REQUIRED',
      'REVOCATION_STATUS_VERIFICATION_REQUIRED',
      'TRUSTED_TIME_AND_ACTOR_BINDING_REQUIRED'
    ]);
  } catch (_error) {
    return blocked('ENGINE_CANDIDATE_POLICY_AUDIT_ASSESSOR_FAULT');
  }
}

module.exports = Object.freeze({ VERSION, assessBinding });
