'use strict';

const catalogModule = require('./engine-port-candidate-catalog.js');
const evidenceModule = require('./engine-port-candidate-decision-evidence.js');
const isolationModule = require('./engine-isolation-profile-contracts.js');
const VERSION = 'sinbad-engine-candidate-readiness-composition/1-v1';

function normalizeGaps(gaps) {
  if (!Array.isArray(gaps) || gaps.length === 0) return ['MALFORMED_ASSURANCE_GAPS'];
  const strings = gaps.filter(gap => typeof gap === 'string' && gap.length > 0);
  if (strings.length !== gaps.length) strings.push('MALFORMED_ASSURANCE_GAPS');
  return [...new Set(strings)].sort();
}

function blocked(reasonCode, gaps) {
  return Object.freeze({
    version: VERSION,
    status: 'ENGINE_CANDIDATE_READINESS_BLOCKED',
    reasonCode,
    ready: false,
    loadAllowed: false,
    executeAllowed: false,
    activationAllowed: false,
    assuranceGaps: Object.freeze(normalizeGaps(gaps))
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
  try {
    const value = exactInput(input);
    if (!value) return blocked('ENGINE_CANDIDATE_COMPOSITION_INVALID', ['EXACT_COMPOSITION_INPUT_REQUIRED']);
    const catalogEntry = catalogModule.create().consider(value.manifest);
    if (!catalogModule.isAuthenticEntry(catalogEntry)) return blocked('ENGINE_CANDIDATE_MANIFEST_REJECTED', catalogEntry?.assuranceGaps);
    const sealed = evidenceModule.seal(catalogEntry);
    const verified = evidenceModule.verify(sealed);
    if (verified.status !== 'ENGINE_PORT_CANDIDATE_EVIDENCE_VERIFIED_BLOCKED' || verified.activationAllowed !== false) {
      return blocked('ENGINE_CANDIDATE_EVIDENCE_REJECTED', ['AUTHENTIC_CANDIDATE_EVIDENCE_REQUIRED']);
    }
    const isolation = isolationModule.assessProfile(value.isolationProfile);
    if (isolation.engineId !== catalogEntry.engineId) return blocked('ENGINE_CANDIDATE_ISOLATION_IDENTITY_MISMATCH', ['ENGINE_ID_BINDING_REQUIRED']);
    if (isolation.reasonCode !== 'ENGINE_ISOLATION_ENFORCEMENT_UNVERIFIED' || isolation.isolationVerified !== false || isolation.activationAllowed !== false) {
      return blocked('ENGINE_CANDIDATE_ISOLATION_REJECTED', isolation.assuranceGaps);
    }
    return blocked('ENGINE_CANDIDATE_EXTERNAL_ASSURANCE_REQUIRED', [
      ...normalizeGaps(catalogEntry.assuranceGaps),
      ...normalizeGaps(isolation.assuranceGaps),
      'DURABLE_AUDIT_REQUIRED',
      'EXPLICIT_ACTIVATION_DECISION_REQUIRED'
    ]);
  } catch (_error) {
    return blocked('ENGINE_CANDIDATE_COMPOSITION_FAULT', ['DEPENDENCY_OR_INPUT_FAULT']);
  }
}

module.exports = Object.freeze({ VERSION, assess });
