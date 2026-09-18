'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {d,k,NOW,context,passage,input,rehearseOne}=require('./helpers/draft-adapter-v0-builders.js');
const evidenceSet=require('../authority/evidence-set.js');const gatekeeper=require('../gatekeeper/gatekeeper-v0.js');
const CITED='The ISM Code requires a safety management system [S1]. The company must designate a person ashore [S2].';

test('an adapted draft is one chain pass in the consumers own shapes; the record is frozen, sealed and interprets nothing',()=>{
  const a=d.adapt(input(CITED));
  assert.equal(a.status,'ADAPTED');assert.equal(a.failClosed,false);assert.equal(a.reasonCode,'ADAPTED');assert.equal(a.taskRef,'task-1');assert.deepEqual([...a.warnings],[]);
  assert.equal(a.authority,'NONE');for(const flag of ['interprets','rewrites','callsModel','executes','approves','grantsAuthority'])assert.equal(a[flag],false,flag);
  assert.equal(Object.isFrozen(a),true);assert.equal(Object.isFrozen(a.chainPass.draft.claims),true);assert.equal(d.verifyAdaptation(a),true);
  assert.deepEqual(Object.keys(a.chainPass),[...k.PASS_FIELDS]);
  assert.notEqual(evidenceSet.snapshot(JSON.parse(JSON.stringify(a.chainPass.evidenceSet))),null);assert.notEqual(gatekeeper.draft(JSON.parse(JSON.stringify(a.chainPass.draft))),null);
  assert.equal(a.chainPass.evidenceSet.setId,'adapt-1.set');assert.equal(a.chainPass.evidenceSet.taskRef,'task-1');assert.equal(a.chainPass.evidenceSet.retrievedAt,NOW-100);assert.equal(a.chainPass.draft.draftId,'adapt-1.draft');
  // The marker is an adapter concept; the evidence items carry only the contract fields.
  assert.deepEqual(Object.keys(a.chainPass.evidenceSet.items[0]),[...evidenceSet.ITEM_FIELDS]);
  assert.deepEqual(a.stats,{answerChars:CITED.length,claimChars:CITED.length-1,skippedChars:0,claims:2,claimsWithMarkers:2,claimsWithoutMarkers:0,markersUsed:2,unknownMarkers:0,passagesSupplied:2,passagesUnused:0});
});

test('adaptation is deterministic, verifiable, and any edit after sealing is detected',()=>{
  const a=d.adapt(input(CITED)),b=d.adapt(input(CITED));assert.deepEqual(a,b);assert.equal(a.adaptationDigest,b.adaptationDigest);
  assert.notEqual(d.adapt(input(`${CITED} One more.`)).adaptationDigest,a.adaptationDigest);assert.notEqual(d.adapt(input(CITED,{adaptationId:'adapt-2'})).provenance.inputDigest,a.provenance.inputDigest);
  const edited=JSON.parse(JSON.stringify(a));edited.chainPass.draft.claims[0].evidenceIds=['ev-doc-2'];assert.equal(d.verifyAdaptation(edited),false);
  const lent=JSON.parse(JSON.stringify(a));lent.segments[1].markers=[];assert.equal(d.verifyAdaptation(lent),false);
  assert.equal(d.verifyAdaptation(JSON.parse(JSON.stringify(a))),true);assert.equal(d.verifyAdaptation(null),false);assert.equal(d.verifyAdaptation({}),false);
});

