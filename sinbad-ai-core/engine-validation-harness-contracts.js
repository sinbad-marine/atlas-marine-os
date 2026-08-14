'use strict';

const VERSION = 'sinbad-engine-validation-harness/1-v1';
const KEYS = Object.freeze(['version', 'engineId', 'validationProfile', 'suiteVersion', 'testPlanHash', 'fixtureSetHash', 'resultBundleHash', 'coverageEvidenceHash', 'totalTests', 'passedTests', 'failedTests', 'skippedTests', 'adversarialCases', 'executedInVerifiedIsolation', 'independentlyVerified']);
const ID = /^[a-z][a-z0-9-]{2,63}$/u;
const SEMVER = /^\d+\.\d+\.\d+$/u;
const HASH = /^[a-f0-9]{64}$/u;

function blocked(reasonCode, gaps = ['VALIDATION_HARNESS_INPUT_REQUIRED']) {
  return Object.freeze({
    version: VERSION,
    status: 'ENGINE_VALIDATION_ACTIVATION_BLOCKED',
    reasonCode,
    validationAccepted: false,
    independentlyVerified: false,
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

function assessResult(input) {
  try {
    const value = exact(input);
    if (!value || value.version !== VERSION || !ID.test(value.engineId) || !ID.test(value.validationProfile) || !SEMVER.test(value.suiteVersion)) return blocked('ENGINE_VALIDATION_RESULT_INVALID');
    for (const field of ['testPlanHash', 'fixtureSetHash', 'resultBundleHash', 'coverageEvidenceHash']) if (typeof value[field] !== 'string' || !HASH.test(value[field])) return blocked('ENGINE_VALIDATION_RESULT_INVALID', [`${field.toUpperCase()}_INVALID`]);
    for (const field of ['totalTests', 'passedTests', 'failedTests', 'skippedTests', 'adversarialCases']) if (!Number.isSafeInteger(value[field]) || value[field] < 0 || value[field] > 1000000) return blocked('ENGINE_VALIDATION_RESULT_INVALID', [`${field.toUpperCase()}_INVALID`]);
    if (value.totalTests < 1 || value.adversarialCases < 1 || value.passedTests + value.failedTests + value.skippedTests !== value.totalTests) return blocked('ENGINE_VALIDATION_RESULT_INCONSISTENT', ['NONEMPTY_BALANCED_TEST_COUNTS_REQUIRED']);
    if (value.failedTests !== 0 || value.skippedTests !== 0) return blocked('ENGINE_VALIDATION_TESTS_NOT_CLEAN', ['ZERO_FAILED_AND_SKIPPED_TESTS_REQUIRED']);
    if (value.executedInVerifiedIsolation !== false || value.independentlyVerified !== false) return blocked('ENGINE_VALIDATION_UNVERIFIED_AUTHORITY_CLAIM', ['VERIFIER_PRODUCED_ATTESTATIONS_REQUIRED']);
    return blocked('ENGINE_VALIDATION_EXTERNAL_VERIFICATION_REQUIRED', [
      'VERIFIED_ISOLATION_EXECUTION_REQUIRED',
      'INDEPENDENT_RESULT_VERIFICATION_REQUIRED',
      'SIGNED_RESULT_BUNDLE_REQUIRED',
      'ADVERSARIAL_COVERAGE_REVIEW_REQUIRED',
      'REPRODUCIBILITY_EVIDENCE_REQUIRED'
    ]);
  } catch (_error) {
    return blocked('ENGINE_VALIDATION_ASSESSOR_FAULT', ['VALIDATION_ASSESSOR_FAULT']);
  }
}

module.exports = Object.freeze({ VERSION, assessResult });
