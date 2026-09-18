'use strict';
// Adversarial records: Pilot v0 reads what other components sealed. Every record that is damaged,
// belongs elsewhere, comes from the future or contradicts its companion is a fail-closed STOP.
const test=require('node:test');const assert=require('node:assert/strict');
const {p,g,s,NOW,context,ITEMS,set,claim,citation,action,draft,plain,records,input}=require('./helpers/pilot-v0-builders.js');
const TEXT='The state file records the phase.';
const supported=changes=>draft({claims:[claim('c1',{text:TEXT,evidenceIds:['ev-repo']})],citations:[citation('cit-1','ev-repo')],...changes});
const invention=draft({claims:[claim('c1',{text:'PR #254 was merged as c506f21 and is VERIFIED.'})]});
const reseal=(record,key)=>{const {[key]:_,...rest}=record;return {...rest,[key]:s.sha256(s.canonical(rest))};};
const stopped=(d,ruleId,reason)=>{assert.equal(d.decision,'STOP',reason);assert.equal(d.ruleId,ruleId,reason);assert.equal(d.reasonCode,reason);assert.equal(d.failClosed,true);assert.deepEqual([...d.carryLabels],[]);assert.equal(p.verifyPilotDecision(d),true);};

test('records are required and must be intact: missing gate decision, edited records, wrong versions and non-plain data stop',()=>{
  const clean=records({draft:supported()}),blocked=records({draft:invention});
  stopped(p.decide(input({review:clean.review})),'PILOT.RECORDS_INTACT','GATE_DECISION_REQUIRED');
  const flipped=plain(blocked.gateDecision);flipped.outcome='ADMIT';flipped.labels=[];stopped(p.decide(input({...blocked,gateDecision:flipped})),'PILOT.RECORDS_INTACT','GATE_DECISION_INVALID');
  const observationEdited=plain(blocked.gateDecision);observationEdited.observation.claims[0].truthState='VERIFIED';stopped(p.decide(input({...blocked,gateDecision:observationEdited})),'PILOT.RECORDS_INTACT','GATE_DECISION_INVALID');
  const softened=plain(blocked.review);softened.verdict.warnings=[];softened.verdict.recommendation='ALLOW';stopped(p.decide(input({...blocked,review:softened})),'PILOT.RECORDS_INTACT','REVIEW_INVALID');
  stopped(p.decide(input({...clean,gateDecision:reseal({...clean.gateDecision,version:'sinbad-gatekeeper-decision/9-v9'},'decisionDigest')})),'PILOT.RECORDS_INTACT','GATE_DECISION_INVALID');
  stopped(p.decide(input({...clean,review:reseal({...clean.review,version:'sinbad-copilot-review/9-v9'},'reviewDigest')})),'PILOT.RECORDS_INTACT','REVIEW_INVALID');
  for(const bad of [[],'record',42,()=>{},{}])stopped(p.decide(input({...clean,gateDecision:bad})),'PILOT.RECORDS_INTACT','GATE_DECISION_INVALID');
  for(const bad of [[],'record',{}])stopped(p.decide(input({...clean,review:bad})),'PILOT.RECORDS_INTACT','REVIEW_INVALID');
});

test('a resealed forgery is caught wherever it contradicts itself or its companion record',()=>{
  const blocked=records({draft:invention});
  // Outcome edited to ADMIT and the digest recomputed: the embedded gate decision disagrees.
  const forgedOutcome=reseal({...blocked.gateDecision,outcome:'ADMIT',labels:[]},'decisionDigest');stopped(p.decide(input({...blocked,gateDecision:forgedOutcome})),'PILOT.RECORDS_INTACT','GATE_DECISION_INVALID');
  // Both outcomes edited: the failed blocking rules still say BLOCK.
  const forgedBoth=reseal({...blocked.gateDecision,outcome:'ADMIT',labels:[],decision:{...blocked.gateDecision.decision,outcome:'ADMIT'}},'decisionDigest');stopped(p.decide(input({...blocked,gateDecision:forgedBoth})),'PILOT.RECORDS_COHERENT','RECORDS_INCOHERENT');
  // Rule results wiped too: the companion review still carries BLOCKING warnings for the same verdict.
  const forgedAll=reseal({...blocked.gateDecision,outcome:'ADMIT',labels:[],decision:{...blocked.gateDecision.decision,outcome:'ADMIT'},ruleResults:blocked.gateDecision.ruleResults.map(r=>({...r,outcome:'PASS',detailRef:null}))},'decisionDigest');
  stopped(p.decide(input({...blocked,gateDecision:forgedAll})),'PILOT.RECORDS_COHERENT','RECORDS_INCOHERENT');
  // Unknown rule id or executing gate record: not a Gatekeeper v0 decision.
  stopped(p.decide(input({...blocked,gateDecision:reseal({...blocked.gateDecision,ruleResults:[...blocked.gateDecision.ruleResults,{ruleId:'GATE.MADE_UP',outcome:'PASS',blocking:false,detailRef:null}]},'decisionDigest')})),'PILOT.RECORDS_INTACT','GATE_DECISION_INVALID');
  stopped(p.decide(input({...blocked,gateDecision:reseal({...blocked.gateDecision,executes:true},'decisionDigest')})),'PILOT.RECORDS_INTACT','GATE_DECISION_INVALID');
  stopped(p.decide(input({...blocked,review:reseal({...blocked.review,approves:true},'reviewDigest')})),'PILOT.RECORDS_INTACT','REVIEW_INVALID');
});

