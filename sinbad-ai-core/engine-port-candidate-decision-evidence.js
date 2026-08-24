'use strict';

const { createHash } = require('node:crypto');
const catalog = require('./engine-port-candidate-catalog.js');
const VERSION = 'sinbad-engine-port-candidate-decision-evidence/1-v1';
const authenticEvidence = new WeakSet();
const manifests = new WeakMap();

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function blocked(reasonCode) {
  return Object.freeze({
    version: VERSION,
    status: 'ENGINE_PORT_CANDIDATE_EVIDENCE_BLOCKED',
    reasonCode,
    durable: false,
    activationAllowed: false,
    evidenceHash: null
  });
}

function seal(entry) {
  if (
    !catalog.isAuthenticEntry(entry) ||
    entry.status !== 'ENGINE_PORT_CANDIDATE_CATALOGED_BLOCKED' ||
    entry.reasonCode !== 'ENGINE_PORT_ASSURANCE_INCOMPLETE' ||
    entry.activationAllowed !== false ||
    entry.loadAllowed !== false ||
    entry.executeAllowed !== false ||
    !Array.isArray(entry.assuranceGaps) ||
    !entry.assuranceGaps.every(gap => typeof gap === 'string')
  ) return blocked('AUTHENTIC_CATALOG_ENTRY_REQUIRED');
  const manifest = Object.freeze({
    version: VERSION,
    catalogVersion: entry.catalogVersion,
    manifestVersion: entry.manifestVersion,
    engineId: entry.engineId,
    port: entry.port,
    catalogStatus: entry.status,
    catalogReasonCode: entry.reasonCode,
    assuranceGapsHash: sha256(canonical(entry.assuranceGaps))
  });
  const evidence = Object.freeze({
    version: VERSION,
    status: 'ENGINE_PORT_CANDIDATE_EVIDENCE_SEALED_BLOCKED',
    reasonCode: 'DURABLE_AUDIT_AND_ACTIVATION_DECISION_REQUIRED',
    durable: false,
    activationAllowed: false,
    engineId: manifest.engineId,
    port: manifest.port,
    evidenceHash: sha256(canonical(manifest))
  });
  authenticEvidence.add(evidence);
  manifests.set(evidence, manifest);
  return evidence;
}

function verify(value) {
  if (!authenticEvidence.has(value)) return blocked('AUTHENTIC_CANDIDATE_EVIDENCE_REQUIRED');
  const manifest = manifests.get(value);
  if (!manifest || value.evidenceHash !== sha256(canonical(manifest))) return blocked('CANDIDATE_EVIDENCE_INTEGRITY_FAILED');
  return Object.freeze({
    version: VERSION,
    status: 'ENGINE_PORT_CANDIDATE_EVIDENCE_VERIFIED_BLOCKED',
    reasonCode: 'DURABLE_AUDIT_AND_ACTIVATION_DECISION_REQUIRED',
    durable: false,
    activationAllowed: false,
    evidenceHash: value.evidenceHash
  });
}

module.exports = Object.freeze({ VERSION, seal, verify });
