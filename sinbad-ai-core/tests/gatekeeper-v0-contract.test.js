'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {g,NOW,context,ITEMS,set,claim,citation,action,draft,verdict,input,rule,failed}=require('./helpers/gatekeeper-v0-builders.js');

test('a clean draft is ADMITTED with VERIFIED labels; the decision is frozen, sealed, attributable and executes nothing',()=>{
  const d=g.decide(input({draft:draft({claims:[claim('c1',{text:'The state file records the phase.',evidenceIds:['ev-repo']})],citations:[citation('cit-1','ev-repo')],proposedActions:[action('deliver',{actionClass:'DELIVER'})]})}));
  assert.equal(d.outcome,'ADMIT');assert.equal(d.failClosed,false);assert.equal(d.reasonCode,'ALL_CLEAR');assert.deepEqual([...d.labels],['VERIFIED']);assert.equal(d.deliveryLabel,'VERIFIED');
  assert.equal(d.stage,'POST');assert.equal(d.taskRef,'task-1');assert.equal(d.authority,'NONE');assert.equal(d.executes,false);
  assert.equal(Object.isFrozen(d),true);assert.equal(Object.isFrozen(d.decision),true);assert.equal(Object.isFrozen(d.observation),true);
  assert.equal(d.decision.version,'sinbad-gate-decision/1-v1');assert.equal(d.decision.outcome,'ADMIT');assert.deepEqual(d.decision.attribution,{deterministicRuleIds:[],modelVerdictId:null,reasonCode:'ALL_CLEAR'});
  assert.deepEqual(failed(d),[]);assert.equal(d.ruleResults.length,g.RULES.length);
  assert.deepEqual(d.claimLabels,[{claimId:'c1',assertionMode:'ASSERTED',label:'VERIFIED',reasonCode:'OBSERVED_EVIDENCE_PRESENT',evidenceIds:['ev-repo'],volatile:false}]);
  assert.deepEqual(d.actions,[{actionId:'deliver',actionClass:'DELIVER',protected:false,authorityRef:null,status:'ADMITTED',reasonCode:'ALL_CLEAR'}]);
  assert.equal(g.verifyDecision(d),true);
});

test('the decision carries full provenance: input digest, evidence set, draft id and hash, the Sentinel observation and its digest, policy, versions',()=>{
  const d=g.decide(input({draft:draft({claims:[claim('c1',{evidenceIds:['ev-repo']})]})}));
  const p=d.provenance;
  assert.match(p.inputDigest,/^[a-f0-9]{64}$/u);assert.equal(p.contextTaskId,'task-1');assert.equal(p.evidenceSetId,'set-1');assert.equal(p.draftId,'draft-1');assert.match(p.draftHash,/^7{64}$/u);
  assert.equal(p.observationDigest,d.observation.reportDigest);assert.equal(d.observation.version,'sinbad-sentinel-report/0-v1');assert.equal(d.observation.tap,'POST_GATE');assert.equal(d.observation.reportId,'decision-1');
  assert.equal(p.verdictId,null);assert.equal(p.priorDecisionDigest,null);assert.deepEqual(p.policy,{maxEvidenceAgeMs:10_000,volatileMaxEvidenceAgeMs:1_000});
  assert.equal(p.gatekeeperVersion,g.VERSION);assert.equal(p.rulesetVersion,g.RULESET_VERSION);assert.equal(p.sentinelVersion,'sinbad-sentinel/0-v1');
  assert.equal(JSON.stringify(d).includes('The state file'),false);
});

test('decisions are deterministic, verifiable and chainable; any edit after sealing is detected',()=>{
  const a=g.decide(input({draft:draft({claims:[claim('c1',{evidenceIds:['ev-repo']})]})}));
  const b=g.decide(input({draft:draft({claims:[claim('c1',{evidenceIds:['ev-repo']})]})}));
  assert.deepEqual(a,b);assert.equal(a.decisionDigest,b.decisionDigest);
  const next=g.decide(input({decisionId:'decision-2',priorDecisionDigest:a.decisionDigest}));
  assert.equal(next.provenance.priorDecisionDigest,a.decisionDigest);assert.notEqual(next.decisionDigest,a.decisionDigest);
  const edited=JSON.parse(JSON.stringify(a));edited.outcome='ADMIT';edited.labels=[];edited.claimLabels[0].label='VERIFIED';edited.ruleResults=edited.ruleResults.map(r=>({...r,outcome:'PASS'}));
  assert.equal(g.verifyDecision(edited),false);
  const observationEdited=JSON.parse(JSON.stringify(a));observationEdited.observation.claims[0].truthState='NOT_VERIFIED';
  assert.equal(g.verifyDecision(observationEdited),false);
  assert.equal(g.verifyDecision(JSON.parse(JSON.stringify(a))),true);assert.equal(g.verifyDecision(null),false);assert.equal(g.verifyDecision({}),false);
});

