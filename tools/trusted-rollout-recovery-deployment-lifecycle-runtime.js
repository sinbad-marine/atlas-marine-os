'use strict';

const journalAdapter = require('../sinbad-ai-core/adapters/supabase-rollout-recovery-deployment-journal.js');
const journaledDeploymentModule = require('./trusted-rollout-recovery-journaled-deployment.js');
const reconciliationRuntimeModule = require('./trusted-rollout-recovery-deployment-reconciliation-runtime.js');

const LIFECYCLE_VERSION = 'sinbad-rollout-recovery-deployment-lifecycle-runtime/5C-v1';
const DEPENDENCIES = Object.freeze(['client', 'serviceRole', 'deploymentReadiness', 'deploy', 'deploymentPurpose', 'deploymentTimeoutMs', 'resolve', 'reconciliationTimeoutMs', 'authorize', 'now', 'actorHash', 'reconciliationPurpose', 'authorizationTtlMs', 'authorizationTimeoutMs', 'auditPageSize', 'auditMaxEvents', 'maxReconciliationAttempts', 'reconciliationRetryDelayMs', 'reconciliationRetryBackoffFactor', 'maxReconciliationRetryDelayMs']);
const HASH = /^[a-f0-9]{64}$/u;
const PURPOSE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const blocked = reasonCode => Object.freeze({ version: LIFECYCLE_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_LIFECYCLE_BLOCKED', reasonCode });
const snapshot = (phase, attemptsUsed = null, attemptsRemaining = null, retryAfterMs = null) => Object.freeze({ version: LIFECYCLE_VERSION, status: 'ROLLOUT_RECOVERY_DEPLOYMENT_LIFECYCLE_STATE', phase, attemptsUsed: Number.isInteger(attemptsUsed) ? attemptsUsed : null, attemptsRemaining: Number.isInteger(attemptsRemaining) ? attemptsRemaining : null, retryAfterMs: Number.isSafeInteger(retryAfterMs) && retryAfterMs >= 0 ? retryAfterMs : null });
function ownData(object, name) {
  let descriptor;
  try { descriptor = object && typeof object === 'object' ? Object.getOwnPropertyDescriptor(object, name) : null; } catch { throw new TypeError(`Nested lifecycle runtime dependency cannot be inspected: ${name}`); }
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new TypeError(`Nested lifecycle runtime dependency must be an own data property: ${name}`);
  return descriptor.value;
}

function dependencies(options) {
  if (!options || typeof options !== 'object') throw new TypeError('Exact trusted lifecycle runtime dependencies are required');
  const output = Object.create(null);
  for (const name of DEPENDENCIES) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(options, name); } catch { throw new TypeError(`Lifecycle runtime dependency cannot be inspected: ${name}`); }
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new TypeError(`Lifecycle runtime dependency must be an own data property: ${name}`);
    output[name] = descriptor.value;
  }
  const rpc = ownData(output.client, 'rpc');
  const readinessVersion = ownData(output.deploymentReadiness, 'READINESS_VERSION');
  const verify = ownData(output.deploymentReadiness, 'verify');
  if (typeof rpc !== 'function' || output.serviceRole !== true || typeof readinessVersion !== 'string' || typeof verify !== 'function' || typeof output.deploy !== 'function' || typeof output.resolve !== 'function' || typeof output.authorize !== 'function' || typeof output.now !== 'function') throw new TypeError('Exact trusted lifecycle runtime dependencies are required');
  if (typeof output.deploymentPurpose !== 'string' || typeof output.reconciliationPurpose !== 'string' || typeof output.actorHash !== 'string' || !PURPOSE.test(output.deploymentPurpose) || !PURPOSE.test(output.reconciliationPurpose) || !HASH.test(output.actorHash)) throw new TypeError('Exact primitive lifecycle identity policy is required');
  const numericPolicies = Object.freeze({ deploymentTimeoutMs: 'A bounded deployment timeout policy is required', reconciliationTimeoutMs: 'A bounded reconciliation timeout policy is required', authorizationTtlMs: 'A bounded authorization TTL policy is required', authorizationTimeoutMs: 'A bounded authorization timeout policy is required', auditPageSize: 'A bounded audit page policy is required', auditMaxEvents: 'A bounded audit event policy is required', maxReconciliationAttempts: 'A bounded reconciliation attempt policy is required', reconciliationRetryDelayMs: 'A bounded reconciliation retry delay policy is required', reconciliationRetryBackoffFactor: 'A bounded reconciliation backoff policy is required', maxReconciliationRetryDelayMs: 'A bounded reconciliation backoff policy is required' });
  for (const [name, message] of Object.entries(numericPolicies)) if (!Number.isSafeInteger(output[name])) throw new TypeError(`${message} (safe integer)`);
  for (const name of ['deploymentTimeoutMs', 'reconciliationTimeoutMs', 'authorizationTtlMs', 'authorizationTimeoutMs']) if (output[name] < 1000 || output[name] > 300000) throw new TypeError(`A bounded lifecycle timeout policy is required: ${name}`);
  if (output.auditPageSize < 1 || output.auditPageSize > 500 || output.auditMaxEvents < output.auditPageSize || output.auditMaxEvents > 100000) throw new TypeError('A bounded audit scan policy is required');
  if (output.maxReconciliationAttempts < 1 || output.maxReconciliationAttempts > 10) throw new TypeError('A bounded reconciliation attempt policy is required');
  if (output.reconciliationRetryDelayMs < 1000 || output.reconciliationRetryDelayMs > 300000) throw new TypeError('A bounded reconciliation retry delay policy is required');
  if (output.reconciliationRetryBackoffFactor < 2 || output.reconciliationRetryBackoffFactor > 4 || output.maxReconciliationRetryDelayMs < output.reconciliationRetryDelayMs || output.maxReconciliationRetryDelayMs > 300000) throw new TypeError('A bounded reconciliation backoff policy is required');
  const now = output.now;
  output.now = () => { try { const value = now(); return Number.isSafeInteger(value) && value >= 0 ? value : NaN; } catch { return NaN; } };
  output.client = Object.freeze(Object.assign(Object.create(null), { rpc: rpc.bind(output.client) }));
  output.deploymentReadiness = Object.freeze(Object.assign(Object.create(null), { READINESS_VERSION: readinessVersion, verify: verify.bind(output.deploymentReadiness) }));
  return Object.freeze(output);
}

