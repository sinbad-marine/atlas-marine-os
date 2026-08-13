'use strict';

const evidenceVerifier = require('./verify-rollout-recovery-release-evidence.js');

const READINESS_VERSION = 'sinbad-rollout-recovery-deployment-readiness/4A-v1';
const RUNTIME_VERSION = 'sinbad-trusted-rollout-recovery-runtime/3V-v1';
const result = (status, reasonCode, details = {}) => Object.freeze({
  version: READINESS_VERSION,
  status,
  reasonCode,
  commit: details.commit || null,
  eventCount: Number.isSafeInteger(details.eventCount) ? details.eventCount : null,
  pageCount: Number.isSafeInteger(details.pageCount) ? details.pageCount : null,
  watermarkId: Number.isSafeInteger(details.watermarkId) ? details.watermarkId : null,
});
const blocked = (reasonCode, details) => result('ROLLOUT_RECOVERY_DEPLOYMENT_BLOCKED', reasonCode, details);

async function within(promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise((resolve) => { timer = setTimeout(() => resolve(Symbol.for('timeout')), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function verify(options = {}) {
  if (typeof options.getRuntimeHealth !== 'function' || typeof options.verifyOperatorIdentity !== 'function') {
    throw new TypeError('Runtime health and operator identity verifiers are required');
  }
  if (options.identityAttestation === undefined || options.identityAttestation === null) {
    throw new TypeError('An opaque operator identity attestation is required');
  }
  const timeoutMs = Number(options.identityTimeoutMs);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) {
    throw new TypeError('A bounded identity verification timeout is required');
  }
  const checkEvidence = options.verifyEvidence || evidenceVerifier.verify;
  if (typeof checkEvidence !== 'function') throw new TypeError('An evidence verifier is required');

  let checked;
  try {
    checked = checkEvidence(options.evidence);
  } catch {
    return blocked('RELEASE_EVIDENCE_EXCEPTION');
  }
  if (checked?.version !== evidenceVerifier.VERIFIER_VERSION || checked.status !== 'RELEASE_EVIDENCE_VALID' || checked.reasonCode !== null) {
    return blocked(String(checked?.reasonCode || 'RELEASE_EVIDENCE_NOT_VALID'));
  }
  const details = { commit: checked.commit };

  let health;
  try {
    health = await options.getRuntimeHealth();
  } catch {
    return blocked('RUNTIME_HEALTH_EXCEPTION', details);
  }
  if (health?.version !== RUNTIME_VERSION || health.status !== 'ROLLOUT_RECOVERY_RUNTIME_READY' || health.reasonCode !== null) {
    return blocked(String(health?.reasonCode || 'RUNTIME_NOT_READY'), details);
  }
  if (!Number.isSafeInteger(health.eventCount) || health.eventCount < 0 || !Number.isSafeInteger(health.pageCount) || health.pageCount < 1 || (health.watermarkId !== null && (!Number.isSafeInteger(health.watermarkId) || health.watermarkId < 1)) || ((health.eventCount === 0) !== (health.watermarkId === null))) {
    return blocked('RUNTIME_HEALTH_CONTRACT_INVALID', details);
  }
  Object.assign(details, {
    eventCount: health.eventCount,
    pageCount: health.pageCount,
    watermarkId: health.watermarkId,
  });

  let identity;
  try {
    identity = await within(options.verifyOperatorIdentity(options.identityAttestation), timeoutMs);
  } catch {
    return blocked('OPERATOR_IDENTITY_EXCEPTION', details);
  }
  if (identity === Symbol.for('timeout')) return blocked('OPERATOR_IDENTITY_TIMEOUT', details);
  if (identity !== true) return blocked('OPERATOR_IDENTITY_DENIED', details);
  return result('ROLLOUT_RECOVERY_DEPLOYMENT_READY', null, details);
}

module.exports = Object.freeze({ READINESS_VERSION, RUNTIME_VERSION, verify });
