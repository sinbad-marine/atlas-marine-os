'use strict';

const verifierModule = require('../sinbad-ai-core/adapters/supabase-rollout-recovery-deployment-reconciliation-audit-verifier.js');

const READINESS_VERSION = 'sinbad-rollout-recovery-deployment-reconciliation-audit-readiness/4J-v1';
const EXPECTED_VERIFIER_VERSION = 'sinbad-rollout-recovery-deployment-reconciliation-audit-verifier/4I-v1';
if (verifierModule.VERIFIER_VERSION !== EXPECTED_VERIFIER_VERSION) throw new Error(`Unsupported verifier version: ${verifierModule.VERIFIER_VERSION}`);
const result = (status, reasonCode, eventCount = null, pageCount = null, watermarkId = null) => Object.freeze({ version: READINESS_VERSION, status, reasonCode, eventCount: Number.isSafeInteger(eventCount) ? eventCount : null, pageCount: Number.isSafeInteger(pageCount) ? pageCount : null, watermarkId: Number.isSafeInteger(watermarkId) ? watermarkId : null });
const DECISION_FIELDS = Object.freeze(['version', 'status', 'reasonCode', 'eventCount', 'pageCount', 'watermarkId']);
const SCAN_FIELDS = Object.freeze(['version', 'status', 'reasonCode', 'eventCount', 'pageCount', 'watermarkId']);
const SCAN_REASONS = Object.freeze(new Set(['AUDIT_INVALID_SCAN_ARGS', 'AUDIT_CAPABILITY_DENIED', 'AUDIT_STORE_UNAVAILABLE', 'AUDIT_EVENT_HASH_MISMATCH', 'AUDIT_ORDER_INVALID', 'AUDIT_SCAN_LIMIT_REACHED']));
function snapshot(value) {
  if (!value || typeof value !== 'object') return null;
  const output = Object.create(null);
  for (const name of DECISION_FIELDS) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(value, name); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    output[name] = descriptor.value;
  }
  return Object.freeze(output);
}
function validDecision(value) {
  const output = snapshot(value);
  return Boolean(output && output.version === READINESS_VERSION && output.status === 'RECONCILIATION_AUDIT_READINESS_READY' && output.reasonCode === null && Number.isSafeInteger(output.eventCount) && output.eventCount >= 0 && Number.isSafeInteger(output.pageCount) && output.pageCount >= 1 && (output.watermarkId === null || (Number.isSafeInteger(output.watermarkId) && output.watermarkId >= 1)) && ((output.eventCount === 0) === (output.watermarkId === null)));
}
function scanSnapshot(value) {
  if (!value || typeof value !== 'object') return null;
  const output = Object.create(null);
  for (const name of SCAN_FIELDS) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(value, name); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    output[name] = descriptor.value;
  }
  if (output.version !== EXPECTED_VERIFIER_VERSION || typeof output.status !== 'string' || (output.reasonCode !== null && typeof output.reasonCode !== 'string')) return null;
  for (const name of ['eventCount', 'pageCount']) if (output[name] !== null && (!Number.isSafeInteger(output[name]) || output[name] < 0)) return null;
  if (output.watermarkId !== null && (!Number.isSafeInteger(output.watermarkId) || output.watermarkId < 1)) return null;
  return Object.freeze(output);
}
function verifierSnapshot(value) {
  if (!value || typeof value !== 'object') return null;
  const output = Object.create(null);
  for (const name of ['version', 'scan']) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(value, name); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    output[name] = descriptor.value;
  }
  if (output.version !== EXPECTED_VERIFIER_VERSION || typeof output.scan !== 'function') return null;
  output.scan = output.scan.bind(value);
  return Object.freeze(output);
}
function policy(options) {
  if (!options || typeof options !== 'object') return null;
  const output = Object.create(null);
  for (const name of ['auditVerifier', 'pageSize', 'maxEvents']) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(options, name); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    output[name] = descriptor.value;
  }
  output.auditVerifier = verifierSnapshot(output.auditVerifier);
  if (!output.auditVerifier || !Number.isSafeInteger(output.pageSize) || output.pageSize < 1 || output.pageSize > 500 || !Number.isSafeInteger(output.maxEvents) || output.maxEvents < output.pageSize || output.maxEvents > 100000) return null;
  return Object.freeze(output);
}

function create(options = {}) {
  const value = policy(options);
  if (!value) throw new TypeError('A trusted auditVerifier and bounded audit readiness scan policy are required');
  const { auditVerifier: verifier, pageSize, maxEvents } = value;
  return Object.freeze({
    version: READINESS_VERSION,
    async check() {
      let scan;
      try { scan = scanSnapshot(await verifier.scan({ pageSize, maxEvents })); }
      catch { return result('RECONCILIATION_AUDIT_READINESS_BLOCKED', 'AUDIT_SCAN_EXCEPTION'); }
      if (!scan) return result('RECONCILIATION_AUDIT_READINESS_BLOCKED', 'AUDIT_SCAN_CONTRACT_INVALID');
      if (scan.status !== 'AUDIT_SCAN_COMPLETE' || scan.reasonCode !== null) return result('RECONCILIATION_AUDIT_READINESS_BLOCKED', SCAN_REASONS.has(scan.reasonCode) ? scan.reasonCode : 'AUDIT_SCAN_NOT_COMPLETE', scan.eventCount, scan.pageCount, scan.watermarkId);
      if (!Number.isSafeInteger(scan.eventCount) || scan.eventCount < 0 || !Number.isSafeInteger(scan.pageCount) || scan.pageCount < 1 || (scan.watermarkId !== null && (!Number.isSafeInteger(scan.watermarkId) || scan.watermarkId < 1)) || ((scan.eventCount === 0) !== (scan.watermarkId === null))) return result('RECONCILIATION_AUDIT_READINESS_BLOCKED', 'AUDIT_SCAN_CONTRACT_INVALID');
      return result('RECONCILIATION_AUDIT_READINESS_READY', null, scan.eventCount, scan.pageCount, scan.watermarkId);
    },
  });
}

module.exports = Object.freeze({ READINESS_VERSION, EXPECTED_VERIFIER_VERSION, DECISION_FIELDS, SCAN_FIELDS, SCAN_REASONS, snapshot, validDecision, scanSnapshot, verifierSnapshot, policy, create });
