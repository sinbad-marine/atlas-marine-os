'use strict';

const VERSION = 'sinbad-engine-final-activation-denial-gate/1-v1';
const KEYS = Object.freeze(['version', 'engineId', 'registrationReceiptHash', 'revocationStatusHash', 'policyAuditReceiptHash', 'validationReceiptHash', 'isolationAttestationHash']);
const ID = /^[a-z][a-z0-9-]{2,63}$/u;
const HASH = /^[a-f0-9]{64}$/u;

function denied(reasonCode, gaps) {
  return Object.freeze({ version: VERSION, status: 'ENGINE_ACTIVATION_DENIED', reasonCode, registered: false, revoked: false, ready: false, loadAllowed: false, executeAllowed: false, activationAllowed: false, allowedModes: Object.freeze([]), assuranceGaps: Object.freeze([...gaps]) });
}

function assess(input) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype || Object.getOwnPropertySymbols(input).length) return denied('ENGINE_ACTIVATION_REQUEST_INVALID', ['EXACT_FINAL_GATE_INPUT_REQUIRED']);
    const names = Object.getOwnPropertyNames(input), descriptors = Object.getOwnPropertyDescriptors(input);
    if (names.length !== KEYS.length || KEYS.some(key => !names.includes(key) || !descriptors[key] || !Object.hasOwn(descriptors[key], 'value') || descriptors[key].enumerable !== true)) return denied('ENGINE_ACTIVATION_REQUEST_INVALID', ['EXACT_FINAL_GATE_INPUT_REQUIRED']);
    const value = Object.fromEntries(KEYS.map(key => [key, descriptors[key].value]));
    if (value.version !== VERSION || !ID.test(value.engineId) || KEYS.slice(2).some(key => typeof value[key] !== 'string' || !HASH.test(value[key]))) return denied('ENGINE_ACTIVATION_REQUEST_INVALID', ['BOUND_VERIFIER_RECEIPTS_REQUIRED']);
    return denied('ENGINE_ACTIVATION_EXPLICIT_DECISION_REQUIRED', ['RECEIPT_AUTHENTICITY_UNVERIFIED', 'RECEIPT_CROSS_BINDING_UNVERIFIED', 'REVOCATION_STATUS_UNVERIFIED', 'EXPLICIT_ACTIVATION_AUTHORITY_ABSENT']);
  } catch (_error) {
    return denied('ENGINE_ACTIVATION_GATE_FAULT', ['FINAL_GATE_FAULT']);
  }
}

module.exports = Object.freeze({ VERSION, assess });
