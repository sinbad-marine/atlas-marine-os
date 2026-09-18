'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {k,NOW,context,ITEMS,set,claim,citation,action,draft,pass,POLICY,input,supported,invention,trail}=require('./helpers/chain-v0-builders.js');
const volatileText='The bridge is currently listening on the loopback port.';
const volatileFromRepo=n=>supported(n,{claims:[claim('c1',{text:volatileText,evidenceIds:['ev-repo']})]});
const volatileFromLive=n=>draft(n,{claims:[claim('c1',{text:volatileText,evidenceIds:['ev-live']})],citations:[citation('cit-1','ev-live')]});
const vague=n=>draft(n,{claims:[claim('c1',{text:'The bridge probably scans the whole library.'})]});
const write=changes=>action('w',{actionClass:'WRITE',protected:true,...changes});

test('revise loop: an invention is sent back, the corrected draft proceeds, and drafts supplied beyond the end are not run',()=>{
  const t=k.rehearse(input({passes:[pass(invention(1)),pass(supported(2)),pass(supported(3))]}));
  assert.equal(t.outcome,'PROCEED');assert.deepEqual(trail(t),['BLOCK>REVISE_DRAFT','ADMIT>PROCEED']);assert.equal(t.passesRun,2);assert.equal(t.passesUnused,1);
  assert.deepEqual(t.steps.map(s=>s.draftId),['draft-1','draft-2']);assert.deepEqual([...t.steps[1].pilot.carryLabels],['VERIFIED']);
  assert.ok(t.steps[0].pilot.findings.some(f=>f.ref==='GATE.SPECIFICITY_SUPPORTED'&&f.asks==='REVISE_DRAFT'));assert.equal(k.verifyTranscript(t),true);
});

test('evidence loop: a present-state claim backed by a document asks for evidence; the same claim with fresh live evidence proceeds',()=>{
  const t=k.rehearse(input({passes:[pass(volatileFromRepo(1)),pass(volatileFromLive(2),set([ITEMS.repo,ITEMS.live]))]}));
  assert.equal(t.outcome,'PROCEED');assert.deepEqual(trail(t),['BLOCK>REQUEST_EVIDENCE','ADMIT>PROCEED']);
  assert.deepEqual(t.steps[0].pilot.findings.map(f=>f.ref),['GATE.VOLATILE_CLAIMS_LIVE']);
});

test('the rehearsal ends open when the Pilot asks for another draft and none was supplied; it never invents one',()=>{
  const t=k.rehearse(input({passes:[pass(invention(1))]}));
  assert.equal(t.outcome,'AWAITING_DRAFT');assert.equal(t.failClosed,false);assert.equal(t.reasonCode,'DRAFT_FINDINGS');assert.deepEqual(trail(t),['BLOCK>REVISE_DRAFT']);assert.equal(t.producesDrafts,false);assert.equal(k.verifyTranscript(t),true);
  assert.equal(k.rehearse(input({passes:[pass(volatileFromRepo(1))]})).outcome,'AWAITING_DRAFT');
});

test('iteration budget: a draft that stays blocked goes to the Owner on the last pass, and a rehearsal cannot outrun the budget',()=>{
  const t=k.rehearse(input({passes:[pass(invention(1)),pass(invention(2)),pass(invention(3))]}));
  assert.equal(t.outcome,'ESCALATE_OWNER');assert.equal(t.reasonCode,'ITERATION_BUDGET_EXHAUSTED');assert.deepEqual(trail(t),['BLOCK>REVISE_DRAFT','BLOCK>REVISE_DRAFT','BLOCK>ESCALATE_OWNER']);
  assert.deepEqual(t.steps.map(s=>s.records.pilotDecision.iteration.remaining),[2,1,0]);
  const single=k.rehearse(input({policy:{...POLICY,maxIterations:1},passes:[pass(invention(1))]}));assert.equal(single.outcome,'ESCALATE_OWNER');
  assert.equal(k.rehearse(input({policy:{...POLICY,maxIterations:1},passes:[pass(invention(1)),pass(supported(2))]})).reasonCode,'PASSES_INVALID');
});