test('input admission is exact: invalid input is a sealed fail-closed BLOCKED record without a chain pass',()=>{
  for(const [bad,reason] of [
    [null,'INPUT_INVALID'],[input(CITED,{extra:1}),'INPUT_INVALID'],[{...input(CITED),version:'x'},'INPUT_INVALID'],[input(CITED,{at:'0'}),'INPUT_INVALID'],[input(CITED,{adaptationId:'a'.repeat(97)}),'INPUT_INVALID'],[input(CITED,{retrievedAt:null}),'INPUT_INVALID'],[input(CITED,{passages:{}}),'INPUT_INVALID'],[input(CITED,{proposedActions:null}),'INPUT_INVALID'],
    [input(CITED,{context:{}}),'CONTEXT_INVALID'],
    [input(''),'ANSWER_INVALID'],[input(CITED,{answer:{text:CITED}}),'ANSWER_INVALID'],[input(CITED,{answer:{text:42,originRef:'model:draft'}}),'ANSWER_INVALID'],[input('x'.repeat(200_001)),'ANSWER_INVALID'],[input(CITED,{answer:{text:CITED,originRef:''}}),'ANSWER_INVALID'],
    [input(CITED,{passages:[{marker:'X1'}]}),'PASSAGES_INVALID'],[input(CITED,{passages:[passage(1,{marker:'S0'})]}),'PASSAGES_INVALID'],[input(CITED,{passages:[passage(1),passage(2,{marker:'S1'})]}),'PASSAGES_INVALID'],[input(CITED,{passages:[passage(1),passage(2,{evidenceId:'ev-doc-1'})]}),'PASSAGES_INVALID'],[input(CITED,{passages:[passage(1,{sourceClass:'RUMOUR'})]}),'PASSAGES_INVALID'],[input(CITED,{passages:[passage(1,{contentHash:'zz'})]}),'PASSAGES_INVALID'],
    [input(CITED,{retrievedAt:NOW+1}),'RETRIEVAL_FROM_THE_FUTURE'],
    [input(`${'Short claim here. '.repeat(257)}`),'TOO_MANY_CLAIMS'],[input(`${'word '.repeat(1700)}end.`),'SEGMENT_TOO_LONG'],
    [input(CITED,{proposedActions:[{actionId:'w',actionClass:'WRITE',protected:false,authorityRef:null}]}),'ADAPTED_DRAFT_INVALID'],[input(CITED,{proposedActions:['text']}),'ADAPTED_DRAFT_INVALID']
  ]){const a=d.adapt(bad);assert.equal(a.status,'BLOCKED',reason);assert.equal(a.reasonCode,reason);assert.equal(a.failClosed,true);assert.equal(a.chainPass,null);assert.deepEqual([...a.segments],[]);assert.equal(d.verifyAdaptation(a),true,reason);}
});

test('adapt never throws on hostile input',()=>{
  const throwing={};Object.defineProperty(throwing,'version',{get(){throw new Error('boom');},enumerable:true});
  const cyclic=[];cyclic.push(cyclic);
  const getterAnswer={originRef:'model:draft'};Object.defineProperty(getterAnswer,'text',{get(){throw new Error('boom');},enumerable:true});
  for(const hostile of [throwing,new Proxy({},{ownKeys(){throw new Error('boom');}}),Symbol('x'),()=>{},42,'text',[],input(CITED,{proposedActions:cyclic}),input(CITED,{answer:getterAnswer}),input(CITED,{passages:new Proxy([],{get(){throw new Error('boom');}})})]){
    let a;assert.doesNotThrow(()=>{a=d.adapt(hostile);});assert.equal(a.status,'BLOCKED');assert.equal(a.chainPass,null);assert.equal(d.verifyAdaptation(a),true);
  }
});

test('proposed actions are passed through unchanged for the gate to judge; the adapter neither adds nor authorizes one',()=>{
  const actions=[{actionId:'w',actionClass:'WRITE',protected:true,authorityRef:null}];
  const a=d.adapt(input(CITED,{proposedActions:actions}));assert.deepEqual(a.chainPass.draft.proposedActions,actions);
  assert.equal(rehearseOne(a).outcome,'ESCALATE_OWNER');assert.deepEqual(d.adapt(input(CITED)).chainPass.draft.proposedActions,[]);
});

test('exports are frozen and contain no model, rewrite, wire or fetch capability',()=>{
  assert.equal(Object.isFrozen(d),true);
  assert.deepEqual(Object.keys(d),['VERSION','INPUT_VERSION','OUTPUT_VERSION','SEGMENTER_VERSION','INPUT_FIELDS','ANSWER_FIELDS','PASSAGE_FIELDS','SKIP_REASONS','ABBREVIATIONS','MAX_ANSWER_CHARS','segment','adapt','verifyAdaptation']);
  assert.deepEqual([...d.SKIP_REASONS],['CODE_BLOCK','HEADING','LEAD_IN','QUESTION','NO_WORDS']);assert.equal(d.ABBREVIATIONS.includes('etc'),false);
  assert.equal(context().taskId,'task-1');
});
