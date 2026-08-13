'use strict';

const journalAdapter = require('../sinbad-ai-core/adapters/supabase-rollout-recovery-deployment-journal.js');
const journaledDeploymentModule = require('./trusted-rollout-recovery-journaled-deployment.js');
const reconciliationRuntimeModule = require('./trusted-rollout-recovery-deployment-reconciliation-runtime.js');

const LIFECYCLE_VERSION = 'sinbad-rollout-recovery-deployment-lifecycle-runtime/4L-v1';
const HASH = /^[a-f0-9]{64}$/u;
const blocked = reasonCode => Object.freeze({ version: LIFECYCLE_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_LIFECYCLE_BLOCKED', reasonCode });

function create(options = {}) {
  if (!options.client || typeof options.client.rpc !== 'function' || options.serviceRole !== true) throw new TypeError('A trusted Supabase service-role client is required');
  const deploymentJournal = journalAdapter.create(options);
  const deployment = journaledDeploymentModule.create({ ...options, deploymentJournal });
  const reconciliation = reconciliationRuntimeModule.create(options);
  const deployments = new WeakMap();
  const executing = new WeakSet();
  const issuing = new WeakSet();

  return Object.freeze({
    version: LIFECYCLE_VERSION,
    preflight: reconciliation.preflight,
    async issue(input) {
      const authorization = await deployment.issue(input);
      if (authorization?.status === 'ROLLOUT_RECOVERY_DEPLOYMENT_AUTHORIZED' && HASH.test(authorization.authorizationHash || '')) deployments.set(authorization, { authorizationHash: authorization.authorizationHash, executed: false, unsettled: false, reconciliationIssued: false });
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
      if (issuing.has(authorization)) return blocked('RECONCILIATION_ISSUE_IN_PROGRESS');
      issuing.add(authorization);
      try {
        const capability = await reconciliation.issue(state.authorizationHash);
        if (capability?.status === 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILIATION_AUTHORIZED') state.reconciliationIssued = true;
        return capability;
      } finally { issuing.delete(authorization); }
    },
    reconcile: reconciliation.reconcile,
  });
}

module.exports = Object.freeze({ LIFECYCLE_VERSION, create });