test('input admission is exact and consistent: extra or missing fields, bad policy, bad draft parts and inconsistent actions fail closed',()=>{
  for(const [bad,reason] of [
    [null,'INPUT_INVALID'],[input({extra:1}),'INPUT_INVALID'],[{...input(),version:'x'},'INPUT_INVALID'],[input({observedAt:'0'}),'INPUT_INVALID'],[input({priorDecisionDigest:'zz'}),'INPUT_INVALID'],
    [input({policy:{maxEvidenceAgeMs:10,volatileMaxEvidenceAgeMs:11}}),'POLICY_INVALID'],[input({policy:{maxEvidenceAgeMs:10}}),'POLICY_INVALID'],[input({policy:{maxEvidenceAgeMs:10,volatileMaxEvidenceAgeMs:0}}),'POLICY_INVALID'],
    [input({context:{}}),'CONTEXT_INVALID'],[input({evidenceSet:{}}),'EVIDENCE_SET_INVALID'],
    [input({draft:{}}),'DRAFT_INVALID'],[input({draft:draft({draftHash:'short'})}),'DRAFT_INVALID'],[input({draft:draft({claims:[claim('c'),claim('c')]})}),'DRAFT_INVALID'],
    [input({draft:draft({citations:[citation('x','ev-repo'),citation('x','ev-repo')]})}),'DRAFT_INVALID'],[input({draft:draft({citations:[{citationId:'x'}]})}),'DRAFT_INVALID'],
    [input({draft:draft({proposedActions:[action('w',{actionClass:'WRITE',protected:false})]})}),'DRAFT_INVALID'],[input({draft:draft({proposedActions:[action('w',{actionClass:'EXECUTE',protected:false,authorityRef:'grant-1'})]})}),'DRAFT_INVALID'],
    [input({draft:draft({proposedActions:[action('w',{actionClass:'THINK'})]})}),'DRAFT_INVALID'],[input({draft:draft({proposedActions:[action('a'),action('a')]})}),'DRAFT_INVALID'],
    [input({verdict:{}}),'VERDICT_INVALID'],[input({verdict:verdict({authority:'FINAL'})}),'VERDICT_INVALID'],
    [input({observedAt:NOW+60_000}),'CONTEXT_EXPIRED'],[input({evidenceSet:set([ITEMS.repo],{taskRef:'task-2'})}),'EVIDENCE_TASK_MISMATCH'],
    [input({evidenceSet:set([{...ITEMS.repo,observedAt:NOW+1}])}),'OBSERVATION_EVIDENCE_TIME_INCONSISTENT'],[input({draft:draft({claims:[claim('c',{text:'x',contentHash:'0'.repeat(64)})]})}),'OBSERVATION_CLAIM_CONTENT_HASH_MISMATCH']
  ]){
    const d=g.decide(bad);assert.equal(d.outcome,'BLOCK',reason);assert.equal(d.reasonCode,reason);assert.equal(d.failClosed,true);assert.equal(d.deliveryLabel,'BLOCKED');assert.deepEqual([...d.labels],['BLOCKED']);
    assert.deepEqual(d.ruleResults,[{ruleId:'GATE.INPUT_ADMITTED',outcome:'FAIL',blocking:true,detailRef:`reason:${reason}`}]);assert.equal(d.decision.outcome,'BLOCK');assert.equal(g.verifyDecision(d),true);
  }
  assert.equal(g.decide(input({draft:draft({proposedActions:[action('r',{actionClass:'READ',protected:true,authorityRef:'grant-1'})]}),context:context({authorityRefs:['grant-1']}),verdict:verdict()})).outcome,'ADMIT');
});

test('exports are frozen and contain no execute, deliver, wire, approve, rewrite or fetch capability',()=>{
  assert.equal(Object.isFrozen(g),true);
  assert.deepEqual(Object.keys(g),['VERSION','INPUT_VERSION','DECISION_VERSION','RULESET_VERSION','STAGE','ACTION_CLASSES','ALWAYS_PROTECTED','LABEL_ORDER','LIVE_CLASSES','INPUT_FIELDS','DRAFT_FIELDS','CITATION_FIELDS','ACTION_FIELDS','POLICY_FIELDS','DEFAULT_POLICY','RULES','VOLATILE','policy','citation','action','draft','decide','verifyDecision']);
  assert.equal(g.STAGE,'POST');assert.equal(g.RULES.length,16);assert.equal(new Set(g.RULES.map(r=>r.ruleId)).size,16);
  assert.deepEqual(g.RULES.filter(r=>r.blocking).map(r=>r.ruleId),['GATE.INPUT_ADMITTED','GATE.OBSERVATION_AVAILABLE','GATE.CITATIONS_IN_EVIDENCE','GATE.CLAIM_EVIDENCE_RESOLVABLE','GATE.SPECIFICITY_SUPPORTED','GATE.VOCABULARY_BOUND','GATE.FOREIGN_CLAIMS_EXCLUDED','GATE.VOLATILE_CLAIMS_LIVE','GATE.ACTIONS_AUTHORIZED','GATE.VERDICT_MATCHES_DRAFT']);
  assert.deepEqual(g.DEFAULT_POLICY,{maxEvidenceAgeMs:86_400_000,volatileMaxEvidenceAgeMs:300_000});
  const d=g.decide(input());for(const r of g.RULES)assert.ok(rule(d,r.ruleId),r.ruleId);
});
