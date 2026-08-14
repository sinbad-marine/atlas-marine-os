'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const contracts = require('../engine-candidate-policy-audit-contracts.js');

const binding = (overrides = {}) => ({ version: contracts.VERSION, engineId: 'design-engine', candidateEvidenceHash: 'a'.repeat(64), provenancePolicyHash: 'b'.repeat(64), licensePolicyHash: 'c'.repeat(64), isolationProfileHash: 'd'.repeat(64), auditReceiptHash: 'e'.repeat(64), policySignaturesVerified: false, isolationAttestationVerified: false, durableAuditVerified: false, revocationChecked: false, ...overrides });

test('complete hash commitments remain blocked pending external verification', () => {
  const result = contracts.assessBinding(binding());
  assert.equal(result.status, 'ENGINE_CANDIDATE_POLICY_AUDIT_BLOCKED');
  assert.equal(result.reasonCode, 'ENGINE_CANDIDATE_POLICY_AUDIT_EXTERNAL_VERIFICATION_REQUIRED');
  assert.equal(result.engineId, null);
  assert.equal(result.policyBindingVerified, false);
  assert.equal(result.durableAuditVerified, false);
  assert.equal(result.revocationVerified, false);
  assert.equal(result.ready, false);
  assert.equal(result.activationAllowed, false);
  assert.deepEqual(result.assuranceGaps, ['POLICY_SIGNATURE_VERIFICATION_REQUIRED', 'POLICY_APPLICABILITY_VERIFICATION_REQUIRED', 'ISOLATION_ATTESTATION_VERIFICATION_REQUIRED', 'DURABLE_APPEND_ONLY_AUDIT_VERIFICATION_REQUIRED', 'REVOCATION_STATUS_VERIFICATION_REQUIRED', 'TRUSTED_TIME_AND_ACTOR_BINDING_REQUIRED']);
});

test('cannot self-assert verified signatures attestation audit or revocation', () => {
  for (const field of ['policySignaturesVerified', 'isolationAttestationVerified', 'durableAuditVerified', 'revocationChecked']) {
    const result = contracts.assessBinding(binding({ [field]: true }));
    assert.equal(result.reasonCode, 'ENGINE_CANDIDATE_UNVERIFIED_AUTHORITY_CLAIM');
    assert.equal(result.activationAllowed, false);
  }
  const multiple = contracts.assessBinding(binding({ policySignaturesVerified: true, durableAuditVerified: true }));
  assert.deepEqual(multiple.assuranceGaps, ['POLICYSIGNATURESVERIFIED_MUST_REMAIN_FALSE', 'DURABLEAUDITVERIFIED_MUST_REMAIN_FALSE']);
});

test('rejects malformed hashes exact-shape violations and coercion without invoking accessors', () => {
  let reads = 0;
  const accessor = binding(); Object.defineProperty(accessor, 'engineId', { enumerable: true, get() { reads += 1; return 'design-engine'; } });
  const coercive = { toString() { reads += 1; return 'a'.repeat(64); } };
  const symbol = binding(); symbol[Symbol('extra')] = true;
  const missing = binding(); delete missing.engineId;
  for (const value of [null, {}, [], Object.assign(Object.create(null), binding()), { ...binding(), extra: true }, symbol, missing, accessor, binding({ version: 'wrong' }), binding({ candidateEvidenceHash: 'bad' }), binding({ auditReceiptHash: coercive }), binding({ engineId: 'BAD' }), binding({ revocationChecked: 0 }), binding({ durableAuditVerified: 'false' })]) {
    const result = contracts.assessBinding(value);
    assert.match(result.status, /BLOCKED$/u);
    assert.equal(result.activationAllowed, false);
    assert.notEqual(result.reasonCode, 'ENGINE_CANDIDATE_POLICY_AUDIT_EXTERNAL_VERIFICATION_REQUIRED');
  }
  assert.equal(reads, 0);
});

test('all results and gaps are immutable and module exposes no audit writer or verifier', () => {
  for (const value of [binding(), binding({ durableAuditVerified: true }), null]) {
    const result = contracts.assessBinding(value);
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.assuranceGaps));
    assert.equal(result.ready || result.activationAllowed || result.policyBindingVerified || result.durableAuditVerified || result.revocationVerified, false);
  }
  assert.deepEqual(Object.keys(contracts), ['VERSION', 'assessBinding']);
  assert.ok(Object.isFrozen(contracts));
});
