'use strict';

const AUDIT_VERSION = 'sinbad-rollout-recovery-deployment-reconciliation-audit/4G-v1';
const HASH = /^[a-f0-9]{64}$/u;
const DECISIONS = new Set(['AUTHORIZED', 'DENIED']);
const EVENT_FIELDS = Object.freeze(['version', 'actorHash', 'authorizationHash', 'purposeHash', 'decision', 'decidedAt', 'eventHash']);

function eventSnapshot(event) {
  if (!event || typeof event !== 'object') return null;
  const output = Object.create(null);
  for (const name of EVENT_FIELDS) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(event, name); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    output[name] = descriptor.value;
  }
  if (output.version !== AUDIT_VERSION || typeof output.actorHash !== 'string' || !HASH.test(output.actorHash) || typeof output.authorizationHash !== 'string' || !HASH.test(output.authorizationHash) || typeof output.purposeHash !== 'string' || !HASH.test(output.purposeHash) || typeof output.decision !== 'string' || !DECISIONS.has(output.decision) || !Number.isSafeInteger(output.decidedAt) || output.decidedAt < 0 || typeof output.eventHash !== 'string' || !HASH.test(output.eventHash)) return null;
  return Object.freeze(output);
}

function rpcSnapshot(options) {
  if (!options || typeof options !== 'object') return null;
  let clientDescriptor, roleDescriptor;
  try { clientDescriptor = Object.getOwnPropertyDescriptor(options, 'client'); roleDescriptor = Object.getOwnPropertyDescriptor(options, 'serviceRole'); } catch { return null; }
  if (!clientDescriptor || !Object.hasOwn(clientDescriptor, 'value') || !roleDescriptor || !Object.hasOwn(roleDescriptor, 'value') || roleDescriptor.value !== true || !clientDescriptor.value || typeof clientDescriptor.value !== 'object') return null;
  let rpcDescriptor;
  try { rpcDescriptor = Object.getOwnPropertyDescriptor(clientDescriptor.value, 'rpc'); } catch { return null; }
  if (!rpcDescriptor || !Object.hasOwn(rpcDescriptor, 'value') || typeof rpcDescriptor.value !== 'function') return null;
  return rpcDescriptor.value.bind(clientDescriptor.value);
}

function create(options = {}) {
  const rpc = rpcSnapshot(options);
  if (!rpc) throw new TypeError('A trusted Supabase service-role client is required');
  return Object.freeze({
    version: AUDIT_VERSION,
    durable: true,
    async append(event = {}) {
      const value = eventSnapshot(event);
      if (!value) return false;
      try {
        const { data, error } = await rpc('append_rollout_recovery_deployment_reconciliation_audit', Object.freeze({ p_actor_hash: value.actorHash, p_authorization_hash: value.authorizationHash, p_purpose_hash: value.purposeHash, p_decision: value.decision, p_decided_at_ms: value.decidedAt, p_event_hash: value.eventHash }));
        return !error && (data === 'RECORDED' || data === 'ALREADY_RECORDED');
      } catch { return false; }
    },
  });
}

module.exports = Object.freeze({ AUDIT_VERSION, create });
