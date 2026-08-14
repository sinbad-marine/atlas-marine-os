'use strict';

const { createHash } = require('node:crypto');

const AUDIT_VERSION = 'sinbad-rollout-recovery-deployment-reconciliation-audit/4G-v1';
const HASH = /^[a-f0-9]{64}$/u;
const DECISIONS = new Set(['AUTHORIZED', 'DENIED']);
const EVENT_FIELDS = Object.freeze(['actorHash', 'authorizationHash', 'purposeHash', 'decision', 'decidedAt']);
const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');

function create(options = {}) {
  let appendDescriptor, durableDescriptor;
  try { appendDescriptor = Object.getOwnPropertyDescriptor(options, 'append'); durableDescriptor = Object.getOwnPropertyDescriptor(options, 'durable'); }
  catch { throw new TypeError('A trusted durable audit append function is required'); }
  if (!appendDescriptor || !Object.hasOwn(appendDescriptor, 'value') || typeof appendDescriptor.value !== 'function' || !durableDescriptor || !Object.hasOwn(durableDescriptor, 'value') || durableDescriptor.value !== true) throw new TypeError('A trusted durable audit append function is required');
  const append = appendDescriptor.value;
  return Object.freeze({
    version: AUDIT_VERSION,
    durable: true,
    async record(input = {}) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) return Object.freeze({ status: 'INVALID', eventHash: null });
      const raw = Object.create(null);
      for (const name of EVENT_FIELDS) {
        let descriptor;
        try { descriptor = Object.getOwnPropertyDescriptor(input, name); } catch { return Object.freeze({ status: 'INVALID', eventHash: null }); }
        if (!descriptor || !Object.hasOwn(descriptor, 'value')) return Object.freeze({ status: 'INVALID', eventHash: null });
        raw[name] = descriptor.value;
      }
      const { actorHash, authorizationHash, purposeHash, decision, decidedAt } = raw;
      if (typeof actorHash !== 'string' || typeof authorizationHash !== 'string' || typeof purposeHash !== 'string' || typeof decision !== 'string') return Object.freeze({ status: 'INVALID', eventHash: null });
      if (!HASH.test(actorHash) || !HASH.test(authorizationHash) || !HASH.test(purposeHash) || !DECISIONS.has(decision) || !Number.isSafeInteger(decidedAt) || decidedAt < 0) return Object.freeze({ status: 'INVALID', eventHash: null });
      const eventHash = sha256([AUDIT_VERSION, actorHash, authorizationHash, purposeHash, decision, decidedAt].join('\n'));
      const event = Object.freeze({ version: AUDIT_VERSION, actorHash, authorizationHash, purposeHash, decision, decidedAt, eventHash });
      try { return Object.freeze({ status: await append(event) === true ? 'RECORDED' : 'DENIED', eventHash }); }
      catch { return Object.freeze({ status: 'UNAVAILABLE', eventHash: null }); }
    },
  });
}

module.exports = Object.freeze({ AUDIT_VERSION, EVENT_FIELDS, create });
