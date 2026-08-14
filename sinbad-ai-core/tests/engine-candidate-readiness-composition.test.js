'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const ports = require('../engine-port-contracts.js');
const isolation = require('../engine-isolation-profile-contracts.js');
const readiness = require('../engine-candidate-readiness-composition.js');

const manifest = (overrides = {}) => ({ version: ports.VERSION, engineId: 'design-engine', engineVersion: '1.0.0', port: 'O', contractVersion: 'sinbad-port-o/1-v1', safetyClass: 'ADVISORY', modes: ['READ_ONLY'], requiresTenantScope: true, requiresVesselScope: false, requiresHumanApproval: true, directCoreWrite: false, directProductionWrite: false, provenancePolicyHash: 'a'.repeat(64), licensePolicyHash: 'b'.repeat(64), sandboxProfile: 'isolated-content-engine', validationProfile: 'content-engine-v1', ...overrides });
const profile = (overrides = {}) => ({ version: isolation.VERSION, profileId: 'isolated-content-engine', engineId: 'design-engine', filesystemAccess: 'NONE', networkAccess: 'NONE', processExecution: 'NONE', environmentAccess: 'NONE', secretAccess: 'NONE', dynamicModuleLoad: false, nativeCode: false, memoryLimitMiB: 256, ...overrides });

test('complete inert inputs still require external assurance and explicit activation', () => {
  const result = readiness.assess({ manifest: manifest(), isolationProfile: profile() });
  assert.equal(result.reasonCode, 'ENGINE_CANDIDATE_EXTERNAL_ASSURANCE_REQUIRED');
  assert.equal(result.ready, false);
  assert.equal(result.loadAllowed, false);
  assert.equal(result.executeAllowed, false);
  assert.equal(result.activationAllowed, false);
  assert.equal(result.assuranceGaps.includes('EXPLICIT_ACTIVATION_DECISION_REQUIRED'), true);
});

test('manifest isolation and identity failures remain distinctly blocked', () => {
  assert.equal(readiness.assess({ manifest: manifest({ execute() {} }), isolationProfile: profile() }).reasonCode, 'ENGINE_CANDIDATE_MANIFEST_REJECTED');
  assert.equal(readiness.assess({ manifest: manifest(), isolationProfile: profile({ networkAccess: 'READ_ONLY' }) }).reasonCode, 'ENGINE_CANDIDATE_ISOLATION_REJECTED');
  assert.equal(readiness.assess({ manifest: manifest(), isolationProfile: profile({ engineId: 'other-engine' }) }).reasonCode, 'ENGINE_CANDIDATE_ISOLATION_IDENTITY_MISMATCH');
});

test('hostile composition roots fail closed without invoking accessors', () => {
  let reads = 0;
  const accessor = { isolationProfile: profile() };
  Object.defineProperty(accessor, 'manifest', { enumerable: true, get() { reads += 1; return manifest(); } });
  for (const value of [null, {}, [], { manifest: manifest(), isolationProfile: profile(), extra: true }, accessor]) {
    const result = readiness.assess(value);
    assert.match(result.status, /BLOCKED$/u);
    assert.equal(result.activationAllowed, false);
  }
  assert.equal(reads, 0);
});

test('every output is immutable deny-only and no execution surface is exported', () => {
  for (const value of [{ manifest: manifest(), isolationProfile: profile() }, null]) {
    const result = readiness.assess(value);
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.assuranceGaps));
    assert.equal(result.ready || result.loadAllowed || result.executeAllowed || result.activationAllowed, false);
  }
  assert.deepEqual(Object.keys(readiness), ['VERSION', 'assess']);
});
