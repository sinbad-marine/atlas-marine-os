'use strict';

const journalAdapter = require('../sinbad-ai-core/adapters/supabase-rollout-recovery-deployment-journal.js');
const journaledDeploymentModule = require('./trusted-rollout-recovery-journaled-deployment.js');
const reconciliationRuntimeModule = require('./trusted-rollout-recovery-deployment-reconciliation-runtime.js');

const LIFECYCLE_VERSION = 'sinbad-rollout-recovery-deployment-lifecycle-runtime/4S-v1';
const HASH = /^[a-f0-9]{64}$/u;
const blocked = reasonCode => Object.freeze({ version: LIFECYCLE_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_LIFECYCLE_BLOCKED', reasonCode });
const snapshot = (phase, attemptsUsed = null, attemptsRemaining = null, retryNotBefore = null) => Object.freeze({ version: LIFECYCLE_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_LIFECYCLE_STATE', phase, attemptsUsed: Number.isInteger(attemptsUsed) ? attemptsUsed : null, attemptsRemaining: Number.isInteger(attemptsRemaining) ? attemptsRemaining : null, retryNotBefore: Number.isSafeInteger(retryNotBefore) ? retryNotBefore : null });

function create(options = {}) {
  if (!options.client || typeof options.client.rpc !== 'function' || options.serviceRole !== true) throw new TypeError('A trusted Supabase service-role client is required');
  const maxAttempts = Number(options.maxReconciliationAttempts);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) throw new TypeError('A bounded reconciliation attempt policy is required');
  const retryDelayMs = Number(options.reconciliationRetryDelayMs);
  if (!Number.isInteger(retryDelayMs) || retryDelayMs < 1000 || retryDelayMs > 300000) throw new TypeError('A bounded reconciliation retry delay is required');
  const backoffFactor = Number(options.reconciliationRetryBackoffFactor);
  const maxRetryDelayMs = Number(options.maxReconciliationRetryDelayMs);
  if (!Number.isInteger(backoffFactor) || backoffFactor < 2 || backoffFactor > 4 || !Number.isInteger(maxRetryDelayMs) || maxRetryDelayMs < retryDelayMs || maxRetryDelayMs > 300000) throw new TypeError('A bounded reconciliation backoff policy is required');
  const deploymentJournal = journalAdapter.create(options);
  const deployment = journaledDeploymentModule.create({ ...options, deploymentJournal });
  const reconciliation = reconciliationRuntimeModule.create(options);
  const deployments = new WeakMap();
  const capabilities = new WeakMap();
  const executing = new WeakSet();
  const issuing = new WeakSet();
  const reconciling = new WeakSet();
  let lastClock = -1;
  function clock() { try { return Number(options.now()); } catch { return NaN; } }
  function sample() { const value = clock(); if (!Number.isSafeInteger(value) || value < 0 || value < lastClock) return null; lastClock = value; return value; }
  function observe() { const value = clock(); return Number.isSafeInteger(value) && value >= 0 && value >= lastClock ? value : null; }
  function retryDelay(attempt) { let delay = retryDelayMs; for (let index = 1; index < attempt && delay < maxRetryDelayMs; index++) delay = delay > Math.floor(maxRetryDelayMs / backoffFactor) ? maxRetryDelayMs : Math.min(maxRetryDelayMs, delay * backoffFactor); return delay; }

  return Object.freeze({
    version: LIFECYCLE_VERSION,
    preflight: reconciliation.preflight,
    async issue(input) {
      const authorization = await deployment.issue(input);
      if (authorization?.status === 'ROLLOUT_RECOVERY_DEPLOYMENT_AUTHORIZED' && HASH.test(authorization.authorizationHash || '')) deployments.set(authorization, { authorizationHash: authorization.authorizationHash, executed: false, unsettled: false, closed: false, reconciliationIssued: false, reconciliationRunning: false, reconciliationAttempts: 0, retryNotBefore: null });
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
          state.closed = !state.unsettled;
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
      if (state.retryNotBefore !== null) {
        const now = sample();
        if (now === null) return blocked('RECONCILIATION_RETRY_CLOCK_INVALID');
        if (now < state.retryNotBefore) return blocked('RECONCILIATION_RETRY_DELAY_ACTIVE');
      }
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
      if (ownsReconciliation) { reconciling.add(capability); state.reconciliationRunning = true; }
      try {
        const outcome = await reconciliation.reconcile(capability);
        if (ownsReconciliation) {
          const terminal = outcome?.status === 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_APPLIED' || outcome?.status === 'ROLLOUT_RECOVERY_DEPLOYMENT_RECONCILED_REJECTED';
          state.unsettled = !terminal;
          state.closed = terminal;
          state.reconciliationIssued = terminal;
          state.reconciliationRunning = false;
          if (!terminal) {
            const now = sample();
            const delay = retryDelay(state.reconciliationAttempts);
            state.retryNotBefore = now !== null && now <= Number.MAX_SAFE_INTEGER - delay ? now + delay : Number.MAX_SAFE_INTEGER;
          }
        }
        return outcome;
      } finally {
        if (ownsReconciliation) { state.reconciliationRunning = false; reconciling.delete(capability); }
      }
    },
    inspect(authorization) {
      const state = deployments.get(authorization);
      if (!state) return snapshot('SOURCE_DENIED');
      const used = state.reconciliationAttempts, remaining = Math.max(0, maxAttempts - used);
      if (!state.executed) return snapshot(executing.has(authorization) ? 'EXECUTION_IN_PROGRESS' : 'EXECUTION_REQUIRED', used, remaining);
      if (state.closed) return snapshot('CLOSED', used, remaining);
      if (state.reconciliationRunning) return snapshot('RECONCILIATION_IN_PROGRESS', used, remaining);
      if (state.reconciliationIssued) return snapshot('RECONCILIATION_AUTHORIZED', used, remaining);
      if (used >= maxAttempts) return snapshot('RETRY_EXHAUSTED', used, remaining, state.retryNotBefore);
      if (state.retryNotBefore === null) return snapshot('RETRY_READY', used, remaining);
      const now = observe();
      if (now === null) return snapshot('RETRY_CLOCK_INVALID', used, remaining, state.retryNotBefore);
      return snapshot(now < state.retryNotBefore ? 'RETRY_DELAY_ACTIVE' : 'RETRY_READY', used, remaining, state.retryNotBefore);
    },
  });
}

module.exports = Object.freeze({ LIFECYCLE_VERSION, create });