function create(options = {}) {
  const trusted = dependencies(options);
  const maxAttempts = trusted.maxReconciliationAttempts;
  const retryDelayMs = trusted.reconciliationRetryDelayMs;
  const backoffFactor = trusted.reconciliationRetryBackoffFactor;
  const maxRetryDelayMs = trusted.maxReconciliationRetryDelayMs;
  const deploymentJournal = journalAdapter.create(trusted);
  const deployment = journaledDeploymentModule.create({ ...trusted, deploymentJournal });
  const reconciliation = reconciliationRuntimeModule.create(trusted);
  const deployments = new WeakMap();
  const capabilities = new WeakMap();
  const executing = new WeakSet();
  const issuing = new WeakSet();
  const reconciling = new WeakSet();
  let lastClock = -1;
  function clock() { return trusted.now(); }
  function sample() { const value = clock(); if (!Number.isSafeInteger(value) || value < 0 || value < lastClock) return null; lastClock = value; return value; }
  function sampleWithHeadroom(amount) { const value = clock(); if (!Number.isSafeInteger(value) || value < 0 || value < lastClock || value > Number.MAX_SAFE_INTEGER - amount) return null; lastClock = value; return value; }
  function observe() { const value = clock(); return Number.isSafeInteger(value) && value >= 0 && value >= lastClock ? value : null; }
  function retryDelay(attempt) { let delay = retryDelayMs; for (let index = 1; index < attempt && delay < maxRetryDelayMs; index++) delay = delay > Math.floor(maxRetryDelayMs / backoffFactor) ? maxRetryDelayMs : Math.min(maxRetryDelayMs, delay * backoffFactor); return delay; }

  return Object.freeze({
    version: LIFECYCLE_VERSION,
    preflight: reconciliation.preflight,
    async issue(input) {
      const authorization = await deployment.issue(input);
      if (authorization?.status === 'ROLLOUT_RECOVERY_DEPLOYMENT_AUTHORIZED' && HASH.test(authorization.authorizationHash || '')) deployments.set(authorization, { authorizationHash: authorization.authorizationHash, executed: false, unsettled: false, closed: false, reconciliationIssued: false, reconciliationRunning: false, reconciliationAttempts: 0, retryNotBefore: null, retryClockPending: false });
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
      if (state.retryClockPending) {
        const delay = retryDelay(state.reconciliationAttempts);
        const now = sampleWithHeadroom(delay);
        if (now === null) return blocked('RECONCILIATION_RETRY_CLOCK_INVALID');
        state.retryNotBefore = now + delay;
        state.retryClockPending = false;
        return blocked('RECONCILIATION_RETRY_DELAY_ACTIVE');
      }
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
            if (state.reconciliationAttempts >= maxAttempts) {
              state.retryClockPending = false;
              state.retryNotBefore = null;
            } else {
              const now = sample();
              const delay = retryDelay(state.reconciliationAttempts);
              state.retryClockPending = now === null || now > Number.MAX_SAFE_INTEGER - delay;
              state.retryNotBefore = state.retryClockPending ? null : now + delay;
            }
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
      if (used >= maxAttempts) return snapshot('RETRY_EXHAUSTED', used, remaining);
      if (state.retryClockPending) return snapshot('RETRY_CLOCK_PENDING', used, remaining);
      if (state.retryNotBefore === null) return snapshot('RETRY_READY', used, remaining);
      const now = observe();
      if (now === null) return snapshot('RETRY_CLOCK_INVALID', used, remaining);
      const retryAfterMs = Math.max(0, state.retryNotBefore - now);
      return snapshot(retryAfterMs > 0 ? 'RETRY_DELAY_ACTIVE' : 'RETRY_READY', used, remaining, retryAfterMs);
    },
  });
}

module.exports = Object.freeze({ LIFECYCLE_VERSION, DEPENDENCIES, dependencies, create });
