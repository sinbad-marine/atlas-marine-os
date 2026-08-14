'use strict';

const HASH = /^[a-f0-9]{64}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const versions = Object.freeze({
  VesselState: 'sinbad-vessel-state/1-v1',
  OperationalEnvelope: 'sinbad-operational-envelope/1-v1',
  CommandIntent: 'sinbad-command-intent/1-v1',
  SafetyDecision: 'sinbad-safety-decision/1-v1',
  ControlExecutionReceipt: 'sinbad-control-execution-receipt/1-v1',
  HazardAndIncident: 'sinbad-hazard-and-incident/1-v1',
});
const schemas = Object.freeze({
  VesselState: Object.freeze(['version', 'vesselId', 'observedAt', 'evidenceHash', 'sourceCount', 'independentSourceCount', 'disagreementDetected', 'confidencePermille']),
  OperationalEnvelope: Object.freeze(['version', 'envelopeId', 'vesselId', 'validFrom', 'validUntil', 'mode', 'constraintsHash', 'approvalHash']),
  CommandIntent: Object.freeze(['version', 'intentId', 'vesselId', 'actorHash', 'nonceHash', 'idempotencyKey', 'notBefore', 'issuedAt', 'expiresAt', 'commandScopeHash', 'timeAuthorityHash', 'revocationEpoch', 'action', 'parametersHash', 'operationalEnvelopeHash', 'requiresDualApproval']),
  SafetyDecision: Object.freeze(['version', 'intentHash', 'decision', 'reasonCode', 'decidedAt', 'kernelHash']),
  ControlExecutionReceipt: Object.freeze(['version', 'intentHash', 'decisionHash', 'status', 'recordedAt', 'equipmentHash']),
  HazardAndIncident: Object.freeze(['version', 'hazardId', 'vesselId', 'hazardType', 'severity', 'observedAt', 'evidenceHash']),
});
const MODES = new Set(['OBSERVATION', 'DECISION_SUPPORT', 'AUTHORIZED_INTENT', 'SUPERVISED_AUTONOMY', 'MINIMUM_RISK']);
const ACTIONS = new Set(['NAVIGATION', 'MANOEUVRE', 'MACHINERY', 'ENERGY', 'SAFETY', 'EMERGENCY_RESPONSE']);
const DECISIONS = new Set(['REJECTED']);
const RECEIPTS = new Set(['NOT_EXECUTED', 'REJECTED', 'FAILED_SAFE']);
const HAZARDS = new Set(['FIRE', 'FLOODING', 'COLLISION', 'GROUNDING', 'LOSS_OF_PROPULSION', 'POWER_FAILURE', 'CYBER', 'OTHER']);
const SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

function ownSnapshot(kind, input) {
  const fields = schemas[kind];
  if (!fields || !input || typeof input !== 'object' || Array.isArray(input)) return null;
  let keys, symbols;
  try { keys = Object.getOwnPropertyNames(input); symbols = Object.getOwnPropertySymbols(input); } catch { return null; }
  if (symbols.length !== 0 || keys.length !== fields.length || !fields.every(name => keys.includes(name))) return null;
  const output = Object.create(null);
  for (const name of fields) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(input, name); } catch { return null; }
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    output[name] = descriptor.value;
  }
  return output;
}
const safeTime = value => Number.isSafeInteger(value) && value >= 0;
const hash = value => typeof value === 'string' && HASH.test(value);
const id = value => typeof value === 'string' && ID.test(value);
function snapshot(kind, input) {
  const value = ownSnapshot(kind, input);
  if (!value || value.version !== versions[kind]) return null;
  let valid = false;
  if (kind === 'VesselState') valid = id(value.vesselId) && safeTime(value.observedAt) && hash(value.evidenceHash) && Number.isSafeInteger(value.sourceCount) && value.sourceCount >= 1 && value.sourceCount <= 1024 && Number.isSafeInteger(value.independentSourceCount) && value.independentSourceCount >= 0 && value.independentSourceCount <= value.sourceCount && typeof value.disagreementDetected === 'boolean' && Number.isSafeInteger(value.confidencePermille) && value.confidencePermille >= 0 && value.confidencePermille <= 1000 && !(value.independentSourceCount < 2 && value.confidencePermille > 500) && !(value.disagreementDetected && value.confidencePermille > 500);
  if (kind === 'OperationalEnvelope') valid = id(value.envelopeId) && id(value.vesselId) && safeTime(value.validFrom) && safeTime(value.validUntil) && value.validUntil > value.validFrom && typeof value.mode === 'string' && MODES.has(value.mode) && hash(value.constraintsHash) && hash(value.approvalHash);
  if (kind === 'CommandIntent') valid = id(value.intentId) && id(value.vesselId) && hash(value.actorHash) && hash(value.nonceHash) && id(value.idempotencyKey) && safeTime(value.notBefore) && safeTime(value.issuedAt) && safeTime(value.expiresAt) && value.notBefore <= value.issuedAt && value.expiresAt > value.issuedAt && hash(value.commandScopeHash) && hash(value.timeAuthorityHash) && Number.isSafeInteger(value.revocationEpoch) && value.revocationEpoch >= 0 && typeof value.action === 'string' && ACTIONS.has(value.action) && hash(value.parametersHash) && hash(value.operationalEnvelopeHash) && typeof value.requiresDualApproval === 'boolean';
  if (kind === 'SafetyDecision') valid = hash(value.intentHash) && typeof value.decision === 'string' && DECISIONS.has(value.decision) && id(value.reasonCode) && safeTime(value.decidedAt) && hash(value.kernelHash);
  if (kind === 'ControlExecutionReceipt') valid = hash(value.intentHash) && hash(value.decisionHash) && typeof value.status === 'string' && RECEIPTS.has(value.status) && safeTime(value.recordedAt) && hash(value.equipmentHash);
  if (kind === 'HazardAndIncident') valid = id(value.hazardId) && id(value.vesselId) && typeof value.hazardType === 'string' && HAZARDS.has(value.hazardType) && typeof value.severity === 'string' && SEVERITIES.has(value.severity) && safeTime(value.observedAt) && hash(value.evidenceHash);
  return valid ? Object.freeze(value) : null;
}

module.exports = Object.freeze({ versions, schemas, snapshot });
