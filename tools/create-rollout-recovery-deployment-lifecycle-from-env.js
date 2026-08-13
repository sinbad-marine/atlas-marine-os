'use strict';

const lifecycleModule = require('./trusted-rollout-recovery-deployment-lifecycle-runtime.js');

const CONFIG_VERSION = 'sinbad-rollout-recovery-deployment-lifecycle-config/4Y-v1';
const HASH = /^[a-f0-9]{64}$/u;
const PURPOSE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const DECIMAL = /^(?:0|[1-9][0-9]*)$/u;
const NAMES = Object.freeze({ actorHash: 'ROLLOUT_RECOVERY_ACTOR_HASH', deploymentPurpose: 'ROLLOUT_RECOVERY_DEPLOYMENT_PURPOSE', reconciliationPurpose: 'ROLLOUT_RECOVERY_RECONCILIATION_PURPOSE', authorizationTtlMs: 'ROLLOUT_RECOVERY_AUTHORIZATION_TTL_MS', deploymentTimeoutMs: 'ROLLOUT_RECOVERY_DEPLOYMENT_TIMEOUT_MS', reconciliationTimeoutMs: 'ROLLOUT_RECOVERY_RECONCILIATION_TIMEOUT_MS', authorizationTimeoutMs: 'ROLLOUT_RECOVERY_AUTHORIZATION_TIMEOUT_MS', auditPageSize: 'ROLLOUT_RECOVERY_AUDIT_PAGE_SIZE', auditMaxEvents: 'ROLLOUT_RECOVERY_AUDIT_MAX_EVENTS', maxReconciliationAttempts: 'ROLLOUT_RECOVERY_MAX_RECONCILIATION_ATTEMPTS', reconciliationRetryDelayMs: 'ROLLOUT_RECOVERY_RECONCILIATION_RETRY_DELAY_MS', reconciliationRetryBackoffFactor: 'ROLLOUT_RECOVERY_RECONCILIATION_RETRY_BACKOFF_FACTOR', maxReconciliationRetryDelayMs: 'ROLLOUT_RECOVERY_MAX_RECONCILIATION_RETRY_DELAY_MS' });
const DEPENDENCIES = Object.freeze(['env', 'client', 'serviceRole', 'deploymentReadiness', 'deploy', 'resolve', 'authorize', 'now']);

function snapshot(env) {
  if (!env || typeof env !== 'object') throw new TypeError('An explicit environment mapping is required');
  const output = Object.create(null);
  for (const name of Object.values(NAMES)) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(env, name); } catch { throw new TypeError(`Configuration cannot be inspected: ${name}`); }
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'string') throw new TypeError(`Configuration must be an own string value: ${name}`);
    output[name] = descriptor.value;
  }
  return Object.freeze(output);
}
function required(env, name) { const value = env[name]; if (!value) throw new TypeError(`Required configuration is missing: ${name}`); return value; }
function integer(env, name) { const raw = required(env, name); if (!DECIMAL.test(raw)) throw new TypeError(`Configuration must be a canonical integer: ${name}`); const value = Number(raw); if (!Number.isSafeInteger(value)) throw new TypeError(`Configuration integer is unsafe: ${name}`); return value; }

function parse(env) {
  env = snapshot(env);
  const actorHash = required(env, NAMES.actorHash);
  const deploymentPurpose = required(env, NAMES.deploymentPurpose);
  const reconciliationPurpose = required(env, NAMES.reconciliationPurpose);
  if (!HASH.test(actorHash)) throw new TypeError(`Configuration hash is invalid: ${NAMES.actorHash}`);
  if (!PURPOSE.test(deploymentPurpose) || !PURPOSE.test(reconciliationPurpose)) throw new TypeError('Configuration purpose is invalid');
  return Object.freeze({ version: CONFIG_VERSION, actorHash, deploymentPurpose, reconciliationPurpose, authorizationTtlMs: integer(env, NAMES.authorizationTtlMs), deploymentTimeoutMs: integer(env, NAMES.deploymentTimeoutMs), reconciliationTimeoutMs: integer(env, NAMES.reconciliationTimeoutMs), authorizationTimeoutMs: integer(env, NAMES.authorizationTimeoutMs), auditPageSize: integer(env, NAMES.auditPageSize), auditMaxEvents: integer(env, NAMES.auditMaxEvents), maxReconciliationAttempts: integer(env, NAMES.maxReconciliationAttempts), reconciliationRetryDelayMs: integer(env, NAMES.reconciliationRetryDelayMs), reconciliationRetryBackoffFactor: integer(env, NAMES.reconciliationRetryBackoffFactor), maxReconciliationRetryDelayMs: integer(env, NAMES.maxReconciliationRetryDelayMs) });
}

function dependencies(options) {
  if (!options || typeof options !== 'object') throw new TypeError('Explicit lifecycle dependencies are required');
  const output = Object.create(null);
  for (const name of DEPENDENCIES) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(options, name); } catch { throw new TypeError(`Lifecycle dependency cannot be inspected: ${name}`); }
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new TypeError(`Lifecycle dependency must be an own data property: ${name}; exact trusted lifecycle dependencies enforce the service-role boundary`);
    output[name] = descriptor.value;
    if (name === 'serviceRole' && output[name] !== true) throw new TypeError('exact trusted lifecycle dependencies require a service-role client');
  }
  if (!output.client || typeof output.client.rpc !== 'function' || !output.deploymentReadiness || typeof output.deploymentReadiness.verify !== 'function' || typeof output.deploy !== 'function' || typeof output.resolve !== 'function' || typeof output.authorize !== 'function' || typeof output.now !== 'function') throw new TypeError('exact trusted lifecycle dependencies are required');
  return Object.freeze(output);
}

function create(options = {}) {
  const trusted = dependencies(options);
  const config = parse(trusted.env);
  return lifecycleModule.create({ client: trusted.client, serviceRole: true, deploymentReadiness: trusted.deploymentReadiness, deploy: trusted.deploy, resolve: trusted.resolve, authorize: trusted.authorize, now: trusted.now, actorHash: config.actorHash, deploymentPurpose: config.deploymentPurpose, reconciliationPurpose: config.reconciliationPurpose, authorizationTtlMs: config.authorizationTtlMs, deploymentTimeoutMs: config.deploymentTimeoutMs, reconciliationTimeoutMs: config.reconciliationTimeoutMs, authorizationTimeoutMs: config.authorizationTimeoutMs, auditPageSize: config.auditPageSize, auditMaxEvents: config.auditMaxEvents, maxReconciliationAttempts: config.maxReconciliationAttempts, reconciliationRetryDelayMs: config.reconciliationRetryDelayMs, reconciliationRetryBackoffFactor: config.reconciliationRetryBackoffFactor, maxReconciliationRetryDelayMs: config.maxReconciliationRetryDelayMs });
}

module.exports = Object.freeze({ CONFIG_VERSION, NAMES, DEPENDENCIES, snapshot, dependencies, parse, create });
