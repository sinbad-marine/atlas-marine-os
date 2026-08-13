'use strict';

const lifecycleModule = require('./trusted-rollout-recovery-deployment-lifecycle-runtime.js');

const CONFIG_VERSION = 'sinbad-rollout-recovery-deployment-lifecycle-config/4W-v1';
const HASH = /^[a-f0-9]{64}$/u;
const PURPOSE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const DECIMAL = /^(?:0|[1-9][0-9]*)$/u;
const NAMES = Object.freeze({ actorHash: 'ROLLOUT_RECOVERY_ACTOR_HASH', deploymentPurpose: 'ROLLOUT_RECOVERY_DEPLOYMENT_PURPOSE', reconciliationPurpose: 'ROLLOUT_RECOVERY_RECONCILIATION_PURPOSE', authorizationTtlMs: 'ROLLOUT_RECOVERY_AUTHORIZATION_TTL_MS', deploymentTimeoutMs: 'ROLLOUT_RECOVERY_DEPLOYMENT_TIMEOUT_MS', reconciliationTimeoutMs: 'ROLLOUT_RECOVERY_RECONCILIATION_TIMEOUT_MS', authorizationTimeoutMs: 'ROLLOUT_RECOVERY_AUTHORIZATION_TIMEOUT_MS', auditPageSize: 'ROLLOUT_RECOVERY_AUDIT_PAGE_SIZE', auditMaxEvents: 'ROLLOUT_RECOVERY_AUDIT_MAX_EVENTS', maxReconciliationAttempts: 'ROLLOUT_RECOVERY_MAX_RECONCILIATION_ATTEMPTS', reconciliationRetryDelayMs: 'ROLLOUT_RECOVERY_RECONCILIATION_RETRY_DELAY_MS', reconciliationRetryBackoffFactor: 'ROLLOUT_RECOVERY_RECONCILIATION_RETRY_BACKOFF_FACTOR', maxReconciliationRetryDelayMs: 'ROLLOUT_RECOVERY_MAX_RECONCILIATION_RETRY_DELAY_MS' });

function required(env, name) { const value = env?.[name]; if (typeof value !== 'string' || !value) throw new TypeError(`Required configuration is missing: ${name}`); return value; }
function integer(env, name) { const raw = required(env, name); if (!DECIMAL.test(raw)) throw new TypeError(`Configuration must be a canonical integer: ${name}`); const value = Number(raw); if (!Number.isSafeInteger(value)) throw new TypeError(`Configuration integer is unsafe: ${name}`); return value; }

function parse(env) {
  const actorHash = required(env, NAMES.actorHash);
  const deploymentPurpose = required(env, NAMES.deploymentPurpose);
  const reconciliationPurpose = required(env, NAMES.reconciliationPurpose);
  if (!HASH.test(actorHash)) throw new TypeError(`Configuration hash is invalid: ${NAMES.actorHash}`);
  if (!PURPOSE.test(deploymentPurpose) || !PURPOSE.test(reconciliationPurpose)) throw new TypeError('Configuration purpose is invalid');
  return Object.freeze({ version: CONFIG_VERSION, actorHash, deploymentPurpose, reconciliationPurpose, authorizationTtlMs: integer(env, NAMES.authorizationTtlMs), deploymentTimeoutMs: integer(env, NAMES.deploymentTimeoutMs), reconciliationTimeoutMs: integer(env, NAMES.reconciliationTimeoutMs), authorizationTimeoutMs: integer(env, NAMES.authorizationTimeoutMs), auditPageSize: integer(env, NAMES.auditPageSize), auditMaxEvents: integer(env, NAMES.auditMaxEvents), maxReconciliationAttempts: integer(env, NAMES.maxReconciliationAttempts), reconciliationRetryDelayMs: integer(env, NAMES.reconciliationRetryDelayMs), reconciliationRetryBackoffFactor: integer(env, NAMES.reconciliationRetryBackoffFactor), maxReconciliationRetryDelayMs: integer(env, NAMES.maxReconciliationRetryDelayMs) });
}

function create(options = {}) {
  if (!options.env || typeof options.env !== 'object') throw new TypeError('An explicit environment mapping is required');
  const config = parse(options.env);
  return lifecycleModule.create({ ...options, ...config, serviceRole: options.serviceRole === true });
}

module.exports = Object.freeze({ CONFIG_VERSION, NAMES, parse, create });
