'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const contracts = require('../engine-port-contracts.js');
const catalogModule = require('../engine-port-candidate-catalog.js');
const evidence = require('../engine-port-candidate-decision-evidence.js');

function manifest() {
  return { version: contracts.VERSION, engineId: 'design-engine', engineVersion: '1.0.0', port: 'O', contractVersion: 'sinbad-port-o/1-v1', safetyClass: 'ADVISORY', modes: ['READ_ONLY'], requiresTenantScope: true, requiresVesselScope: false, requiresHumanApproval: true, directCoreWrite: false, directProductionWrite: false, provenancePolicyHash: 'a'.repeat(64), licensePolicyHash: 'b'.repeat(64), sandboxProfile: 'isolated-content-engine', validationProfile: 'content-engine-v1' };
}

test('seals minimal deterministic evidence only from an authentic catalog entry', () => {
  const entry = catalogModule.create().consider(manifest());
  const first = evidence.seal(entry);
  const second = evidence.seal(entry);
  assert.equal(first.evidenceHash, second.evidenceHash);
  assert.deepEqual(Object.keys(first), ['version', 'status', 'reasonCode', 'durable', 'activationAllowed', 'engineId', 'port', 'evidenceHash']);
  assert.equal(first.durable, false);
  assert.equal(first.activationAllowed, false);
  assert.match(first.status, /BLOCKED$/u);
  assert.ok(Object.isFrozen(first));
});

test('copies clones proxies and rejected results cannot mint evidence', () => {
  const catalog = catalogModule.create();
  const entry = catalog.consider(manifest());
  const duplicate = catalog.consider(manifest());
  for (const value of [{ ...entry }, structuredClone(entry), new Proxy(entry, {}), catalogModule.create().consider({}), duplicate, null]) {
    const result = evidence.seal(value);
    assert.equal(result.status, 'ENGINE_PORT_CANDIDATE_EVIDENCE_BLOCKED');
    assert.equal(result.evidenceHash, null);
    assert.equal(result.activationAllowed, false);
  }
});

test('verification remains non-durable and activation-blocked', () => {
  const sealed = evidence.seal(catalogModule.create().consider(manifest()));
  const verified = evidence.verify(sealed);
  assert.equal(verified.status, 'ENGINE_PORT_CANDIDATE_EVIDENCE_VERIFIED_BLOCKED');
  assert.equal(verified.durable, false);
  assert.equal(verified.activationAllowed, false);
  for (const value of [{ ...sealed }, structuredClone(sealed), null]) {
    assert.equal(evidence.verify(value).status, 'ENGINE_PORT_CANDIDATE_EVIDENCE_BLOCKED');
  }
});

test('exports no persistence approval loading execution or activation surface', () => {
  assert.deepEqual(Object.keys(evidence), ['VERSION', 'seal', 'verify']);
  assert.ok(Object.isFrozen(evidence));
});
