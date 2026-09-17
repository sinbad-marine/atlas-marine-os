'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const m=require('../authority/authority-model.js');

test('two dimensions: normative sources authorize, observed sources establish facts, model output does neither',()=>{
  for(const c of ['OWNER_DIRECTIVE','GOVERNANCE_POLICY','AUTHORIZATION','RELEASE_DECISION']){assert.equal(m.dimension(c),'NORMATIVE');assert.equal(m.canAuthorize(c),true);assert.equal(m.canEstablishFact(c),false);}
  for(const c of ['LIVE_SYSTEM','DATABASE','REPOSITORY','TEST_CI','DOCUMENT','EXTERNAL_AUTHORITATIVE_SOURCE']){assert.equal(m.dimension(c),'OBSERVED');assert.equal(m.canAuthorize(c),false);assert.equal(m.canEstablishFact(c),true);}
  for(const c of ['MODEL_MEMORY','MODEL_INFERENCE']){assert.equal(m.dimension(c),'NONE');assert.equal(m.canAuthorize(c),false);assert.equal(m.canEstablishFact(c),false);}
  assert.equal(m.dimension('owner_directive'),null);assert.equal(m.describe('nope'),null);
  assert.equal(Object.isFrozen(m.describe('LIVE_SYSTEM')),true);assert.equal(m.describe('LIVE_SYSTEM').observedQualityRank,0);assert.equal(m.describe('OWNER_DIRECTIVE').observedQualityRank,null);
});

test('an owner statement that a server is online is not evidence, and an observation cannot override a prohibition',()=>{
  const cross=m.classifyConflict('OWNER_DIRECTIVE','LIVE_SYSTEM');
  assert.equal(cross.kind,'CROSS_DIMENSION_NOT_A_CONFLICT');assert.equal(cross.resolution,'RECORD_BOTH_REPORT_GAP');
  assert.equal(m.classifyConflict('GOVERNANCE_POLICY','DATABASE').kind,'CROSS_DIMENSION_NOT_A_CONFLICT');
});

test('observed conflicts prefer the higher-quality observation of the same fact; equal quality stays unresolved',()=>{
  const c=m.classifyConflict('DOCUMENT','LIVE_SYSTEM');
  assert.equal(c.kind,'OBSERVED_CONFLICT');assert.equal(c.resolution,'PREFER_HIGHER_QUALITY_OBSERVATION');assert.equal(c.preferred,'LIVE_SYSTEM');
  const same=m.classifyConflict('DOCUMENT','DOCUMENT');
  assert.equal(same.resolution,'CONFLICT_UNRESOLVED_SAME_QUALITY');assert.equal(same.preferred,null);
});

test('normative conflicts escalate to the owner; non-authoritative inputs are discarded; invalid classes are invalid',()=>{
  assert.deepEqual(m.classifyConflict('OWNER_DIRECTIVE','RELEASE_DECISION'),{version:m.VERSION,kind:'NORMATIVE_CONFLICT_OWNER_ESCALATION',resolution:'OWNER_DECISION_REQUIRED'});
  assert.deepEqual(m.classifyConflict('MODEL_INFERENCE','LIVE_SYSTEM'),{version:m.VERSION,kind:'NON_AUTHORITATIVE_INPUT',resolution:'DISCARD_NON_AUTHORITATIVE'});
  assert.deepEqual(m.classifyConflict('LIVE_SYSTEM','x'),{version:m.VERSION,kind:'INVALID',resolution:null});
});

test('exports are frozen and grant no verification or authorization capability',()=>{
  assert.equal(Object.isFrozen(m),true);assert.equal(Object.isFrozen(m.SOURCE_CLASSES),true);
  assert.deepEqual(Object.keys(m),['VERSION','DIMENSIONS','SOURCE_CLASSES','OBSERVED_QUALITY','CONFLICT_KINDS','isSourceClass','dimension','canAuthorize','canEstablishFact','describe','classifyConflict']);
});
