'use strict';

const { createHash } = require('node:crypto');
const EVENT_VERSION = 'sinbad-rollout-recovery-deployment-reconciliation-audit/4G-v1';
const VERIFIER_VERSION = 'sinbad-rollout-recovery-deployment-reconciliation-audit-verifier/4I-v1';
const HASH = /^[a-f0-9]{64}$/u;
const DECISIONS = new Set(['AUTHORIZED', 'DENIED']);
const ROW_FIELDS = Object.freeze(['id', 'actor_hash', 'authorization_hash', 'purpose_hash', 'decision', 'decided_at_ms', 'event_hash']);
const digest = row => createHash('sha256').update([EVENT_VERSION, row.actorHash, row.authorizationHash, row.purposeHash, row.decision, row.decidedAt].join('\n')).digest('hex');
const summary = (status, reasonCode, eventCount = 0, pageCount = 0, watermarkId = null) => Object.freeze({ version: VERIFIER_VERSION, status, reasonCode, eventCount, pageCount, watermarkId });
function scanPolicy(input) {
  if (!input || typeof input !== 'object') return null;
  const output = Object.create(null);
  for (const [name, fallback] of [['pageSize', 100], ['maxEvents', 10000]]) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(input, name); } catch { return null; }
    const value = descriptor === undefined ? fallback : Object.hasOwn(descriptor, 'value') ? descriptor.value : null;
    if (!Number.isSafeInteger(value)) return null;
    output[name] = value;
  }
  if (output.pageSize < 1 || output.pageSize > 500 || output.maxEvents < output.pageSize || output.maxEvents > 100000) return null;
  return Object.freeze(output);
}

function rowSnapshot(row) {
  if (!row || typeof row !== 'object') return null;
  const raw = Object.create(null);
  for (const name of ROW_FIELDS) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(row, name); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    raw[name] = descriptor.value;
  }
  if (!Number.isSafeInteger(raw.id) || !Number.isSafeInteger(raw.decided_at_ms)) return null;
  for (const name of ['actor_hash', 'authorization_hash', 'purpose_hash', 'decision', 'event_hash']) if (typeof raw[name] !== 'string') return null;
  return Object.freeze(raw);
}

function parse(data) {
  if (!Array.isArray(data)) return null;
  const output = [];
  for (const row of data) {
    const raw = rowSnapshot(row);
    if (!raw) return null;
    const value = { id: raw.id, actorHash: raw.actor_hash, authorizationHash: raw.authorization_hash, purposeHash: raw.purpose_hash, decision: raw.decision, decidedAt: raw.decided_at_ms, eventHash: raw.event_hash };
    if (!Number.isSafeInteger(value.id) || value.id < 1 || !HASH.test(value.actorHash) || !HASH.test(value.authorizationHash) || !HASH.test(value.purposeHash) || !DECISIONS.has(value.decision) || !Number.isSafeInteger(value.decidedAt) || value.decidedAt < 0 || !HASH.test(value.eventHash) || digest(value) !== value.eventHash) return null;
    output.push(value);
  }
  return output;
}

function create(options = {}) {
  if (!options.client || typeof options.client.rpc !== 'function' || options.serviceRole !== true) throw new TypeError('A trusted Supabase service-role client is required');
  const rpc = options.client.rpc.bind(options.client);
  async function capability() { try { const { data, error } = await rpc('verify_rollout_recovery_deployment_reconciliation_audit_access', {}); return !error && data === true; } catch { return false; } }
  return Object.freeze({
    version: VERIFIER_VERSION,
    async scan(input = {}) {
      const policy = scanPolicy(input);
      if (!policy) return summary('AUDIT_SCAN_UNAVAILABLE', 'AUDIT_INVALID_SCAN_ARGS');
      const { pageSize, maxEvents } = policy;
      let before = null, previous = Number.MAX_SAFE_INTEGER, count = 0, pages = 0, watermark = null;
      while (true) {
        if (!await capability()) return summary('AUDIT_SCAN_UNAVAILABLE', 'AUDIT_CAPABILITY_DENIED', count, pages, watermark);
        let response;
        try { response = await rpc('list_rollout_recovery_deployment_reconciliation_audit', { p_limit: pageSize, p_before_id: before }); }
        catch { return summary('AUDIT_SCAN_UNAVAILABLE', 'AUDIT_STORE_UNAVAILABLE', count, pages, watermark); }
        if (response.error) return summary('AUDIT_SCAN_UNAVAILABLE', 'AUDIT_STORE_UNAVAILABLE', count, pages, watermark);
        const rows = parse(response.data);
        if (!rows) return summary('AUDIT_SCAN_INTEGRITY_FAILED', 'AUDIT_EVENT_HASH_MISMATCH', count, pages, watermark);
        pages++;
        if (rows.length === 0) return summary('AUDIT_SCAN_COMPLETE', null, count, pages, watermark);
        if (watermark === null) watermark = rows[0].id;
        for (const row of rows) { if (row.id >= previous) return summary('AUDIT_SCAN_INTEGRITY_FAILED', 'AUDIT_ORDER_INVALID', count, pages, watermark); previous = row.id; if (count < maxEvents) count++; }
        if (count >= maxEvents) return summary('AUDIT_SCAN_INCOMPLETE', 'AUDIT_SCAN_LIMIT_REACHED', count, pages, watermark);
        before = rows.at(-1).id;
      }
    },
  });
}

module.exports = Object.freeze({ EVENT_VERSION, VERIFIER_VERSION, ROW_FIELDS, rowSnapshot, parse, scanPolicy, create });
