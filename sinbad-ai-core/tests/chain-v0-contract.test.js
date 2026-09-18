'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {k,s,NOW,context,pass,POLICY,input,supported,invention,trail}=require('./helpers/chain-v0-builders.js');
const copilot=require('../copilot/copilot-v0.js');const gatekeeper=require('../gatekeeper/gatekeeper-v0.js');const pilot=require('../pilot/pilot-v0.js');

test('a clean draft is rehearsed in one pass to PROCEED; the transcript is frozen, sealed, offline only and has no authority',()=>{
  const t=k.rehearse(input({passes:[pass(supported(1))]}));
  assert.equal(t.outcome,'PROCEED');assert.equal(t.failClosed,false);assert.equal(t.reasonCode,'ALL_CLEAR');assert.equal(t.taskRef,'task-1');
  assert.equal(t.passesSupplied,1);assert.equal(t.passesRun,1);assert.equal(t.passesUnused,0);assert.deepEqual(trail(t),['ADMIT>PROCEED']);
  assert.equal(t.authority,'NONE');assert.equal(t.offlineOnly,true);for(const flag of ['producesDrafts','delivers','executes','approves','grantsAuthority','callsModel'])assert.equal(t[flag],false,flag);
  assert.equal(Object.isFrozen(t),true);assert.equal(Object.isFrozen(t.steps),true);assert.equal(Object.isFrozen(t.steps[0].records.pilotDecision),true);
  const s=t.steps[0];
  assert.deepEqual(s.review,{reviewDigest:s.records.review.reviewDigest,status:'REVIEWED',reasonCode:'REVIEWED',recommendation:'ALLOW',warningCount:0});
  assert.deepEqual(s.gate,{decisionDigest:s.records.gateDecision.decisionDigest,outcome:'ADMIT',reasonCode:'ALL_CLEAR',deliveryLabel:'VERIFIED',labels:['VERIFIED']});
  assert.deepEqual(s.pilot,{pilotDecisionDigest:s.records.pilotDecision.pilotDecisionDigest,decision:'PROCEED',ruleId:'PILOT.GATE_ADMITS',reasonCode:'ALL_CLEAR',carryLabels:['VERIFIED'],findings:[]});
  assert.equal(k.verifyTranscript(t),true);
});

test('every embedded record is the real sealed output of its component, identified per pass and linked',()=>{
  const t=k.rehearse(input({passes:[pass(invention(1)),pass(supported(2))]}));
  assert.deepEqual(t.steps.map(s=>[s.records.review.reviewId,s.records.review.verdict.verdictId,s.records.gateDecision.decisionId,s.records.pilotDecision.pilotDecisionId]),[['chain-1.0.review','chain-1.0.verdict','chain-1.0.gate','chain-1.0.pilot'],['chain-1.1.review','chain-1.1.verdict','chain-1.1.gate','chain-1.1.pilot']]);
  for(const s of t.steps){
    assert.equal(copilot.verifyReview(s.records.review),true);assert.equal(gatekeeper.verifyDecision(s.records.gateDecision),true);assert.equal(pilot.verifyPilotDecision(s.records.pilotDecision),true);
    assert.equal(s.records.gateDecision.provenance.verdictId,s.records.review.verdict.verdictId);assert.equal(s.records.pilotDecision.provenance.gateDecisionDigest,s.records.gateDecision.decisionDigest);assert.equal(s.records.pilotDecision.provenance.reviewDigest,s.records.review.reviewDigest);
    assert.equal(s.records.pilotDecision.iteration.index,s.index);assert.equal(s.draftHash,s.records.gateDecision.provenance.draftHash);
  }
  assert.equal(t.steps[0].records.pilotDecision.provenance.priorPilotDecisionDigest,null);assert.equal(t.steps[1].records.pilotDecision.provenance.priorPilotDecisionDigest,t.steps[0].pilot.pilotDecisionDigest);
  // Replaying the same data directly through the components gives the same records: the chain adds nothing of its own.
  const direct=copilot.review({version:copilot.INPUT_VERSION,reviewId:'chain-1.0.review',verdictId:'chain-1.0.verdict',issuedAt:NOW,context:context(),evidenceSet:pass(invention(1)).evidenceSet,draft:invention(1),policy:{maxEvidenceAgeMs:POLICY.maxEvidenceAgeMs},priorReviewDigest:null});
  assert.deepEqual(t.steps[0].records.review,direct);
});

