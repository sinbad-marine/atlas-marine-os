'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {p,g,NOW,context,claim,citation,draft,records,input,run}=require('./helpers/pilot-v0-builders.js');
const v=require('../authority/copilot-verdict.js');
const TEXT='The state file records the phase.';
const supported=changes=>draft({claims:[claim('c1',{text:TEXT,evidenceIds:['ev-repo']})],citations:[citation('cit-1','ev-repo')],...changes});

test('a clean, admitted draft yields PROCEED; the decision is frozen, sealed, a recommendation only, and has no authority',()=>{
  const d=run({draft:supported()});
  assert.equal(d.decision,'PROCEED');assert.equal(d.failClosed,false);assert.equal(d.reasonCode,'ALL_CLEAR');assert.equal(d.ruleId,'PILOT.GATE_ADMITS');assert.equal(d.taskRef,'task-1');
  assert.deepEqual([...d.findings],[]);assert.deepEqual([...d.carryLabels],['VERIFIED']);
  assert.equal(d.authority,'NONE');assert.equal(d.recommendationOnly,true);for(const flag of ['executes','approves','grantsAuthority','rewrites','callsModel'])assert.equal(d[flag],false,flag);
  assert.equal(Object.isFrozen(d),true);assert.equal(Object.isFrozen(d.findings),true);assert.equal(Object.isFrozen(d.provenance),true);
  assert.deepEqual(d.iteration,{index:0,maxIterations:3,remaining:2});
  assert.deepEqual(d.gate,{decisionId:'decision-1',decisionDigest:d.provenance.gateDecisionDigest,outcome:'ADMIT',reasonCode:'ALL_CLEAR',failClosed:false,deliveryLabel:'VERIFIED',observationSignal:'CLEAR',observationCoverage:'FULL'});
  assert.deepEqual(d.review,{reviewId:'review-1',reviewDigest:d.provenance.reviewDigest,status:'REVIEWED',reasonCode:'REVIEWED',recommendation:'ALLOW'});
  assert.equal(p.verifyPilotDecision(d),true);
});

test('the decision carries full provenance by digest and never the claim text or the records themselves',()=>{
  const r=records({draft:supported()});const d=p.decide(input(r));const pr=d.provenance;
  assert.match(pr.inputDigest,/^[a-f0-9]{64}$/u);assert.equal(pr.contextTaskId,'task-1');assert.equal(pr.draftId,'draft-1');assert.match(pr.draftHash,/^7{64}$/u);
  assert.equal(pr.gateDecisionDigest,r.gateDecision.decisionDigest);assert.equal(pr.reviewDigest,r.review.reviewDigest);assert.equal(pr.verdictId,'verdict-1');assert.equal(pr.priorPilotDecisionDigest,null);
  assert.deepEqual(pr.policy,{maxIterations:3,labelledDelivery:'PROCEED'});assert.equal(pr.pilotVersion,p.VERSION);assert.equal(pr.rulesetVersion,p.RULESET_VERSION);
  const text=JSON.stringify(d);assert.equal(text.includes('The state file'),false);assert.equal(text.includes('ruleResults'),false);assert.equal(text.includes('"observation"'),false);
});

test('decisions are deterministic, verifiable and chainable; any edit after sealing is detected',()=>{
  const blockedDraft=draft({claims:[claim('c1',{text:'PR #254 was merged as c506f21 and is VERIFIED.'})]});
  const a=run({draft:blockedDraft}),b=run({draft:blockedDraft});assert.deepEqual(a,b);assert.equal(a.decision,'REVISE_DRAFT');
  const next=run({draft:blockedDraft},{pilotDecisionId:'pilot-2',iterationIndex:1,priorPilotDecisionDigest:a.pilotDecisionDigest});
  assert.equal(next.provenance.priorPilotDecisionDigest,a.pilotDecisionDigest);assert.notEqual(next.pilotDecisionDigest,a.pilotDecisionDigest);assert.deepEqual(next.iteration,{index:1,maxIterations:3,remaining:1});
  const edited=JSON.parse(JSON.stringify(a));edited.decision='PROCEED';edited.findings=[];assert.equal(p.verifyPilotDecision(edited),false);
  assert.equal(p.verifyPilotDecision(JSON.parse(JSON.stringify(a))),true);assert.equal(p.verifyPilotDecision(null),false);assert.equal(p.verifyPilotDecision({}),false);
});

