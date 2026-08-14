'use strict';

const journalAdapter = require('../sinbad-ai-core/adapters/supabase-rollout-recovery-deployment-journal.js');
const auditAdapter = require('../sinbad-ai-core/adapters/supabase-rollout-recovery-deployment-reconciliation-audit.js');
const verifierAdapter = require('../sinbad-ai-core/adapters/supabase-rollout-recovery-deployment-reconciliation-audit-verifier.js');
const auditModule = require('./trusted-rollout-recovery-deployment-reconciliation-audit.js');
const readinessModule = require('./rollout-recovery-deployment-reconciliation-audit-readiness.js');
const authorizationModule = require('./trusted-rollout-recovery-deployment-reconciliation-authorization.js');

const RUNTIME_VERSION = 'sinbad-rollout-recovery-deployment-reconciliation-runtime/5E-v1';
const result = (status, reasonCode) => Object.freeze({ version: RUNTIME_VERSION, status, reasonCode });

function create(options = {}) {
  if (!options.client || typeof options.client.rpc !== 'function' || options.serviceRole !== true) throw new TypeError('A trusted Supabase service-role client is required');
  let timeoutDescriptor;
  try { timeoutDescriptor = Object.getOwnPropertyDescriptor(options, 'reconciliationTimeoutMs'); } catch {}
  const timeoutMs = timeoutDescriptor && Object.hasOwn(timeoutDescriptor, 'value') ? timeoutDescriptor.value : null;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) throw new TypeError('A bounded reconciliation timeout is required');
  const deploymentJournal = journalAdapter.create(options);
  const auditStore = auditAdapter.create(options);
  const auditVerifier = verifierAdapter.create(options);
  const authorizationAudit = auditModule.create({ durable: true, append: event => auditStore.append(event) });
  const auditReadiness = readinessModule.create({ auditVerifier, pageSize: options.auditPageSize, maxEvents: options.auditMaxEvents });
  const authorization = authorizationModule.create({ deploymentJournal, authorizationAudit, auditReadiness, resolve: options.resolve, reconciliationTimeoutMs: options.reconciliationTimeoutMs, authorize: options.authorize, now: options.now, actorHash: options.actorHash, reconciliationPurpose: options.reconciliationPurpose, authorizationTtlMs: options.authorizationTtlMs, authorizationTimeoutMs: options.authorizationTimeoutMs, diagnose: options.diagnose });
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
