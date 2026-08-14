'use strict';

const catalogModule = require('./engine-port-candidate-catalog.js');
const evidenceModule = require('./engine-port-candidate-decision-evidence.js');
const isolationModule = require('./engine-isolation-profile-contracts.js');
const VERSION = 'sinbad-engine-candidate-readiness-composition/1-v1';

function blocked(reasonCode, gaps) {
  return Object.freeze({
    version: VERSION,
    status: 'ENGINE_CANDIDATE_READINESS_BLOCKED',
    reasonCode,
    ready: false,
    loadAllowed: false,
    executeAllowed: false,
    activationAllowed: false,
    assuranceGaps: Object.freeze([...new Set(gaps.filter(gap => typeof gap === 'string'))].sort())
  });
}

function exactInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype || Object.getOwnPropertySymbols(input).length) return null;
  const names = Object.getOwnPropertyNames(input);
  if (names.length !== 2 || !names.includes('manifest') || !names.includes('isolationProfile')) return null;
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (!Object.hasOwn(descriptors.manifest, 'value') || !Object.hasOwn(descriptors.isolationProfile, 'value')) return null;
  return { manifest: descriptors.manifest.value, isolationProfile: descriptors.isolationProfile.value };
}

function assess(input) {
  const value = exactInput(input);
  if (!value) return blocked('ENGINE_CANDIDATE_COMPOSITION_INVALID', ['EXACT_COMPOSITION_INPUT_REQUIRED']);
  const catalogEntry = catalogModule.create().consider(value.manifest);
  if (!catalogModule.isAuthenticEntry(catalogEntry)) return blocked('ENGINE_CANDIDATE_MANIFEST_REJECTED', catalogEntry.assuranceGaps || ['CATALOG_ENTRY_REQUIRED']);
  const sealed = evidenceModule.seal(catalogEntry);
  const verified = evidenceModule.verify(sealed);
  if (verified.status !== 'ENGINE_PORT_CANDIDATE_EVIDENCE_VERIFIED_BLOCKED' || verified.activationAllowed !== false) {
    return blocked('ENGINE_CANDIDATE_EVIDENCE_REJECTED', ['AUTHENTIC_CANDIDATE_EVIDENCE_REQUIRED']);
  }
  const isolation = isolationModule.assessProfile(value.isolationProfile);
  if (isolation.engineId !== catalogEntry.engineId) return blocked('ENGINE_CANDIDATE_ISOLATION_IDENTITY_MISMATCH', ['ENGINE_ID_BINDING_REQUIRED']);
  if (isolation.reasonCode !== 'ENGINE_ISOLATION_ENFORCEMENT_UNVERIFIED' || isolation.isolationVerified !== false || isolation.activationAllowed !== false) {
    return blocked('ENGINE_CANDIDATE_ISOLATION_REJECTED', isolation.assuranceGaps || ['SAFE_ISOLATION_PROFILE_REQUIRED']);
  }
  return blocked('ENGINE_CANDIDATE_EXTERNAL_ASSURANCE_REQUIRED', [
    ...catalogEntry.assuranceGaps,
    ...isolation.assuranceGaps,
    'DURABLE_AUDIT_REQUIRED',
    'EXPLICIT_ACTIVATION_DECISION_REQUIRED'
  ]);
}

module.exports = Object.freeze({ VERSION, assess });
