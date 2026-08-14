'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const contracts = require('../engine-port-contracts.js');
const catalogModule = require('../engine-port-candidate-catalog.js');

const manifest = (engineId, overrides = {}) => ({
  version: contracts.VERSION,
  engineId,
  engineVersion: '1.0.0',
  port: 'O',
  contractVersion: 'sinbad-port-o/1-v1',
  safetyClass: 'ADVISORY',
  modes: ['READ_ONLY'],
  requiresTenantScope: true,
  requiresVesselScope: false,
  requiresHumanApproval: true,
  directCoreWrite: false,
  directProductionWrite: false,
  provenancePolicyHash: 'a'.repeat(64),
  licensePolicyHash: 'b'.repeat(64),
  sandboxProfile: 'isolated-content-engine',
  validationProfile: 'content-engine-v1',
  ...overrides
});

test('catalogs only inert assessment metadata and never the supplied manifest', () => {
  const catalog = catalogModule.create();
  const candidate = manifest('design-engine');
  const result = catalog.consider(candidate);
  assert.equal(result.status, 'ENGINE_PORT_CANDIDATE_CATALOGED_BLOCKED');
  assert.equal(result.activationAllowed, false);
  assert.equal(result.loadAllowed, false);
  assert.equal(result.executeAllowed, false);
  assert.equal('manifest' in result, false);
  assert.equal('module' in result, false);
  assert.equal('callback' in result, false);
  candidate.engineVersion = '9.9.9';
  assert.equal(catalog.get('design-engine'), result);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.assuranceGaps));
});

test('rejects invalid executable and duplicate candidates without catalog mutation', () => {
  const catalog = catalogModule.create();
  for (const value of [null, {}, manifest('bad-engine', { execute() {} }), manifest('write-engine', { directCoreWrite: true })]) {
    const result = catalog.consider(value);
    assert.equal(result.status, 'ENGINE_PORT_CANDIDATE_REJECTED');
    assert.equal(result.activationAllowed, false);
    assert.equal(result.loadAllowed, false);
    assert.equal(result.executeAllowed, false);
  }
  assert.deepEqual(catalog.list(), []);
  catalog.consider(manifest('design-engine'));
  const duplicate = catalog.consider(manifest('design-engine'));
  assert.equal(duplicate.reasonCode, 'ENGINE_PORT_CANDIDATE_DUPLICATE');
  assert.equal(duplicate.engineId, 'design-engine');
  assert.equal(duplicate.port, 'O');
  assert.equal(catalog.list().length, 1);
});

test('lists deterministic immutable blocked snapshots only', () => {
  const catalog = catalogModule.create();
  catalog.consider(manifest('zeta-engine'));
  catalog.consider(manifest('alpha-engine'));
  const entries = catalog.list();
  assert.deepEqual(entries.map(entry => entry.engineId), ['alpha-engine', 'zeta-engine']);
  assert.ok(Object.isFrozen(entries));
  for (const entry of entries) {
    assert.match(entry.status, /BLOCKED$/u);
    assert.equal(entry.activationAllowed || entry.loadAllowed || entry.executeAllowed, false);
  }
  assert.equal(catalog.get('missing-engine'), null);
  assert.equal(catalog.get({ toString() { throw new Error('must not coerce'); } }), null);
});

test('exports no loader executor activator or removal surface', () => {
  assert.deepEqual(Object.keys(catalogModule), ['VERSION', 'create']);
  assert.deepEqual(Object.keys(catalogModule.create()), ['consider', 'get', 'list']);
  assert.ok(Object.isFrozen(catalogModule));
});

test('fails closed at the bounded process-local catalog capacity', () => {
  const catalog = catalogModule.create();
  for (let index = 0; index < 256; index += 1) {
    const engineId = `engine-${String(index).padStart(3, '0')}`;
    assert.equal(catalog.consider(manifest(engineId)).status, 'ENGINE_PORT_CANDIDATE_CATALOGED_BLOCKED');
  }
  const overflow = catalog.consider(manifest('engine-overflow'));
  assert.equal(overflow.reasonCode, 'ENGINE_PORT_CANDIDATE_CAPACITY_REACHED');
  assert.equal(overflow.activationAllowed, false);
  assert.equal(catalog.list().length, 256);
});
