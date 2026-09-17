'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const l=require('../authority/claim-labels.js');
const claim=changes=>({claimId:'claim-1',evidenceClasses:['REPOSITORY'],conflict:false,applicable:true,...changes});

test('labels follow from source classes, never from wording',()=>{
  assert.equal(l.labelClaim(claim()).label,'VERIFIED');
  assert.equal(l.labelClaim(claim({evidenceClasses:[]})).label,'SOURCE_MISSING');
  assert.equal(l.labelClaim(claim({conflict:true})).label,'CONFLICT');
  assert.equal(l.labelClaim(claim({applicable:false})).label,'NOT_APPLICABLE');
  const normativeOnly=l.labelClaim(claim({evidenceClasses:['OWNER_DIRECTIVE']}));
  assert.equal(normativeOnly.label,'NOT_VERIFIED');assert.equal(normativeOnly.reasonCode,'NORMATIVE_ONLY_CANNOT_ESTABLISH_FACT');
  const memoryOnly=l.labelClaim(claim({evidenceClasses:['MODEL_MEMORY','MODEL_INFERENCE']}));
  assert.equal(memoryOnly.label,'NOT_VERIFIED');assert.equal(memoryOnly.reasonCode,'NON_AUTHORITATIVE_ONLY');
  assert.equal(l.labelClaim(claim({evidenceClasses:['MODEL_MEMORY','LIVE_SYSTEM']})).label,'VERIFIED');
  assert.equal(Object.isFrozen(l.labelClaim(claim())),true);
});

test('invalid claim input is BLOCKED, not guessed',()=>{
  for(const bad of [null,[],claim({extra:1}),claim({evidenceClasses:['nope']}),claim({conflict:'no'}),claim({claimId:''}),Object.create(claim())]){assert.deepEqual(l.labelClaim(bad),{version:l.VERSION,label:'BLOCKED',reasonCode:'CLAIM_INPUT_INVALID'});}
  const accessor={};Object.defineProperty(accessor,'claimId',{get(){return 'claim-1';},enumerable:true});Object.assign(accessor,{evidenceClasses:['REPOSITORY'],conflict:false,applicable:true});
  assert.equal(l.labelClaim(accessor).label,'BLOCKED');
});

test('reserved terms are detected as whole words and must be bound to evidence',()=>{
  assert.deepEqual([...l.detectReservedTerms('The PR is MERGED and the server is online; AAL2 verified.')],['VERIFIED','MERGED','ONLINE','AAL2']);
  assert.deepEqual([...l.detectReservedTerms('unverified, passport, offline, compliantly')],[]);
  assert.deepEqual([...l.detectReservedTerms('Owner  accepted and ready for merge')],['OWNER ACCEPTED','READY FOR MERGE']);
  const bound=l.reservedTermsBound('main is MERGED and ONLINE',['merged']);
  assert.equal(bound.status,'RESERVED_TERMS_UNBOUND');assert.deepEqual([...bound.unbound],['ONLINE']);
  assert.equal(l.reservedTermsBound('main is MERGED',['MERGED']).status,'RESERVED_TERMS_BOUND');
  assert.equal(l.reservedTermsBound(12,[]).status,'RESERVED_TERMS_BOUND');
});

test('label vocabulary is exactly the six truth states and the module is frozen',()=>{
  assert.deepEqual([...l.LABELS],['VERIFIED','NOT_VERIFIED','CONFLICT','SOURCE_MISSING','BLOCKED','NOT_APPLICABLE']);
  assert.equal(Object.isFrozen(l),true);assert.deepEqual(Object.keys(l),['VERSION','LABELS','RESERVED_TERMS','detectReservedTerms','reservedTermsBound','labelClaim']);
});