test('authority ends the loop at once: an unsafe action escalates and the later, corrected draft is never run',()=>{
  const t=k.rehearse(input({passes:[pass(supported(1,{proposedActions:[write()]})),pass(supported(2))]}));
  assert.equal(t.outcome,'ESCALATE_OWNER');assert.equal(t.reasonCode,'AUTHORITY_REQUIRED');assert.equal(t.passesRun,1);assert.equal(t.passesUnused,1);assert.equal(t.grantsAuthority,false);
  const granted=k.rehearse(input({context:context({authorityRefs:['grant-1']}),passes:[pass(supported(1,{proposedActions:[write({authorityRef:'grant-1'})]}))]}));
  assert.equal(granted.outcome,'PROCEED');assert.equal(granted.executes,false);assert.equal(granted.steps[0].records.gateDecision.actions[0].status,'ADMITTED');
});

test('labelled delivery follows the policy through the chain',()=>{
  const now=k.rehearse(input({passes:[pass(vague(1))]}));
  assert.equal(now.outcome,'PROCEED');assert.equal(now.reasonCode,'LABELLED_DELIVERY_ADMITTED');assert.deepEqual([...now.steps[0].pilot.carryLabels],['NOT_VERIFIED','SOURCE_MISSING']);
  const improve=k.rehearse(input({policy:{...POLICY,labelledDelivery:'IMPROVE'},passes:[pass(vague(1)),pass(supported(2))]}));
  assert.deepEqual(trail(improve),['LABEL>REQUEST_EVIDENCE','ADMIT>PROCEED']);
  const stuck=k.rehearse(input({policy:{...POLICY,labelledDelivery:'IMPROVE'},passes:[pass(vague(1)),pass(vague(2)),pass(vague(3))]}));
  assert.deepEqual(trail(stuck),['LABEL>REQUEST_EVIDENCE','LABEL>REQUEST_EVIDENCE','LABEL>PROCEED']);assert.equal(stuck.reasonCode,'LABELLED_DELIVERY_AFTER_BUDGET');
});

test('a component that fails closed stops the rehearsal on that pass: expired context, invalid context, unidentifiable or tampered draft, foreign evidence set',()=>{
  for(const [changes,reason] of [
    [{at:NOW+60_000},'CONTEXT_EXPIRED'],[{context:{}},'CONTEXT_INVALID'],[{passes:[pass({})]},'GATE_FAILED_CLOSED'],[{passes:[pass(draft(1,{proposedActions:[action('w',{actionClass:'WRITE',protected:false})]}))]},'GATE_FAILED_CLOSED'],
    [{passes:[pass(draft(1,{claims:[claim('c',{text:'x',contentHash:'0'.repeat(64)})]}))]},'REVIEW_FAILED_CLOSED'],[{passes:[pass(supported(1),set([ITEMS.repo],{taskRef:'task-2'}))]},'REVIEW_FAILED_CLOSED'],[{passes:[pass(supported(1),{})]},'GATE_FAILED_CLOSED']
  ]){
    const t=k.rehearse(input({...changes,...(changes.passes?{passes:[...changes.passes,pass(supported(2))]}:{})}));
    assert.equal(t.outcome,'STOP',reason);assert.equal(t.reasonCode,reason);assert.equal(t.failClosed,true);assert.equal(t.passesRun,1,reason);assert.equal(k.verifyTranscript(t),true,reason);
  }
});

test('rehearse never throws on hostile input and always yields a sealed STOP',()=>{
  const throwing={};Object.defineProperty(throwing,'version',{get(){throw new Error('boom');},enumerable:true});
  const proxy=new Proxy(input(),{ownKeys(){throw new Error('boom');}});
  const cyclicDraft=supported(1);cyclicDraft.claims[0].evidenceIds=cyclicDraft.claims;
  const getterDraft=supported(1);Object.defineProperty(getterDraft,'draftHash',{get(){throw new Error('boom');},enumerable:true});
  for(const hostile of [throwing,proxy,Symbol('x'),()=>{},new Date(0),42,'text',[],input({passes:[pass(cyclicDraft)]}),input({passes:[pass(getterDraft)]}),input({context:new Proxy({},{ownKeys(){throw new Error('boom');}})})]){
    let t;assert.doesNotThrow(()=>{t=k.rehearse(hostile);});assert.equal(t.outcome,'STOP');assert.equal(t.failClosed,true);assert.equal(k.verifyTranscript(t),true);
  }
});
