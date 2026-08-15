'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const gate = require('../universal-core-public-api-gate.js');
const manifest = require('../package.json');

const request = (overrides = {}) => ({
  version: gate.VERSION,
  packageName: gate.PACKAGE_NAME,
  contractVersion: gate.CONTRACT_VERSION,
  compatibilityEvidenceHash: 'a'.repeat(64),
  securityReviewEvidenceHash: 'b'.repeat(64),
  releaseDecisionId: 'release-decision:draft-001',
  ...overrides
});

test('exports only constants and a deny-only publication assessment', () => {
  assert.deepEqual(Object.keys(gate), ['VERSION', 'CONTRACT_VERSION', 'PACKAGE_NAME', 'assessPublicationRequest']);
  assert.ok(Object.isFrozen(gate));
  assert.equal(gate.PACKAGE_NAME, '@sinbad-ai/core');
  assert.equal(manifest.private, true);
  assert.equal(typeof manifest.exports, 'object');
  assert.equal(Array.isArray(manifest.exports), false);
  assert.equal(Object.hasOwn(manifest.exports, './universal-core-public-api-gate'), false);
  assert.notEqual(manifest.main, './universal-core-public-api-gate.js');
});

test('a structurally complete request remains publication-blocked', () => {
  const result = gate.assessPublicationRequest(request());
  assert.equal(result.status, 'UNIVERSAL_CORE_PUBLIC_API_PUBLICATION_BLOCKED');
  assert.equal(result.reasonCode, 'UNIVERSAL_CORE_PUBLIC_API_RELEASE_DECISION_REQUIRED');
  assert.equal(result.publishAllowed, false);
  assert.equal(result.assuranceGaps.includes('EXPLICIT_RELEASE_DECISION_NOT_VERIFIED'), true);
});

test('compatibility and security review require distinct evidence commitments', () => {
  const result = gate.assessPublicationRequest(request({ securityReviewEvidenceHash: 'a'.repeat(64) }));
  assert.equal(result.reasonCode, 'UNIVERSAL_CORE_PUBLIC_API_REQUEST_INVALID');
  assert.deepEqual(result.assuranceGaps, ['BINDING_RELEASE_EVIDENCE_REQUIRED']);
  assert.equal(result.publishAllowed, false);
});

test('invalid hostile and accessor inputs fail closed without invoking accessors', () => {
  let reads = 0;
  const accessor = request();
  Object.defineProperty(accessor, 'packageName', { enumerable: true, get() { reads += 1; return gate.PACKAGE_NAME; } });
  for (const value of [null, {}, request({ extra: true }), request({ packageName: '@sinbad-ai/other' }), accessor]) {
    const result = gate.assessPublicationRequest(value);
    assert.equal(result.reasonCode, 'UNIVERSAL_CORE_PUBLIC_API_REQUEST_INVALID');
    assert.equal(result.publishAllowed, false);
  }
  assert.equal(reads, 0);
});

test('every result is immutable and cannot mint publication authority', () => {
  const mutations = [request(), null, {}, request({ compatibilityEvidenceHash: 'bad' })];
  for (const field of ['version', 'packageName', 'contractVersion', 'compatibilityEvidenceHash', 'securityReviewEvidenceHash', 'releaseDecisionId']) {
    for (const value of [null, false, 0, {}, [], 'x'.repeat(129)]) mutations.push(request({ [field]: value }));
  }
  for (const value of mutations) {
    const result = gate.assessPublicationRequest(value);
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.assuranceGaps));
    assert.match(result.status, /BLOCKED$/u);
    assert.equal(result.publishAllowed, false);
    assert.ok(result.assuranceGaps.length > 0);
  }
});

test('does not coerce hostile field values during validation', () => {
  let coercions = 0;
  const hostile = { toString() { coercions += 1; return 'a'.repeat(64); } };
  const result = gate.assessPublicationRequest(request({ compatibilityEvidenceHash: hostile }));
  assert.equal(result.reasonCode, 'UNIVERSAL_CORE_PUBLIC_API_REQUEST_INVALID');
  assert.equal(coercions, 0);
});
