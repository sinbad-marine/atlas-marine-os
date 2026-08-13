'use strict';

const verifierModule = require('../sinbad-ai-core/adapters/supabase-rollout-recovery-deployment-reconciliation-audit-verifier.js');

const READINESS_VERSION = 'sinbad-rollout-recovery-deployment-reconciliation-audit-readiness/4J-v1';
const EXPECTED_VERIFIER_VERSION = 'sinbad-rollout-recovery-deployment-reconciliation-audit-verifier/4I-v1';
if (verifierModule.VERIFIER_VERSION !== EXPECTED_VERIFIER_VERSION) throw new Error(`Unsupported verifier version: ${verifierModule.VERIFIER_VERSION}`);
const result = (status, reasonCode, eventCount = null, pageCount = null, watermarkId = null) => Object.freeze({ version: READINESS_VERSION, status, reasonCode, eventCount: Number.isSafeInteger(eventCount) ? eventCount : null, pageCount: Number.isSafeInteger(pageCount) ? pageCount : null, watermarkId: Number.isSafeInteger(watermarkId) ? watermarkId : null });

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

module.exports = Object.freeze({ READINESS_VERSION, EXPECTED_VERIFIER_VERSION, create });