test('transcripts are deterministic, verifiable and chainable; an edit to the transcript, to a record or to a link is detected',()=>{
  const make=()=>k.rehearse(input({passes:[pass(invention(1)),pass(supported(2))]}));
  const a=make(),b=make();assert.deepEqual(a,b);assert.equal(a.transcriptDigest,b.transcriptDigest);
  const next=k.rehearse(input({chainId:'chain-2',priorTranscriptDigest:a.transcriptDigest}));assert.equal(next.provenance.priorTranscriptDigest,a.transcriptDigest);
  const plain=()=>JSON.parse(JSON.stringify(a));const reseal=t=>{const {transcriptDigest,...rest}=t;return {...rest,transcriptDigest:s.sha256(s.canonical(rest))};};
  assert.equal(k.verifyTranscript(plain()),true);
  const edited=plain();edited.outcome='STOP';assert.equal(k.verifyTranscript(edited),false);
  // Resealed forgeries: outcome that does not follow from the last step, a swapped record, a broken pilot chain.
  const wrongOutcome=plain();wrongOutcome.outcome='ESCALATE_OWNER';assert.equal(k.verifyTranscript(reseal(wrongOutcome)),false);
  const swapped=plain();swapped.steps[1].records.gateDecision=swapped.steps[0].records.gateDecision;assert.equal(k.verifyTranscript(reseal(swapped)),false);
  const summaryEdited=plain();summaryEdited.steps[0].pilot.decision='PROCEED';assert.equal(k.verifyTranscript(reseal(summaryEdited)),false);
  const reordered=plain();reordered.steps.reverse();assert.equal(k.verifyTranscript(reseal(reordered)),false);
  const recordEdited=plain();recordEdited.steps[0].records.pilotDecision.decision='PROCEED';assert.equal(k.verifyTranscript(reseal(recordEdited)),false);
  assert.equal(k.verifyTranscript(reseal(plain())),true);assert.equal(k.verifyTranscript(null),false);assert.equal(k.verifyTranscript({}),false);
});

test('input admission is exact: invalid input is a sealed fail-closed STOP before any component runs',()=>{
  for(const [bad,reason] of [
    [null,'INPUT_INVALID'],[input({extra:1}),'INPUT_INVALID'],[{...input(),version:'x'},'INPUT_INVALID'],[input({at:'0'}),'INPUT_INVALID'],[input({chainId:''}),'INPUT_INVALID'],[input({chainId:'c'.repeat(97)}),'INPUT_INVALID'],[input({priorTranscriptDigest:'zz'}),'INPUT_INVALID'],[input({passes:{}}),'INPUT_INVALID'],
    [input({policy:{}}),'POLICY_INVALID'],[input({policy:{...POLICY,maxIterations:0}}),'POLICY_INVALID'],[input({policy:{...POLICY,labelledDelivery:'ALWAYS'}}),'POLICY_INVALID'],[input({policy:{...POLICY,volatileMaxEvidenceAgeMs:POLICY.maxEvidenceAgeMs+1}}),'POLICY_INVALID'],
    [input({passes:[]}),'PASSES_INVALID'],[input({passes:[1,2,3,4].map(n=>pass(supported(n)))}),'PASSES_INVALID'],[input({passes:[{draft:supported(1)}]}),'PASSES_INVALID'],[input({passes:[{...pass(supported(1)),extra:1}]}),'PASSES_INVALID'],[input({passes:['text']}),'PASSES_INVALID'],
    [input({context:undefined}),'INPUT_NOT_PLAIN_DATA'],[input({passes:[{evidenceSet:null,draft:undefined}]}),'INPUT_NOT_PLAIN_DATA']
  ]){
    const t=k.rehearse(bad);assert.equal(t.outcome,'STOP',reason);assert.equal(t.reasonCode,reason);assert.equal(t.failClosed,true);assert.equal(t.passesRun,0,reason);assert.deepEqual([...t.steps],[]);assert.equal(k.verifyTranscript(t),true,reason);
  }
});

test('exports are frozen and contain no draft, deliver, execute, approve, wire or fetch capability',()=>{
  assert.equal(Object.isFrozen(k),true);
  assert.deepEqual(Object.keys(k),['VERSION','INPUT_VERSION','TRANSCRIPT_VERSION','OUTCOMES','TERMINAL','INPUT_FIELDS','PASS_FIELDS','POLICY_FIELDS','DEFAULT_POLICY','policy','rehearse','verifyTranscript']);
  assert.deepEqual([...k.OUTCOMES],['PROCEED','ESCALATE_OWNER','STOP','AWAITING_DRAFT']);assert.deepEqual([...k.TERMINAL],['PROCEED','ESCALATE_OWNER','STOP']);
  assert.deepEqual(k.DEFAULT_POLICY,{maxEvidenceAgeMs:86_400_000,volatileMaxEvidenceAgeMs:300_000,maxIterations:3,labelledDelivery:'PROCEED'});
});