test('input admission is exact: every invalid input is a fail-closed STOP that names the reason',()=>{
  const r=records({draft:supported()});
  for(const [bad,reason] of [
    [null,'INPUT_INVALID'],[input({...r,extra:1}),'INPUT_INVALID'],[{...input(r),version:'x'},'INPUT_INVALID'],[input({...r,decidedAt:'0'}),'INPUT_INVALID'],[input({...r,pilotDecisionId:''}),'INPUT_INVALID'],[input({...r,priorPilotDecisionDigest:'zz'}),'INPUT_INVALID'],
    [input({...r,policy:{}}),'POLICY_INVALID'],[input({...r,policy:{maxIterations:0,labelledDelivery:'PROCEED'}}),'POLICY_INVALID'],[input({...r,policy:{maxIterations:17,labelledDelivery:'PROCEED'}}),'POLICY_INVALID'],[input({...r,policy:{maxIterations:3,labelledDelivery:'ALWAYS'}}),'POLICY_INVALID'],
    [input({...r,iterationIndex:-1}),'ITERATION_INVALID'],[input({...r,iterationIndex:3}),'ITERATION_INVALID'],[input({...r,iterationIndex:1.5}),'ITERATION_INVALID'],
    [input({...r,context:{}}),'CONTEXT_INVALID'],[input({...r,draftRef:{}}),'DRAFT_REF_INVALID'],[input({...r,draftRef:{draftId:'draft-1',draftHash:'short'}}),'DRAFT_REF_INVALID'],
    [input({...r,decidedAt:NOW+60_000}),'CONTEXT_EXPIRED']
  ]){
    const d=p.decide(bad);assert.equal(d.decision,'STOP',reason);assert.equal(d.reasonCode,reason);assert.equal(d.ruleId,'PILOT.INPUT_ADMITTED',reason);assert.equal(d.failClosed,true);assert.deepEqual([...d.carryLabels],[]);assert.equal(p.verifyPilotDecision(d),true,reason);
  }
});

test('exports are frozen, every gate rule and every warning class has a control class, and there is no execute, approve, grant, rewrite, run or fetch capability',()=>{
  assert.equal(Object.isFrozen(p),true);
  assert.deepEqual(Object.keys(p),['VERSION','INPUT_VERSION','DECISION_VERSION','RULESET_VERSION','DECISIONS','LABELLED_DELIVERY','INPUT_FIELDS','DRAFT_REF_FIELDS','POLICY_FIELDS','MAX_ITERATIONS','DEFAULT_POLICY','RULE_CLASS','WARNING_CLASS','RULES','policy','draftRef','decide','verifyPilotDecision']);
  assert.deepEqual([...p.DECISIONS],['STOP','ESCALATE_OWNER','REVISE_DRAFT','REQUEST_EVIDENCE','PROCEED']);
  assert.deepEqual(Object.keys(p.RULE_CLASS).sort(),g.RULES.map(r=>r.ruleId).sort());assert.deepEqual(Object.keys(p.WARNING_CLASS).sort(),[...v.WARNING_CLASSES].sort());
  for(const cls of [...Object.values(p.RULE_CLASS),...Object.values(p.WARNING_CLASS)])assert.ok(p.DECISIONS.includes(cls)&&cls!=='PROCEED',cls);
  // Only pipeline-integrity rules may ask for STOP; no warning class does, and nothing maps to PROCEED.
  assert.deepEqual(Object.entries(p.RULE_CLASS).filter(([,cls])=>cls==='STOP').map(([ruleId])=>ruleId),['GATE.INPUT_ADMITTED','GATE.OBSERVATION_AVAILABLE','GATE.VERDICT_MATCHES_DRAFT']);
  assert.equal(p.RULES.length,9);assert.equal(new Set(p.RULES.map(r=>r.ruleId)).size,9);assert.ok(p.RULES.every(r=>p.DECISIONS.includes(r.decision)));
  assert.deepEqual(p.DEFAULT_POLICY,{maxIterations:3,labelledDelivery:'PROCEED'});
  assert.equal(run({context:context({language:'tr'}),draft:supported()}).decision,'PROCEED');
});
