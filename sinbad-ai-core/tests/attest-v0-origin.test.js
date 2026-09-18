'use strict';
// Origin: what a self-digest cannot prove. Every attack here produces a record that still passes
// its own component's verify function; attestation is what tells it from the real one.
const test=require('node:test');const assert=require('node:assert/strict');
const {a,NOW,KEYS,entry,TRUST,plain,recordsOf,attestInput,checkInput,reseal,invention}=require('./helpers/attest-v0-builders.js');
const gatekeeper=require('../gatekeeper/gatekeeper-v0.js');const pilot=require('../pilot/pilot-v0.js');
const {context}=require('./helpers/sentinel-v0-builders.js');
const R=recordsOf(),B=recordsOf(invention(1));
const envelopeOf=(kind,record,changes)=>plain(a.attest(attestInput(kind,record,changes)).envelope);
const rejected=(c,reason)=>{assert.equal(c.status,'REJECTED',reason);assert.equal(c.authentic,false);assert.equal(c.reasonCode,reason);assert.equal(c.grantsAuthority,false);assert.equal(a.verifyCheck(c),true);};
// A BLOCK decision rewritten to a clean ADMIT, consistently, and resealed.
const block=B.GATEKEEPER_DECISION;
const forged=reseal({...block,outcome:'ADMIT',labels:[],reasonCode:'ALL_CLEAR',failClosed:false,deliveryLabel:'VERIFIED',decision:{...block.decision,outcome:'ADMIT',labels:[],failClosed:false,attribution:{deterministicRuleIds:[],modelVerdictId:null,reasonCode:'ALL_CLEAR'},ruleResults:block.decision.ruleResults.map(r=>({...r,outcome:'PASS',detailRef:null}))},ruleResults:block.ruleResults.map(r=>({...r,outcome:'PASS',detailRef:null})),provenance:{...block.provenance,verdictId:null}},'decisionDigest');

test('the limit stated for Pilot v0 is real: a consistently rewritten, resealed gate decision supplied without a review makes Pilot v0 recommend PROCEED',()=>{
  assert.equal(block.outcome,'BLOCK');assert.equal(gatekeeper.verifyDecision(forged),true);
  const d=pilot.decide({version:pilot.INPUT_VERSION,pilotDecisionId:'pilot-1',decidedAt:NOW,context:context(),draftRef:{draftId:forged.provenance.draftId,draftHash:forged.provenance.draftHash},gateDecision:forged,review:null,iterationIndex:0,policy:{maxIterations:3,labelledDelivery:'PROCEED'},priorPilotDecisionDigest:null});
  assert.equal(d.decision,'PROCEED');
});

test('attestation closes it: the forged decision is REJECTED on every path an attacker has',()=>{
  // 1. Reuse the real envelope of the real BLOCK decision for the forged record.
  rejected(a.check(checkInput(envelopeOf('GATEKEEPER_DECISION',block),forged)),'RECORD_NOT_THE_ATTESTED_ONE');
  // 2. Sign the forgery with a key the verifier does not trust, under the gate's key id.
  rejected(a.check(checkInput(envelopeOf('GATEKEEPER_DECISION',forged,{signer:{keyId:'key-gate',seedHex:KEYS.stranger}}),forged)),'SIGNATURE_INVALID');
  // 3. Sign it under an unknown key id.
  rejected(a.check(checkInput(envelopeOf('GATEKEEPER_DECISION',forged,{signer:{keyId:'key-stranger',seedHex:KEYS.stranger}}),forged)),'KEY_UNKNOWN');
  // 4. Sign it with a genuine, trusted key of another role: the Pilot's key may not speak for the gate.
  rejected(a.check(checkInput(envelopeOf('GATEKEEPER_DECISION',forged,{signer:{keyId:'key-pilot',seedHex:KEYS.pilot}}),forged)),'KEY_NOT_BOUND_TO_KIND');
  // 5. Edit any field of a genuine envelope.
  const real=envelopeOf('GATEKEEPER_DECISION',block);
  for(const change of [{recordDigest:forged.decisionDigest},{payloadDigest:'0'.repeat(64)},{taskRef:'task-2'},{issuedAt:real.issuedAt+1},{keyId:'key-pilot'},{recordKind:'PILOT_DECISION',recordVersion:'sinbad-pilot-decision/0-v1'},{attestationId:'att-2'}])assert.equal(a.check(checkInput({...real,...change},block)).authentic,false,JSON.stringify(change));
  // The genuine pair stays AUTHENTIC, and what it authenticates is still a BLOCK.
  const ok=a.check(checkInput(real,block));assert.equal(ok.status,'AUTHENTIC');assert.equal(block.outcome,'BLOCK');
});

