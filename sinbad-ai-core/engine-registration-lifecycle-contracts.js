'use strict';

const VERSION = 'sinbad-engine-registration-lifecycle/1-v1';
const KEYS = Object.freeze(['version', 'engineId', 'currentState', 'requestedAction', 'candidateEvidenceHash', 'actorBindingHash', 'auditBindingHash']);
const ID = /^[a-z][a-z0-9-]{2,63}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const STATES = new Set(['UNREGISTERED', 'CANDIDATE', 'QUARANTINED', 'REVOKED']);
const ACTIONS = new Set(['REQUEST_REGISTRATION', 'REQUEST_QUARANTINE', 'REQUEST_REVOCATION']);

function blocked(reasonCode, gaps) {
  return Object.freeze({ version: VERSION, status: 'ENGINE_REGISTRATION_LIFECYCLE_BLOCKED', reasonCode, transitionApplied: false, registrationVerified: false, revocationVerified: false, activationAllowed: false, resultingState: null, assuranceGaps: Object.freeze([...gaps]) });
}

function exact(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype || Object.getOwnPropertySymbols(input).length) return null;
  const names = Object.getOwnPropertyNames(input);
  if (names.length !== KEYS.length || KEYS.some(key => !names.includes(key))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (KEYS.some(key => !descriptors[key] || !Object.hasOwn(descriptors[key], 'value') || descriptors[key].enumerable !== true)) return null;
  return Object.fromEntries(KEYS.map(key => [key, descriptors[key].value]));
}

function assessTransition(input) {
  try {
    const value = exact(input);
    if (!value || value.version !== VERSION || !ID.test(value.engineId) || !STATES.has(value.currentState) || !ACTIONS.has(value.requestedAction)) return blocked('ENGINE_REGISTRATION_REQUEST_INVALID', ['EXACT_LIFECYCLE_REQUEST_REQUIRED']);
    const bindingHashes = ['candidateEvidenceHash', 'actorBindingHash', 'auditBindingHash'].map(field => value[field]);
    for (const [index, field] of ['candidateEvidenceHash', 'actorBindingHash', 'auditBindingHash'].entries()) if (typeof bindingHashes[index] !== 'string' || !HASH.test(bindingHashes[index])) return blocked('ENGINE_REGISTRATION_REQUEST_INVALID', [`${field.toUpperCase()}_INVALID`]);
    if (new Set(bindingHashes).size !== bindingHashes.length) return blocked('ENGINE_REGISTRATION_BINDING_ROLE_COLLISION', ['DISTINCT_CANDIDATE_ACTOR_AND_AUDIT_BINDINGS_REQUIRED']);
    if (value.currentState === 'REVOKED') return blocked('ENGINE_REVOCATION_TERMINAL', ['DURABLE_REVOCATION_MUST_NOT_BE_REVERSED']);
    if (value.requestedAction === 'REQUEST_REVOCATION') return blocked('ENGINE_REVOCATION_PERSISTENCE_REQUIRED', ['DURABLE_REVOCATION_RECEIPT_REQUIRED', 'READ_BACK_INTEGRITY_VERIFICATION_REQUIRED']);
    if (value.requestedAction === 'REQUEST_QUARANTINE') return blocked('ENGINE_QUARANTINE_PERSISTENCE_REQUIRED', ['DURABLE_QUARANTINE_RECEIPT_REQUIRED', 'READ_BACK_INTEGRITY_VERIFICATION_REQUIRED']);
    if (value.currentState === 'QUARANTINED') return blocked('ENGINE_QUARANTINE_CLEARANCE_REQUIRED', ['DURABLE_QUARANTINE_CLEARANCE_RECEIPT_REQUIRED', 'INDEPENDENT_CLEARANCE_VERIFICATION_REQUIRED']);
    return blocked('ENGINE_REGISTRATION_EXTERNAL_AUTHORITY_REQUIRED', ['AUTHENTICATED_REGISTRAR_REQUIRED', 'POLICY_AUDIT_VALIDATION_REQUIRED', 'VALIDATION_HARNESS_VERIFICATION_REQUIRED', 'REVOCATION_CHECK_REQUIRED', 'DURABLE_REGISTRATION_RECEIPT_REQUIRED']);
  } catch (_error) {
    return blocked('ENGINE_REGISTRATION_ASSESSOR_FAULT', ['LIFECYCLE_ASSESSOR_FAULT']);
  }
}

module.exports = Object.freeze({ VERSION, assessTransition });
