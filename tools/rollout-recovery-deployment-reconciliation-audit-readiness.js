'use strict';

const verifierModule = require('../sinbad-ai-core/adapters/supabase-rollout-recovery-deployment-reconciliation-audit-verifier.js');

const READINESS_VERSION = 'sinbad-rollout-recovery-deployment-reconciliation-audit-readiness/4J-v1';
const EXPECTED_VERIFIER_VERSION = 'sinbad-rollout-recovery-deployment-reconciliation-audit-verifier/4I-v1';
if (verifierModule.VERIFIER_VERSION !== EXPECTED_VERIFIER_VERSION) throw new Error(`Unsupported verifier version: ${verifierModule.VERIFIER_VERSION}`);
const result = (status, reasonCode, eventCount = null, pageCount = null, watermarkId = null) => Object.freeze({ version: READINESS_VERSION, status, reasonCode, eventCount: Number.isSafeInteger(eventCount) ? eventCount : null, pageCount: Number.isSafeInteger(pageCount) ? pageCount : null, watermarkId: Number.isSafeInteger(watermarkId) ? watermarkId : null });
const DECISION_FIELDS = Object.freeze(['version', 'status', 'reasonCode', 'eventCount', 'pageCount', 'watermarkId']);
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
  return Boolean(value && value.version === READINESS_VERSION && value.status === 'RECONCILIATION_AUDIT_READINESS_READY' && value.reasonCode === null && Number.isSafeInteger(value.eventCount) && value.eventCount >= 0 && Number.isSafeInteger(value.pageCount) && value.pageCount >= 1 && (value.watermarkId === null || (Number.isSafeInteger(value.watermarkId) && value.watermarkId >= 1)) && ((value.eventCount === 0) === (value.watermarkId === null)));
}

function create(options = {}) {
  const verifier = options.auditVerifier;
  const pageSize = Number(options.pageSize), maxEvents = Number(options.maxEvents);
  if (!verifier || verifier.version !== EXPECTED_VERIFIER_VERSION || typeof verifier.scan !== 'function') throw new TypeError('A trusted auditVerifier is required');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500 || !Number.isInteger(maxEvents) || maxEvents < pageSize || maxEvents > 100000) throw new TypeError('A bounded audit readiness scan policy is required');
  return Object.freeze({
    version: READINESS_VERSION,
    async check() {
      let scan;
      try { scan = await verifier.scan({ pageSize, maxEvents }); }
      catch { return result('RECONCILIATION_AUDIT_READINESS_BLOCKED', 'AUDIT_SCAN_EXCEPTION'); }
      if (scan?.version !== EXPECTED_VERIFIER_VERSION || scan.status !== 'AUDIT_SCAN_COMPLETE' || scan.reasonCode !== null) return result('RECONCILIATION_AUDIT_READINESS_BLOCKED', String(scan?.reasonCode || 'AUDIT_SCAN_NOT_COMPLETE'), scan?.eventCount, scan?.pageCount, scan?.watermarkId);
      if (!Number.isSafeInteger(scan.eventCount) || scan.eventCount < 0 || !Number.isSafeInteger(scan.pageCount) || scan.pageCount < 1 || (scan.watermarkId !== null && (!Number.isSafeInteger(scan.watermarkId) || scan.watermarkId < 1)) || ((scan.eventCount === 0) !== (scan.watermarkId === null))) return result('RECONCILIATION_AUDIT_READINESS_BLOCKED', 'AUDIT_SCAN_CONTRACT_INVALID');
      return result('RECONCILIATION_AUDIT_READINESS_READY', null, scan.eventCount, scan.pageCount, scan.watermarkId);
    },
  });
}

module.exports = Object.freeze({ READINESS_VERSION, EXPECTED_VERIFIER_VERSION, DECISION_FIELDS, snapshot, validDecision, create });