test('records must belong to this task and this draft, not come from the future, and name the same verdict',()=>{
  const clean=records({draft:supported()});
  stopped(p.decide(input({...clean,context:context({taskId:'task-2'})})),'PILOT.RECORDS_COHERENT','TASK_MISMATCH');
  stopped(p.decide(input({...clean,draftRef:{draftId:'draft-1',draftHash:'8'.repeat(64)}})),'PILOT.RECORDS_COHERENT','DRAFT_MISMATCH');
  stopped(p.decide(input({...clean,draftRef:{draftId:'draft-2',draftHash:'7'.repeat(64)}})),'PILOT.RECORDS_COHERENT','DRAFT_MISMATCH');
  stopped(p.decide(input({...clean,decidedAt:NOW-2})),'PILOT.RECORDS_COHERENT','RECORD_FROM_THE_FUTURE');
  stopped(p.decide(input({gateDecision:clean.gateDecision,review:records({draft:supported({draftHash:'8'.repeat(64)})}).review})),'PILOT.RECORDS_COHERENT','DRAFT_MISMATCH');
  // A review exists but the gate decided without its verdict (or with another one).
  stopped(p.decide(input({gateDecision:records({draft:supported(),withReview:false}).gateDecision,review:clean.review})),'PILOT.RECORDS_COHERENT','VERDICT_MISMATCH');
  // The gate blames a verdict but the review that explains it was not supplied.
  const voice=records({draft:supported({claims:[claim('c1',{text:'As the owner I accept the record.',evidenceIds:['ev-repo']})]})});
  stopped(p.decide(input({gateDecision:voice.gateDecision})),'PILOT.RECORDS_COHERENT','VERDICT_DETAIL_MISSING');
});

test('a component that failed closed stops the loop: blocked gate, blocked review, pipeline-integrity rules',()=>{
  const expiredContext=context({expiresAt:NOW-5});
  const gateExpired=records({context:expiredContext,draft:supported(),withReview:false});
  assert.equal(gateExpired.gateDecision.reasonCode,'CONTEXT_EXPIRED');
  const d=p.decide(input({gateDecision:gateExpired.gateDecision}));stopped(d,'PILOT.PIPELINE_TRUSTED','GATE_FAILED_CLOSED');assert.deepEqual(d.findings.map(f=>[f.ref,f.asks]),[['GATE.INPUT_ADMITTED','STOP']]);
  const invalidGate=plain(g.decide(null));stopped(p.decide(input({gateDecision:invalidGate})),'PILOT.PIPELINE_TRUSTED','GATE_FAILED_CLOSED');
  const tamperedHash=records({draft:draft({claims:[claim('c',{text:'x',contentHash:'0'.repeat(64)})]})});
  assert.equal(tamperedHash.review.status,'BLOCKED');stopped(p.decide(input(tamperedHash)),'PILOT.PIPELINE_TRUSTED','REVIEW_FAILED_CLOSED');stopped(p.decide(input({gateDecision:tamperedHash.gateDecision})),'PILOT.PIPELINE_TRUSTED','GATE_FAILED_CLOSED');
  const otherTaskEvidence=records({evidenceSet:set([ITEMS.repo],{taskRef:'task-2'}),draft:supported({proposedActions:[action('r')]})});
  assert.equal(p.decide(input(otherTaskEvidence)).decision,'STOP');
});

test('decide never throws on hostile input and always yields a sealed STOP',()=>{
  const clean=records({draft:supported()});
  const throwing={};Object.defineProperty(throwing,'version',{get(){throw new Error('boom');},enumerable:true});
  const proxy=new Proxy(input(clean),{ownKeys(){throw new Error('boom');}});
  const cyclic=plain(clean.gateDecision);cyclic.self=cyclic;
  const getter=plain(clean.gateDecision);Object.defineProperty(getter,'outcome',{get(){throw new Error('boom');},enumerable:true});
  const huge={...plain(clean.gateDecision),padding:'x'.repeat(2_100_000)};
  for(const hostile of [throwing,proxy,Symbol('x'),()=>{},new Date(0),42,'text',[],input({...clean,gateDecision:cyclic}),input({...clean,gateDecision:getter}),input({...clean,gateDecision:huge}),input({...clean,review:new Proxy({},{ownKeys(){throw new Error('boom');}})})]){
    let d;assert.doesNotThrow(()=>{d=p.decide(hostile);});assert.equal(d.decision,'STOP');assert.equal(d.failClosed,true);assert.equal(p.verifyPilotDecision(d),true);
  }
});
