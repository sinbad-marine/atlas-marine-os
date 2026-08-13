'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const readiness = require('../../tools/verify-rollout-recovery-deployment-readiness.js');
const evidenceVerifier = require('../../tools/verify-rollout-recovery-release-evidence.js');

const commit = 'a'.repeat(40);
const validEvidence = () => ({ version: evidenceVerifier.VERIFIER_VERSION, status: 'RELEASE_EVIDENCE_VALID', reasonCode: null, commit });
const healthy = () => ({ version: readiness.RUNTIME_VERSION, status: 'ROLLOUT_RECOVERY_RUNTIME_READY', reasonCode: null, eventCount: 2, pageCount: 2, watermarkId: 4 });
const options = (overrides = {}) => ({ evidence: Object.freeze({}), verifyEvidence: validEvidence, getRuntimeHealth: async () => healthy(), verifyOperatorIdentity: async () => true, identityAttestation: Object.freeze({ opaque: true }), identityTimeoutMs: 100, ...overrides });

test('requires exact release evidence live runtime health and operator identity', async () => {
  const value = await readiness.verify(options());
  assert.deepEqual(value, { version: readiness.READINESS_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_READY', reasonCode: null, commit, eventCount: 2, pageCount: 2, watermarkId: 4 });
  assert.ok(Object.isFrozen(value));
  assert.equal('identityAttestation' in value, false);
});

test('evidence failure short-circuits runtime and identity providers', async () => {
  let calls = 0;
  const value = await readiness.verify(options({ verifyEvidence: () => ({ status: 'RELEASE_EVIDENCE_INVALID', reasonCode: 'COMMIT_MISMATCH' }), getRuntimeHealth: async () => { calls++; }, verifyOperatorIdentity: async () => { calls++; } }));
  assert.equal(value.reasonCode, 'COMMIT_MISMATCH');
  assert.equal(calls, 0);
});

test('runtime denial malformed health and exceptions block before identity', async () => {
  const healthCases = [
    async () => ({ ...healthy(), status: 'ROLLOUT_RECOVERY_RUNTIME_BLOCKED', reasonCode: 'AUDIT_OFFLINE' }),
    async () => ({ ...healthy(), eventCount: 0, watermarkId: 4 }),
    async () => { throw new Error('offline'); },
  ];
  for (const getRuntimeHealth of healthCases) {
    let identities = 0;
    const value = await readiness.verify(options({ getRuntimeHealth, verifyOperatorIdentity: async () => { identities++; return true; } }));
    assert.equal(value.status, 'ROLLOUT_RECOVERY_DEPLOYMENT_BLOCKED');
    assert.equal(identities, 0);
  }
});

test('identity denial exception and timeout fail closed without exposing attestation', async () => {
  const verifiers = [async () => false, async () => { throw new Error('denied'); }, async () => new Promise(() => {})];
  for (const verifyOperatorIdentity of verifiers) {
    const value = await readiness.verify(options({ verifyOperatorIdentity }));
    assert.equal(value.status, 'ROLLOUT_RECOVERY_DEPLOYMENT_BLOCKED');
    assert.equal('identityAttestation' in value, false);
  }
});

test('construction rejects missing dependencies and unbounded timeouts', async () => {
  await assert.rejects(() => readiness.verify({}), /required/u);
  await assert.rejects(() => readiness.verify(options({ identityAttestation: null })), /attestation/u);
  for (const identityTimeoutMs of [99, 30001, NaN]) await assert.rejects(() => readiness.verify(options({ identityTimeoutMs })), /bounded/u);
});
