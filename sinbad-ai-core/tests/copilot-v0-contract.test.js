'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {c,v,NOW,context,ITEMS,set,claim,citation,action,draft,input,warned}=require('./helpers/copilot-v0-builders.js');
const TEXT='The state file records the phase.';

test('a clean draft is REVIEWED with an ALLOW verdict in the accepted contract shape; the review is frozen, sealed and has no authority',()=>{
  const r=c.review(input({draft:draft({claims:[claim('c1',{text:TEXT,evidenceIds:['ev-repo']})],citations:[citation('cit-1','ev-repo')],proposedActions:[action('deliver',{actionClass:'DELIVER'})]})}));
  assert.equal(r.status,'REVIEWED');assert.equal(r.failClosed,false);assert.equal(r.reasonCode,'REVIEWED');assert.equal(r.taskRef,'task-1');
  assert.equal(r.authority,'NONE');assert.equal(r.rewrites,false);assert.equal(r.approves,false);assert.equal(r.callsModel,false);
  assert.equal(Object.isFrozen(r),true);assert.equal(Object.isFrozen(r.verdict),true);assert.equal(Object.isFrozen(r.observation),true);
  assert.deepEqual(r.verdict,{version:'sinbad-copilot-verdict/1-v1',verdictId:'verdict-1',taskRef:'task-1',draftHash:'7'.repeat(64),warnings:[],recommendation:'ALLOW',issuedAt:NOW,authority:'NONE'});
  assert.deepEqual(v.snapshot(JSON.parse(JSON.stringify(r.verdict))),r.verdict);
  assert.deepEqual(warned(r),[]);assert.equal(r.checkers.length,c.CHECKERS.length);assert.ok(r.checkers.every(x=>x.outcome==='CLEAR'&&x.warningCount===0));
  assert.deepEqual([...r.notCovered],['INSTRUCTION_CONFLICT','CORRELATED_FAILURE_RISK']);assert.equal(r.warningsTruncated,0);
  assert.equal(c.verifyReview(r),true);
});

test('the review carries full provenance and never the claim text',()=>{
  const r=c.review(input({draft:draft({claims:[claim('c1',{text:TEXT,evidenceIds:['ev-repo']})]})}));const p=r.provenance;
  assert.match(p.inputDigest,/^[a-f0-9]{64}$/u);assert.equal(p.contextTaskId,'task-1');assert.equal(p.evidenceSetId,'set-1');assert.equal(p.draftId,'draft-1');assert.match(p.draftHash,/^7{64}$/u);
  assert.equal(p.observationDigest,r.observation.reportDigest);assert.equal(r.observation.tap,'POST_DRAFT');assert.equal(r.observation.reportId,'review-1');
  assert.equal(p.priorReviewDigest,null);assert.deepEqual(p.policy,{maxEvidenceAgeMs:10_000});
  assert.equal(p.copilotVersion,c.VERSION);assert.equal(p.checkersetVersion,c.CHECKERSET_VERSION);assert.equal(p.sentinelVersion,'sinbad-sentinel/0-v1');
  assert.equal(JSON.stringify(r).includes('The state file'),false);
});

test('reviews are deterministic, verifiable and chainable; any edit after sealing is detected',()=>{
  const make=()=>c.review(input({draft:draft({claims:[claim('c1',{text:'The bridge probably scans the whole library.'})]})}));
  const a=make(),b=make();assert.deepEqual(a,b);assert.equal(a.reviewDigest,b.reviewDigest);assert.equal(a.verdict.recommendation,'LABEL');
  const next=c.review(input({reviewId:'review-2',verdictId:'verdict-2',priorReviewDigest:a.reviewDigest}));
  assert.equal(next.provenance.priorReviewDigest,a.reviewDigest);assert.notEqual(next.reviewDigest,a.reviewDigest);
  const softened=JSON.parse(JSON.stringify(a));softened.verdict.warnings=[];softened.verdict.recommendation='ALLOW';assert.equal(c.verifyReview(softened),false);
  const observationEdited=JSON.parse(JSON.stringify(a));observationEdited.observation.claims[0].truthState='VERIFIED';assert.equal(c.verifyReview(observationEdited),false);
  assert.equal(c.verifyReview(JSON.parse(JSON.stringify(a))),true);assert.equal(c.verifyReview(null),false);assert.equal(c.verifyReview({}),false);
});

