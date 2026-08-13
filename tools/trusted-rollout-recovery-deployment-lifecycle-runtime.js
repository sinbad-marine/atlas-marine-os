'use strict';

const journalAdapter = require('../sinbad-ai-core/adapters/supabase-rollout-recovery-deployment-journal.js');
const journaledDeploymentModule = require('./trusted-rollout-recovery-journaled-deployment.js');
const reconciliationRuntimeModule = require('./trusted-rollout-recovery-deployment-reconciliation-runtime.js');

const LIFECYCLE_VERSION = 'sinbad-rollout-recovery-deployment-lifecycle-runtime/4N-v1';
const HASH = /^[a-f0-9]{64}$/u;
const blocked = reasonCode => Object.freeze({ version: LIFECYCLE_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_LIFECYCLE_BLOCKED', reasonCode });

function create(options = {}) {
  if (!options.client || typeof options.client.rpc !== 'function' || options.serviceRole !== true) throw new TypeError('A trusted Supabase service-role client is required');
  const maxAttempts = Number(options.maxReconciliationAttempts);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) throw new TypeError('A bounded reconciliation attempt policy is required');
  const deploymentJournal = journalAdapter.create(options);
  const deployment = journaledDeploymentModule.create({ ...options, deploymentJournal });
  const reconciliation = reconciliationRuntimeModule.create(options);
  const deployments = new WeakMap();
  const capabilities = new WeakMap();
  const executing = new WeakSet();
  const issuing = new WeakSet();
  const reconciling = new WeakSet();

  return Object.freeze({
    version: LIFECYCLE_VERSION,
    preflight: reconciliation.preflight,
    async issue(input) {
      const authorization = await deployment.issue(input);
      if (authorization?.status === 'ROLLOUT_RECOVERY_DEPLOYMENT_AUTHORIZED' && HASH.test(authorization.authorizationHash || '')) deployments.set(authorization, { authorizationHash: authorization.authorizationHash, executed: false, unsettled: false, reconciliationIssued: false, reconciliationAttempts: 0 });
      return authorization;
    },
    async execute(authorization) {
      const state = deployments.get(authorization);
      const ownsExecution = Boolean(state && !state.executed && !executing.has(authorization));
      if (ownsExecution) executing.add(authorization);
      try {
        const outcome = await deployment.execute(authorization);
        if (ownsExecution) {
          state.executed = true;
          state.unsettled = outcome?.status === 'ROLLOUT_RECOVERY_DEPLOYMENT_UNSETTLED';
        }
        return outcome;
      } finally {
        if (ownsExecution) executing.delete(authorization);
      }
    },
    async issueReconciliation(authorization) {
      const state = deployments.get(authorization);
      if (!state || !state.executed || !state.unsettled || state.reconciliationIssued) return blocked('RECONCILIATION_SOURCE_DENIED');
      if (state.reconciliationAttempts >= maxAttempts) return blocked('RECONCILIATION_RETRY_EXHAUSTED');
      if (issuing.has(authorization)) return blocked('RECONCILIATION_ISSUE_IN_PROGRESS');
      issuing.add(authorization);
      try {
        const capability = await reconciliation.issue(state.authorizationHash);
        if (capability?.status === 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZED') {
          state.reconciliationIssued = true;
          state.reconciliationAttempts++;
          capabilities.set(capability, state);
        }
        return capability;
      } finally { issuing.delete(authorization); }
    },
    async reconcile(capability) {
      const state = capabilities.get(capability);
      const ownsReconciliation = Boolean(state && !reconciling.has(capability));
      if (ownsReconciliation) reconciling.add(capability);
      try {
        const outcome = await reconciliation.reconcile(capability);
        if (ownsReconciliation) {
          const terminal = outcome?.status === 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_APPLIED' || outcome?.status === 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_REJECTED';
          state.unsettled = !terminal;
          state.reconciliationIssued = terminal;
        }
        return outcome;
      } finally {
        if (ownsReconciliation) reconciling.delete(capability);
      }
    },
  });
}

module.exports = Object.freeze({ LIFECYCLE_VERSION, create });
