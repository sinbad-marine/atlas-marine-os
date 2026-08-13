'use strict';

const { createHash, randomBytes } = require('node:crypto');
const readinessModule = require('./verify-rollout-recovery-deployment-readiness.js');

const AUTHORIZATION_VERSION = 'sinbad-rollout-recovery-deployment-authorization/5D-v1';
const HASH = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const PURPOSE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const canonical = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
};
const authorization = (status, reasonCode, authorizationHash = null, issuedAt = null, expiresAt = null) => Object.freeze({
  version: AUTHORIZATION_VERSION,
  status,
  reasonCode,
  authorizationHash: HASH.test(authorizationHash || '') ? authorizationHash : null,
  issuedAt: Number.isSafeInteger(issuedAt) ? issuedAt : null,
  expiresAt: Number.isSafeInteger(expiresAt) ? expiresAt : null,
});
const outcome = (status, reasonCode, commit = null) => Object.freeze({
  version: AUTHORIZATION_VERSION,
  status,
  reasonCode,
  commit: COMMIT.test(commit || '') ? commit : null,
});
const READINESS_FIELDS = Object.freeze(['version', 'status', 'reasonCode', 'commit', 'eventCount', 'pageCount', 'watermarkId']);
function readinessSnapshot(value) {
  if (!value || typeof value !== 'object') return null;
  const output = Object.create(null);
  for (const name of READINESS_FIELDS) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(value, name); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    output[name] = descriptor.value;
  }
  return Object.freeze(output);
}

function create(options = {}) {
  const readiness = options.deploymentReadiness;
  if (!readiness || readiness.READINESS_VERSION !== readinessModule.READINESS_VERSION || typeof readiness.verify !== 'function') throw new TypeError('Exact deployment readiness is required');
  if (typeof options.deploy !== 'function' || typeof options.now !== 'function') throw new TypeError('Trusted deployment and clock functions are required');
  const purpose = String(options.deploymentPurpose || '');
  const ttlMs = Number(options.authorizationTtlMs);
  const timeoutMs = Number(options.deploymentTimeoutMs);
  if (!PURPOSE.test(purpose) || !Number.isInteger(ttlMs) || ttlMs < 1000 || ttlMs > 300000 || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) throw new TypeError('A bounded purpose-bound deployment policy is required');

  const authentic = new WeakSet();
  const consumed = new WeakSet();
  const manifests = new WeakMap();
  let lastClock = -1;
  function sample() {
    const value = Number(options.now());
    if (!Number.isSafeInteger(value) || value < 0 || value < lastClock) return null;
    lastClock = value;
    return value;
  }

  return Object.freeze({
    version: AUTHORIZATION_VERSION,
    async issue(input) {
      let ready;
      try {
        ready = await readiness.verify(input);
      } catch {
        return authorization('ROLLOUT_RECOVERY_DEPLOYMENT_AUTHORIZATION_BLOCKED', 'DEPLOYMENT_READINESS_EXCEPTION');
      }
      ready = readinessSnapshot(ready);
      if (!ready) return authorization('ROLLOUT_RECOVERY_DEPLOYMENT_AUTHORIZATION_BLOCKED', 'DEPLOYMENT_READINESS_CONTRACT_INVALID');
      if (ready.version !== readinessModule.READINESS_VERSION || ready.status !== 'ROLLOUT_RECOVERY_DEPLOYMENT_READY' || ready.reasonCode !== null || typeof ready.commit !== 'string' || !COMMIT.test(ready.commit)) return authorization('ROLLOUT_RECOVERY_DEPLOYMENT_AUTHORIZATION_BLOCKED', 'DEPLOYMENT_NOT_READY');
      if (!Number.isSafeInteger(ready.eventCount) || ready.eventCount < 0 || !Number.isSafeInteger(ready.pageCount) || ready.pageCount < 1 || (ready.watermarkId !== null && (!Number.isSafeInteger(ready.watermarkId) || ready.watermarkId < 1)) || ((ready.eventCount === 0) !== (ready.watermarkId === null))) return authorization('ROLLOUT_RECOVERY_DEPLOYMENT_AUTHORIZATION_BLOCKED', 'DEPLOYMENT_READINESS_CONTRACT_INVALID');
      const issuedAt = sample();
      if (issuedAt === null || issuedAt > Number.MAX_SAFE_INTEGER - ttlMs) return authorization('ROLLOUT_RECOVERY_DEPLOYMENT_AUTHORIZATION_BLOCKED', 'AUTHORIZATION_CLOCK_INVALID');
      try {
        const manifest = Object.freeze({
          version: AUTHORIZATION_VERSION,
          commit: ready.commit,
          eventCount: ready.eventCount,
          pageCount: ready.pageCount,
          watermarkId: ready.watermarkId,
          purposeHash: sha256(purpose),
          nonceHash: sha256(randomBytes(32).toString('hex')),
          issuedAt,
          expiresAt: issuedAt + ttlMs,
        });
        const authorizationHash = sha256(canonical(manifest));
        const value = authorization('ROLLOUT_RECOVERY_DEPLOYMENT_AUTHORIZED', null, authorizationHash, issuedAt, manifest.expiresAt);
        authentic.add(value);
        manifests.set(value, manifest);
        return value;
      } catch {
        return authorization('ROLLOUT_RECOVERY_DEPLOYMENT_AUTHORIZATION_BLOCKED', 'AUTHORIZATION_ISSUE_FAILED');
      }
    },
    async execute(value) {
      const manifest = manifests.get(value);
      const now = sample();
      if (!authentic.has(value) || consumed.has(value) || !manifest || now === null || now < manifest.issuedAt || now >= manifest.expiresAt || value.authorizationHash !== sha256(canonical(manifest))) return outcome('ROLLOUT_RECOVERY_DEPLOYMENT_BLOCKED', 'DEPLOYMENT_AUTHORIZATION_DENIED');
      consumed.add(value);
      const request = Object.freeze({ commit: manifest.commit, authorizationHash: value.authorizationHash, purpose });
      let timer;
      try {
        const timeout = Symbol('timeout');
        const applied = await Promise.race([
          Promise.resolve().then(() => options.deploy(request)),
          new Promise(resolve => { timer = setTimeout(() => resolve(timeout), timeoutMs); }),
        ]);
        if (applied === timeout) return outcome('ROLLOUT_RECOVERY_DEPLOYMENT_UNSETTLED', 'DEPLOYMENT_TIMEOUT', manifest.commit);
        if (applied === 'APPLIED') return outcome('ROLLOUT_RECOVERY_DEPLOYMENT_APPLIED', null, manifest.commit);
        if (applied === 'REJECTED') return outcome('ROLLOUT_RECOVERY_DEPLOYMENT_REJECTED', null, manifest.commit);
        return outcome('ROLLOUT_RECOVERY_DEPLOYMENT_UNSETTLED', 'DEPLOYMENT_RESULT_INVALID', manifest.commit);
      } catch {
        return outcome('ROLLOUT_RECOVERY_DEPLOYMENT_UNSETTLED', 'DEPLOYMENT_EXCEPTION', manifest.commit);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    },
  });
}

module.exports = Object.freeze({ AUTHORIZATION_VERSION, READINESS_FIELDS, readinessSnapshot, create });