test('input admission is exact: invalid input fails closed, and a verdict is issued only for a known task and a known draft',()=>{
  for(const [bad,reason,hasVerdict] of [
    [null,'INPUT_INVALID',false],[input({extra:1}),'INPUT_INVALID',false],[{...input(),version:'x'},'INPUT_INVALID',false],[input({issuedAt:'0'}),'INPUT_INVALID',false],[input({verdictId:''}),'INPUT_INVALID',false],[input({priorReviewDigest:'zz'}),'INPUT_INVALID',false],
    [input({policy:{}}),'POLICY_INVALID',false],[input({policy:{maxEvidenceAgeMs:0}}),'POLICY_INVALID',false],
    [input({context:{}}),'CONTEXT_INVALID',false],[input({evidenceSet:{}}),'EVIDENCE_SET_INVALID',false],
    [input({draft:{}}),'DRAFT_INVALID',false],[input({draft:draft({draftHash:'short'})}),'DRAFT_INVALID',false],[input({draft:draft({claims:[claim('c'),claim('c')]})}),'DRAFT_INVALID',false],
    [input({draft:draft({citations:[citation('x','ev-repo'),citation('x','ev-repo')]})}),'DRAFT_INVALID',false],[input({draft:draft({proposedActions:[action('w',{actionClass:'WRITE',protected:false})]})}),'DRAFT_INVALID',false],
    [input({draft:draft({proposedActions:[action('w',{actionClass:'THINK'})]})}),'DRAFT_INVALID',false],
    [input({issuedAt:NOW+60_000}),'CONTEXT_EXPIRED',true],[input({evidenceSet:set([ITEMS.repo],{taskRef:'task-2'})}),'EVIDENCE_TASK_MISMATCH',true],
    [input({evidenceSet:set([{...ITEMS.repo,observedAt:NOW+1}])}),'OBSERVATION_EVIDENCE_TIME_INCONSISTENT',true],[input({draft:draft({claims:[claim('c',{text:'x',contentHash:'0'.repeat(64)})]})}),'OBSERVATION_CLAIM_CONTENT_HASH_MISMATCH',true]
  ]){
    const r=c.review(bad);assert.equal(r.status,'BLOCKED',reason);assert.equal(r.reasonCode,reason);assert.equal(r.failClosed,true);assert.ok(r.checkers.every(x=>x.outcome==='NOT_RUN'),reason);assert.equal(c.verifyReview(r),true,reason);
    if(!hasVerdict){assert.equal(r.verdict,null,reason);continue;}
    assert.equal(r.verdict.recommendation,'BLOCK',reason);assert.deepEqual(r.verdict.warnings,[{warningClass:'PROVENANCE_GAP',severity:'BLOCKING',checkerKind:'DETERMINISTIC',evidenceIds:[],pointerRef:`review:blocked:${reason}`}]);
    assert.notEqual(v.snapshot(JSON.parse(JSON.stringify(r.verdict))),null,reason);
  }
  assert.equal(c.review(input({context:context({authorityRefs:['grant-1']}),draft:draft({proposedActions:[action('r',{actionClass:'READ',protected:true,authorityRef:'grant-1'})]})})).verdict.recommendation,'ALLOW');
});

test('exports are frozen and contain no answer, rewrite, approve, execute, wire or fetch capability',()=>{
  assert.equal(Object.isFrozen(c),true);
  assert.deepEqual(Object.keys(c),['VERSION','INPUT_VERSION','REVIEW_VERSION','CHECKERSET_VERSION','STATUSES','ACTION_CLASSES','ALWAYS_PROTECTED','INPUT_FIELDS','DRAFT_FIELDS','CITATION_FIELDS','ACTION_FIELDS','POLICY_FIELDS','DEFAULT_POLICY','CHECKERS','NOT_COVERED','AUTHORITY_VOICE','policy','citation','action','draft','review','verifyReview']);
  assert.equal(c.CHECKERS.length,7);assert.equal(new Set(c.CHECKERS.map(x=>x.checkerId)).size,7);
  // Every warning class of the accepted contract is either emitted by a named checker or declared not covered; none is silently missing.
  const covered=new Set(c.CHECKERS.flatMap(x=>[...x.warningClasses]));
  for(const warningClass of v.WARNING_CLASSES)assert.notEqual(covered.has(warningClass),c.NOT_COVERED.includes(warningClass),warningClass);
  assert.deepEqual(c.DEFAULT_POLICY,{maxEvidenceAgeMs:86_400_000});
});
