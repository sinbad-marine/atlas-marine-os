'use strict';

const { createHash, randomBytes } = require('node:crypto');
const reconciliationModule = require('./trusted-rollout-recovery-deployment-reconciliation.js');
const auditModule = require('./trusted-rollout-recovery-deployment-reconciliation-audit.js');
const readinessModule = require('./rollout-recovery-deployment-reconciliation-audit-readiness.js');

const AUTHORIZATION_VERSION = 'sinbad-rollout-recovery-deployment-reconciliation-authorization/5F-v1';
const HASH = /^[a-f0-9]{64}$/u;
const PURPOSE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
const issued = (status, reasonCode, capabilityHash = null, issuedAt = null, expiresAt = null) => Object.freeze({ version: AUTHORIZATION_VERSION, status, reasonCode, capabilityHash: HASH.test(capabilityHash || '') ? capabilityHash : null, issuedAt: Number.isSafeInteger(issuedAt) ? issuedAt : null, expiresAt: Number.isSafeInteger(expiresAt) ? expiresAt : null });
const blocked = reasonCode => Object.freeze({ version: reconciliationModule.RECONCILIATION_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_BLOCKED', reasonCode, authorizationHash: null });
const AUDIT_RESULT_FIELDS = Object.freeze(['status', 'eventHash']);
function auditResultSnapshot(value) {
  if (!value || typeof value !== 'object') return null;
  const output = Object.create(null);
  for (const name of AUDIT_RESULT_FIELDS) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(value, name); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'string') return null;
    output[name] = descriptor.value;
  }
  return Object.freeze(output);
}
function dependencySnapshot(value, fields, validate) {
  if (!value || typeof value !== 'object') return null;
  const output = Object.create(null);
  for (const name of fields) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(value, name); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    output[name] = descriptor.value;
  }
  if (!validate(output)) return null;
  for (const name of fields) if (typeof output[name] === 'function') { const fn = output[name]; output[name] = (...args) => Reflect.apply(fn, output, args); }
  return Object.freeze(output);
}
function policy(options) {
  if (!options || typeof options !== 'object') return null;
  const output = Object.create(null);
  for (const name of ['deploymentJournal', 'resolve', 'diagnose', 'reconciliationTimeoutMs', 'authorize', 'authorizationAudit', 'auditReadiness', 'now', 'actorHash', 'reconciliationPurpose', 'authorizationTtlMs', 'authorizationTimeoutMs']) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(options, name); } catch { return null; }
    if (name === 'diagnose' && (descriptor === undefined || (Object.hasOwn(descriptor, 'value') && descriptor.value === undefined))) { output[name] = undefined; continue; }
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    output[name] = descriptor.value;
  }
  output.authorizationAudit = dependencySnapshot(output.authorizationAudit, ['version', 'durable', 'record'], value => value.version === auditModule.AUDIT_VERSION && value.durable === true && typeof value.record === 'function');
  output.auditReadiness = dependencySnapshot(output.auditReadiness, ['version', 'check'], value => value.version === readinessModule.READINESS_VERSION && typeof value.check === 'function');
  output.deploymentJournal = dependencySnapshot(output.deploymentJournal, ['version', 'durable', 'inspect', 'settle'], value => value.version === reconciliationModule.EXPECTED_JOURNAL_VERSION && value.durable === true && typeof value.inspect === 'function' && typeof value.settle === 'function');
  if (!output.authorizationAudit || !output.auditReadiness || !output.deploymentJournal || typeof output.resolve !== 'function' || (output.diagnose !== undefined && typeof output.diagnose !== 'function') || !Number.isSafeInteger(output.reconciliationTimeoutMs) || output.reconciliationTimeoutMs < 1000 || output.reconciliationTimeoutMs > 300000 || typeof output.authorize !== 'function' || typeof output.now !== 'function' || typeof output.actorHash !== 'string' || !HASH.test(output.actorHash) || typeof output.reconciliationPurpose !== 'string' || !PURPOSE.test(output.reconciliationPurpose) || !Number.isSafeInteger(output.authorizationTtlMs) || output.authorizationTtlMs < 1000 || output.authorizationTtlMs > 300000 || !Number.isSafeInteger(output.authorizationTimeoutMs) || output.authorizationTimeoutMs < 1000 || output.authorizationTimeoutMs > 300000) return null;
  return Object.freeze(output);
}

function create(options = {}) {
  const admitted = policy(options);
  if (!admitted) throw new TypeError('Trusted bounded reconciliation authorization dependencies are required');
  const audit = admitted.authorizationAudit, readiness = admitted.auditReadiness, actorHash = admitted.actorHash, purpose = admitted.reconciliationPurpose, ttlMs = admitted.authorizationTtlMs, timeoutMs = admitted.authorizationTimeoutMs, clock = admitted.now, authorize = admitted.authorize;
  const reconciliation = reconciliationModule.create(Object.freeze({ deploymentJournal: admitted.deploymentJournal, resolve: admitted.resolve, diagnose: admitted.diagnose, reconciliationTimeoutMs: admitted.reconciliationTimeoutMs }));
  const authentic = new WeakSet();
  const consumed = new WeakSet();
  const manifests = new WeakMap();
  let lastClock = -1;
  function sample() { let value; try { value = clock(); } catch { return null; } if (!Number.isSafeInteger(value) || value < 0 || value < lastClock) return null; lastClock = value; return value; }
  async function allowed(input) {
    let timer;
    try {
      const timeout = Symbol('timeout');
      const value = await Promise.race([Promise.resolve().then(() => authorize(input)), new Promise(resolve => { timer = setTimeout(() => resolve(timeout), timeoutMs); })]);
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
      let ready;
      try { ready = await readiness.check(); } catch { ready = null; }
      ready = readinessModule.snapshot(ready);
      const auditReady = readinessModule.validDecision(ready);
      const approved = auditReady ? await allowed(request) : false;
      let auditResult;
      try { auditResult = auditResultSnapshot(await audit.record(Object.freeze({ actorHash, authorizationHash, purposeHash: sha256(purpose), decision: approved ? 'AUTHORIZED' : 'DENIED', decidedAt: issuedAt }))); }
      catch { auditResult = null; }
      if (auditResult?.status !== 'RECORDED' || !HASH.test(auditResult.eventHash || '')) return issued('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZATION_BLOCKED', 'AUTHORIZATION_AUDIT_REQUIRED');
      if (!auditReady) return issued('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZATION_BLOCKED', typeof ready?.reasonCode === 'string' && ready.reasonCode ? ready.reasonCode : 'AUDIT_READINESS_REQUIRED');
      if (!approved) return issued('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZATION_BLOCKED', 'OPERATOR_AUTHORIZATION_DENIED');
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

module.exports = Object.freeze({ AUTHORIZATION_VERSION, AUDIT_RESULT_FIELDS, auditResultSnapshot, create });
