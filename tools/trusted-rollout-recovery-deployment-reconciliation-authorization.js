'use strict';

const { createHash, randomBytes } = require('node:crypto');
const reconciliationModule = require('./trusted-rollout-recovery-deployment-reconciliation.js');

const AUTHORIZATION_VERSION = 'sinbad-rollout-recovery-deployment-reconciliation-authorization/4F-v1';
const HASH = /^[a-f0-9]{64}$/u;
const PURPOSE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
const issued = (status, reasonCode, capabilityHash = null, issuedAt = null, expiresAt = null) => Object.freeze({ version: AUTHORIZATION_VERSION, status, reasonCode, capabilityHash: HASH.test(capabilityHash || '') ? capabilityHash : null, issuedAt: Number.isSafeInteger(issuedAt) ? issuedAt : null, expiresAt: Number.isSafeInteger(expiresAt) ? expiresAt : null });
const blocked = reasonCode => Object.freeze({ version: reconciliationModule.RECONCILIATION_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_BLOCKED', reasonCode, authorizationHash: null });

function create(options = {}) {
  if (typeof options.authorize !== 'function' || typeof options.now !== 'function') throw new TypeError('Trusted authorize and clock functions are required');
  const actorHash = String(options.actorHash || '');
  const purpose = String(options.reconciliationPurpose || '');
  const ttlMs = Number(options.authorizationTtlMs);
  const timeoutMs = Number(options.authorizationTimeoutMs);
  if (!HASH.test(actorHash) || !PURPOSE.test(purpose) || !Number.isInteger(ttlMs) || ttlMs < 1000 || ttlMs > 300000 || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) throw new TypeError('A bounded purpose-bound operator authorization policy is required');
  const reconciliation = reconciliationModule.create(options);
  const authentic = new WeakSet();
  const consumed = new WeakSet();
  const manifests = new WeakMap();
  let lastClock = -1;
  function sample() { const value = Number(options.now()); if (!Number.isSafeInteger(value) || value < 0 || value < lastClock) return null; lastClock = value; return value; }
  async function allowed(input) {
    let timer;
    try {
      const timeout = Symbol('timeout');
      const value = await Promise.race([Promise.resolve().then(() => options.authorize(input)), new Promise(resolve => { timer = setTimeout(() => resolve(timeout), timeoutMs); })]);
      return value !== timeout && value === true;
    } catch { return false; }
    finally { if (timer !== undefined) clearTimeout(timer); }
  }

  return Object.freeze({
    version: AUTHORIZATION_VERSION,
    async issue(authorizationHash) {
      if (!HASH.test(authorizationHash || '')) return issued('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZATION_BLOCKED', 'AUTHORIZATION_HASH_INVALID');
      const issuedAt = sample();
      if (issuedAt === null || issuedAt > Number.MAX_SAFE_INTEGER - ttlMs) return issued('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZATION_BLOCKED', 'AUTHORIZATION_CLOCK_INVALID');
      const request = Object.freeze({ actorHash, authorizationHash, purpose });
      if (!await allowed(request)) return issued('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZATION_BLOCKED', 'OPERATOR_AUTHORIZATION_DENIED');
      try {
        const manifest = Object.freeze({ version: AUTHORIZATION_VERSION, actorHash, authorizationHash, purposeHash: sha256(purpose), nonceHash: sha256(randomBytes(32).toString('hex')), issuedAt, expiresAt: issuedAt + ttlMs });
        const capabilityHash = sha256(canonical(manifest));
        const value = issued('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZED', null, capabilityHash, issuedAt, manifest.expiresAt);
        authentic.add(value); manifests.set(value, manifest); return value;
      } catch { return issued('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZATION_BLOCKED', 'AUTHORIZATION_ISSUE_FAILED'); }
    },
    async reconcile(value) {
      const manifest = manifests.get(value);
      const now = sample();
      if (!authentic.has(value) || consumed.has(value) || !manifest || now === null || now < manifest.issuedAt || now >= manifest.expiresAt || manifest.actorHash !== actorHash || manifest.purposeHash !== sha256(purpose) || value.capabilityHash !== sha256(canonical(manifest))) return blocked('RECONCILIATION_AUTHORIZATION_DENIED');
      consumed.add(value);
      return reconciliation.reconcile(manifest.authorizationHash);
    },
  });
}

module.exports = Object.freeze({ AUTHORIZATION_VERSION, create });
