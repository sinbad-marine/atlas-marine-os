'use strict';

const journalAdapter = require('../sinbad-ai-core/adapters/supabase-rollout-recovery-deployment-journal.js');
const auditAdapter = require('../sinbad-ai-core/adapters/supabase-rollout-recovery-deployment-reconciliation-audit.js');
const verifierAdapter = require('../sinbad-ai-core/adapters/supabase-rollout-recovery-deployment-reconciliation-audit-verifier.js');
const auditModule = require('./trusted-rollout-recovery-deployment-reconciliation-audit.js');
const readinessModule = require('./rollout-recovery-deployment-reconciliation-audit-readiness.js');
const authorizationModule = require('./trusted-rollout-recovery-deployment-reconciliation-authorization.js');

const RUNTIME_VERSION = 'sinbad-rollout-recovery-deployment-reconciliation-runtime/6F-v1';
const DEPENDENCIES = Object.freeze(['client', 'serviceRole', 'resolve', 'diagnose', 'reconciliationTimeoutMs', 'authorize', 'now', 'actorHash', 'reconciliationPurpose', 'authorizationTtlMs', 'authorizationTimeoutMs', 'auditPageSize', 'auditMaxEvents']);
const HASH = /^[a-f0-9]{64}$/u;
const PURPOSE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const result = (status, reasonCode) => Object.freeze({ version: RUNTIME_VERSION, status, reasonCode });

function dependencies(options) {
  if (!options || typeof options !== 'object') throw new TypeError('A trusted Supabase service-role client is required');
  const output = Object.create(null);
  for (const name of DEPENDENCIES) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(options, name); } catch { throw new TypeError(`Reconciliation runtime dependency cannot be inspected: ${name}`); }
    if (name === 'diagnose' && (descriptor === undefined || (Object.hasOwn(descriptor, 'value') && descriptor.value === undefined))) { output[name] = undefined; continue; }
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
      if (name === 'client' || name === 'serviceRole') throw new TypeError('A trusted Supabase service-role client is required');
      throw new TypeError(`Reconciliation runtime dependency must be an own data property: ${name}`);
    }
    output[name] = descriptor.value;
  }
  let rpcDescriptor;
  try { rpcDescriptor = output.client && typeof output.client === 'object' ? Object.getOwnPropertyDescriptor(output.client, 'rpc') : null; } catch { throw new TypeError('The trusted Supabase client cannot be inspected'); }
  const rpc = rpcDescriptor && Object.hasOwn(rpcDescriptor, 'value') ? rpcDescriptor.value : null;
  if (typeof rpc !== 'function' || output.serviceRole !== true) throw new TypeError('A trusted Supabase service-role client is required');
  if (typeof output.resolve !== 'function' || (output.diagnose !== undefined && typeof output.diagnose !== 'function') || typeof output.authorize !== 'function' || typeof output.now !== 'function') throw new TypeError('Trusted reconciliation runtime functions are required');
  if (typeof output.actorHash !== 'string' || !HASH.test(output.actorHash) || typeof output.reconciliationPurpose !== 'string' || !PURPOSE.test(output.reconciliationPurpose)) throw new TypeError('Exact primitive reconciliation runtime identity is required');
  if (!Number.isSafeInteger(output.reconciliationTimeoutMs) || output.reconciliationTimeoutMs < 1000 || output.reconciliationTimeoutMs > 300000) throw new TypeError('A bounded reconciliation timeout is required');
  if (!Number.isSafeInteger(output.authorizationTtlMs) || output.authorizationTtlMs < 1000 || output.authorizationTtlMs > 300000 || !Number.isSafeInteger(output.authorizationTimeoutMs) || output.authorizationTimeoutMs < 1000 || output.authorizationTimeoutMs > 300000) throw new TypeError('A bounded reconciliation authorization timing policy is required');
  if (!Number.isSafeInteger(output.auditPageSize) || output.auditPageSize < 1 || output.auditPageSize > 500 || !Number.isSafeInteger(output.auditMaxEvents) || output.auditMaxEvents < output.auditPageSize || output.auditMaxEvents > 100000) throw new TypeError('A bounded audit scan policy is required');
  output.client = Object.freeze(Object.assign(Object.create(null), { rpc: rpc.bind(output.client) }));
  return Object.freeze(output);
}

function create(options = {}) {
  const trusted = dependencies(options);
  const deploymentJournal = journalAdapter.create(trusted);
  const auditStore = auditAdapter.create(trusted);
  const auditVerifier = verifierAdapter.create(trusted);
  const authorizationAudit = auditModule.create({ durable: true, append: event => auditStore.append(event) });
  const auditReadiness = readinessModule.create({ auditVerifier, pageSize: trusted.auditPageSize, maxEvents: trusted.auditMaxEvents });
  const authorization = authorizationModule.create({ deploymentJournal, authorizationAudit, auditReadiness, resolve: trusted.resolve, reconciliationTimeoutMs: trusted.reconciliationTimeoutMs, authorize: trusted.authorize, now: trusted.now, actorHash: trusted.actorHash, reconciliationPurpose: trusted.reconciliationPurpose, authorizationTtlMs: trusted.authorizationTtlMs, authorizationTimeoutMs: trusted.authorizationTimeoutMs, diagnose: trusted.diagnose });
  return Object.freeze({
    version: RUNTIME_VERSION,
    async preflight() {
      let readiness;
      try { readiness = readinessModule.snapshot(await auditReadiness.check()); } catch { readiness = null; }
      if (!readinessModule.validDecision(readiness)) return result('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_RUNTIME_BLOCKED', typeof readiness?.reasonCode === 'string' && readiness.reasonCode ? readiness.reasonCode : 'AUDIT_READINESS_REQUIRED');
      return result('ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_RUNTIME_READY', null);
    },
    issue: authorization.issue,
    reconcile: authorization.reconcile,
  });
}

module.exports = Object.freeze({ RUNTIME_VERSION, create });