test('an envelope is for one record: another record, an edited record, a record of another kind or non-data are rejected',()=>{
  const e=envelopeOf('GATEKEEPER_DECISION',R.GATEKEEPER_DECISION);
  rejected(a.check(checkInput(e,B.GATEKEEPER_DECISION)),'RECORD_NOT_THE_ATTESTED_ONE');
  rejected(a.check(checkInput(e,{...R.GATEKEEPER_DECISION,outcome:'BLOCK'})),'RECORD_NOT_INTACT');
  rejected(a.check(checkInput(e,R.PILOT_DECISION)),'RECORD_KIND_MISMATCH');
  rejected(a.check(checkInput(e,null)),'RECORD_NOT_PLAIN_DATA');
  const cyclic=plain(R.GATEKEEPER_DECISION);cyclic.self=cyclic;rejected(a.check(checkInput(e,cyclic)),'RECORD_NOT_PLAIN_DATA');
  // Even a harmless-looking extra field is refused: the record must be exactly what was attested.
  rejected(a.check(checkInput(envelopeOf('PILOT_DECISION',R.PILOT_DECISION),{...R.PILOT_DECISION,note:'harmless'})),'RECORD_NOT_INTACT');
});

test('keys: revoked, outside their validity at issue, not bound to the kind, or absent from the trust store',()=>{
  const e=envelopeOf('COPILOT_REVIEW',R.COPILOT_REVIEW),r=R.COPILOT_REVIEW;const swap=change=>TRUST().map(k=>k.keyId==='key-copilot'?{...k,...change}:k);
  rejected(a.check(checkInput(e,r,{trustStore:swap({revoked:true})})),'KEY_REVOKED');
  rejected(a.check(checkInput(e,r,{trustStore:swap({notBefore:NOW-5,notAfter:NOW+100})})),'KEY_NOT_VALID_AT_ISSUE');
  rejected(a.check(checkInput(e,r,{trustStore:swap({notBefore:NOW-1000,notAfter:NOW-10})})),'KEY_NOT_VALID_AT_ISSUE');
  rejected(a.check(checkInput(e,r,{trustStore:swap({kinds:['PILOT_DECISION']})})),'KEY_NOT_BOUND_TO_KIND');
  rejected(a.check(checkInput(e,r,{trustStore:TRUST().filter(k=>k.keyId!=='key-copilot')})),'KEY_UNKNOWN');
  rejected(a.check(checkInput(e,r,{trustStore:[]})),'KEY_UNKNOWN');
  rejected(a.check(checkInput(e,r,{trustStore:swap({publicKeyHex:a.derivePublicKey(KEYS.stranger)})})),'SIGNATURE_INVALID');
  // One key may be bound to several kinds when the Owner's trust store says so.
  const shared=[entry('key-shared',KEYS.chain,['CHAIN_TRANSCRIPT','PILOT_DECISION'])];
  assert.equal(a.check(checkInput(envelopeOf('PILOT_DECISION',R.PILOT_DECISION,{signer:{keyId:'key-shared',seedHex:KEYS.chain}}),R.PILOT_DECISION,{trustStore:shared})).status,'AUTHENTIC');
});

test('time and expectation: from the future, too old, another task, another kind',()=>{
  const e=envelopeOf('PILOT_DECISION',R.PILOT_DECISION),r=R.PILOT_DECISION;
  rejected(a.check(checkInput(e,r,{at:NOW-11})),'ATTESTATION_FROM_THE_FUTURE');
  rejected(a.check(checkInput(e,r,{at:NOW+9_991})),'ATTESTATION_TOO_OLD');assert.equal(a.check(checkInput(e,r,{at:NOW+9_990})).status,'AUTHENTIC');
  rejected(a.check(checkInput(e,r,{expected:{recordKind:null,taskRef:'task-2'}})),'UNEXPECTED_TASK');
  rejected(a.check(checkInput(e,r,{expected:{recordKind:'GATEKEEPER_DECISION',taskRef:null}})),'UNEXPECTED_RECORD_KIND');
  assert.equal(a.check(checkInput(e,r,{expected:{recordKind:'PILOT_DECISION',taskRef:'task-1'}})).status,'AUTHENTIC');
});

test('AUTHENTIC means origin, never approval: a genuinely attested BLOCK, STOP or fail-closed record is authentic and stays what it is',()=>{
  const stop=plain(pilot.decide(null));
  const c=a.check(checkInput(envelopeOf('PILOT_DECISION',stop),stop));
  assert.equal(c.status,'AUTHENTIC');assert.equal(stop.decision,'STOP');assert.equal(c.taskRef,null);assert.equal(c.approves,false);assert.equal(c.executes,false);assert.equal(c.originOnly,true);
});

test('check never throws on hostile input',()=>{
  const e=envelopeOf('PILOT_DECISION',R.PILOT_DECISION);
  const throwing={};Object.defineProperty(throwing,'version',{get(){throw new Error('boom');},enumerable:true});
  const getterEnvelope={...e};Object.defineProperty(getterEnvelope,'signature',{get(){throw new Error('boom');},enumerable:true});
  for(const hostile of [throwing,new Proxy({},{ownKeys(){throw new Error('boom');}}),Symbol('x'),()=>{},42,'text',[],checkInput(getterEnvelope,R.PILOT_DECISION),checkInput(e,new Proxy({},{ownKeys(){throw new Error('boom');}})),checkInput(e,R.PILOT_DECISION,{trustStore:new Proxy([],{get(){throw new Error('boom');}})})]){
    let c;assert.doesNotThrow(()=>{c=a.check(hostile);});assert.equal(c.status,'REJECTED');assert.equal(a.verifyCheck(c),true);
  }
});
