'use strict';

const contracts = require('./engine-port-contracts.js');
const VERSION = 'sinbad-engine-port-candidate-catalog/1-v1';
const MAX_ENTRIES = 256;
const authenticEntries = new WeakSet();

function safeGaps(value) {
  return Object.freeze(Array.isArray(value) ? [...new Set(value.filter(gap => typeof gap === 'string'))].sort() : ['ASSESSMENT_SHAPE_INVALID']);
}

function snapshot(assessment) {
  const entry = Object.freeze({
    catalogVersion: VERSION,
    manifestVersion: assessment.version,
    engineId: assessment.engineId,
    port: assessment.port,
    status: 'ENGINE_PORT_CANDIDATE_CATALOGED_BLOCKED',
    activationAllowed: false,
    loadAllowed: false,
    executeAllowed: false,
    reasonCode: assessment.reasonCode,
    assuranceGaps: safeGaps(assessment.assuranceGaps)
  });
  authenticEntries.add(entry);
  return entry;
}

function isAuthenticEntry(value) {
  return value !== null && typeof value === 'object' && authenticEntries.has(value);
}

function rejected(reasonCode, assuranceGaps, identity = {}) {
  return Object.freeze({
    catalogVersion: VERSION,
    status: 'ENGINE_PORT_CANDIDATE_REJECTED',
    activationAllowed: false,
    loadAllowed: false,
    executeAllowed: false,
    reasonCode,
    ...(typeof identity.engineId === 'string' ? { engineId: identity.engineId } : {}),
    ...(typeof identity.port === 'string' ? { port: identity.port } : {}),
    assuranceGaps: safeGaps(assuranceGaps)
  });
}

function create() {
  const entries = new Map();

  function consider(manifest) {
    const assessment = contracts.assessManifest(manifest);
    const assessmentIsCatalogable = assessment &&
      assessment.status === 'ENGINE_PORT_ACTIVATION_BLOCKED' &&
      assessment.activationAllowed === false &&
      assessment.catalogable === true &&
      typeof assessment.engineId === 'string' && assessment.engineId.length > 0 &&
      typeof assessment.port === 'string' &&
      Array.isArray(assessment.assuranceGaps) && assessment.assuranceGaps.every(gap => typeof gap === 'string');
    if (!assessmentIsCatalogable) return rejected(
      typeof assessment?.reasonCode === 'string' ? assessment.reasonCode : 'ENGINE_PORT_ASSESSMENT_INVALID',
      assessment?.assuranceGaps
    );
    if (entries.has(assessment.engineId)) {
      return rejected('ENGINE_PORT_CANDIDATE_DUPLICATE', ['UNIQUE_ENGINE_ID_REQUIRED'], assessment);
    }
    if (entries.size >= MAX_ENTRIES) {
      return rejected('ENGINE_PORT_CANDIDATE_CAPACITY_REACHED', ['CATALOG_CAPACITY_REVIEW_REQUIRED'], assessment);
    }
    const entry = snapshot(assessment);
    entries.set(entry.engineId, entry);
    return entry;
  }

  function get(engineId) {
    return typeof engineId === 'string' ? entries.get(engineId) || null : null;
  }

  function list() {
    return Object.freeze([...entries.values()].sort((left, right) => left.engineId < right.engineId ? -1 : left.engineId > right.engineId ? 1 : 0));
  }

  return Object.freeze({ consider, get, list });
}

module.exports = Object.freeze({ VERSION, create, isAuthenticEntry });
