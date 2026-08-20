'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const validation = require('../engine-validation-harness-contracts.js');

const result = (overrides = {}) => ({ version: validation.VERSION, engineId: 'design-engine', validationProfile: 'content-engine-v1', suiteVersion: '1.0.0', testPlanHash: 'a'.repeat(64), fixtureSetHash: 'b'.repeat(64), resultBundleHash: 'c'.repeat(64), coverageEvidenceHash: 'd'.repeat(64), totalTests: 20, passedTests: 20, failedTests: 0, skippedTests: 0, adversarialCases: 8, executedInVerifiedIsolation: false, independentlyVerified: false, ...overrides });

test('a clean claimed result remains blocked pending independent verification', () => {
  const assessed = validation.assessResult(result());
  assert.equal(assessed.status, 'ENGINE_VALIDATION_ACTIVATION_BLOCKED');
  assert.equal(assessed.reasonCode, 'ENGINE_VALIDATION_EXTERNAL_VERIFICATION_REQUIRED');
  assert.equal(assessed.validationAccepted, false);
  assert.equal(assessed.independentlyVerified, false);
  assert.equal(assessed.ready, false);
  assert.equal(assessed.activationAllowed, false);
  assert.deepEqual(assessed.assuranceGaps, ['VERIFIED_ISOLATION_EXECUTION_REQUIRED', 'INDEPENDENT_RESULT_VERIFICATION_REQUIRED', 'SIGNED_RESULT_BUNDLE_REQUIRED', 'ADVERSARIAL_COVERAGE_REVIEW_REQUIRED', 'REPRODUCIBILITY_EVIDENCE_REQUIRED']);
});

test('rejects inconsistent dirty empty and adversarial-free test claims', () => {
  for (const changed of [{ totalTests: 0, passedTests: 0, adversarialCases: 0 }, { passedTests: 19 }, { adversarialCases: 0 }, { totalTests: 1, passedTests: 1, adversarialCases: 2 }]) assert.equal(validation.assessResult(result(changed)).reasonCode, 'ENGINE_VALIDATION_RESULT_INCONSISTENT');
  for (const changed of [{ passedTests: 19, failedTests: 1 }, { passedTests: 19, skippedTests: 1 }]) assert.equal(validation.assessResult(result(changed)).reasonCode, 'ENGINE_VALIDATION_TESTS_NOT_CLEAN');
  assert.equal(validation.assessResult(result({ totalTests: 1000001, passedTests: 1000001 })).reasonCode, 'ENGINE_VALIDATION_RESULT_INVALID');
});

test('caller cannot self-assert isolation or independent verification', () => {
  for (const changed of [{ executedInVerifiedIsolation: true }, { independentlyVerified: true }, { executedInVerifiedIsolation: 'true' }, { independentlyVerified: 1 }]) {
    assert.equal(validation.assessResult(result(changed)).reasonCode, 'ENGINE_VALIDATION_UNVERIFIED_AUTHORITY_CLAIM');
  }
});

test('test plan fixture result and coverage commitments must be pairwise distinct', () => {
  for (const changed of [{ fixtureSetHash: 'a'.repeat(64) }, { resultBundleHash: 'b'.repeat(64) }, { coverageEvidenceHash: 'c'.repeat(64) }]) {
    const assessed = validation.assessResult(result(changed));
    assert.equal(assessed.reasonCode, 'ENGINE_VALIDATION_EVIDENCE_ROLE_COLLISION');
    assert.deepEqual(assessed.assuranceGaps, ['DISTINCT_TEST_PLAN_FIXTURE_RESULT_AND_COVERAGE_COMMITMENTS_REQUIRED']);
    assert.equal(assessed.activationAllowed, false);
  }
});

test('hostile exact-shape hash count and accessor inputs fail closed without coercion', () => {
  let reads = 0;
  const accessor = result(); Object.defineProperty(accessor, 'engineId', { enumerable: true, get() { reads += 1; return 'design-engine'; } });
  const coercive = { toString() { reads += 1; return 'a'.repeat(64); } };
  const symbolic = result(); symbolic[Symbol('extra')] = true;
  const nonEnumerable = result(); Object.defineProperty(nonEnumerable, 'engineId', { value: 'design-engine', enumerable: false });
  for (const value of [null, {}, [], Object.assign(Object.create(null), result()), { ...result(), extra: true }, symbolic, nonEnumerable, accessor, result({ version: 'wrong' }), result({ testPlanHash: coercive }), result({ totalTests: NaN }), result({ adversarialCases: 1.5 })]) {
    const assessed = validation.assessResult(value);
    assert.match(assessed.status, /BLOCKED$/u);
    assert.equal(assessed.activationAllowed, false);
    assert.notEqual(assessed.reasonCode, 'ENGINE_VALIDATION_EXTERNAL_VERIFICATION_REQUIRED');
  }
  assert.equal(reads, 0);
});

test('all outputs are immutable deny-only and module exposes no runner or verifier', () => {
  for (const value of [result(), result({ failedTests: 1, passedTests: 19 }), null]) {
    const assessed = validation.assessResult(value);
    assert.ok(Object.isFrozen(assessed));
    assert.ok(Object.isFrozen(assessed.assuranceGaps));
    assert.equal(assessed.validationAccepted || assessed.independentlyVerified || assessed.ready || assessed.activationAllowed, false);
  }
  assert.deepEqual(Object.keys(validation), ['VERSION', 'assessResult']);
  assert.ok(Object.isFrozen(validation));
});
