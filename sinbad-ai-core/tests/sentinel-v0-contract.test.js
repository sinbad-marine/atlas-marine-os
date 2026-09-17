'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {s,ITEMS,set,claim,input,claimOf}=require('./helpers/sentinel-v0-builders.js');

test('a clean observation is OBSERVED, CLEAR, FULL coverage, frozen, without authority and without a decision',()=>{
  const r=s.observe(input({claims:[claim('c1',{text:'The state file records phase 2 as complete.',evidenceIds:['ev-repo']})]}));
  assert.equal(r.status,'OBSERVED');assert.equal(r.failClosed,false);assert.equal(r.signal,'CLEAR');assert.equal(r.coverage,'FULL');assert.deepEqual([...r.unobservable],[]);
  assert.equal(r.authority,'NONE');assert.equal(r.decides,false);assert.equal(Object.isFrozen(r),true);assert.equal(Object.isFrozen(r.claims[0]),true);assert.equal(Object.isFrozen(r.flags),true);
  assert.equal(claimOf(r,'c1').truthState,'VERIFIED');assert.equal(claimOf(r,'c1').reasonCode,'OBSERVED_EVIDENCE_PRESENT');
  assert.deepEqual([...claimOf(r,'c1').eligibleEvidenceIds],['ev-repo']);assert.deepEqual(r.flags.length,0);
  assert.ok(r.ruleResults.every(x=>x.outcome==='PASS'));assert.equal(r.ruleResults.length,s.RULES.length);
  assert.equal(r.truthStateCounts.VERIFIED,1);assert.equal(r.tap,'POST_DRAFT');assert.equal(r.taskRef,'task-1');
});

test('the report carries provenance: input digest, context, evidence set, policy, versions, and a verifiable report digest',()=>{
  const r=s.observe(input({claims:[claim('c1',{evidenceIds:['ev-repo']})]}));
  assert.match(r.provenance.inputDigest,/^[a-f0-9]{64}$/u);assert.equal(r.provenance.contextTaskId,'task-1');assert.equal(r.provenance.evidenceSetId,'set-1');
  assert.deepEqual(r.provenance.policy,{maxEvidenceAgeMs:10_000});assert.equal(r.provenance.sentinelVersion,s.VERSION);assert.equal(r.provenance.rulesetVersion,s.RULESET_VERSION);
  assert.equal(s.verifyReport(r),true);
  assert.equal(s.verifyReport({...r,signal:'CLEAR',status:'OBSERVED',claims:[]}),false);
  assert.equal(s.verifyReport({...r,reportDigest:'0'.repeat(64)}),false);assert.equal(s.verifyReport(null),false);assert.equal(s.verifyReport({}),false);
  // The report never carries claim text; only its hash.
  assert.equal(JSON.stringify(r).includes('The state file'),false);
});

test('observation is deterministic: identical input yields an identical report and digest; reports can be chained',()=>{
  const first=s.observe(input({claims:[claim('c1',{evidenceIds:['ev-repo']})]}));
  const again=s.observe(input({claims:[claim('c1',{evidenceIds:['ev-repo']})]}));
  assert.deepEqual(again,first);assert.equal(again.reportDigest,first.reportDigest);
  const chained=s.observe(input({observationId:'obs-2',tap:'DELIVERY',priorReportDigest:first.reportDigest}));
  assert.equal(chained.provenance.priorReportDigest,first.reportDigest);assert.notEqual(chained.reportDigest,first.reportDigest);
  assert.notEqual(s.observe(input({observedAt:1_000_001})).provenance.inputDigest,first.provenance.inputDigest);
});

test('input admission is exact: extra, missing, inherited, accessor or coercive fields fail closed',()=>{
  for(const bad of [input({extra:1}),{...input(),version:'sinbad-sentinel-input/9-v9'},Object.create(input()),(()=>{const i=input();delete i.policy;return i;})(),input({tap:'MIDWAY'}),input({observedAt:-1}),input({observedAt:'1000'}),input({priorReportDigest:'abc'}),input({claims:'none'}),input({claims:new Array(s.MAX_CLAIMS+1).fill(claim('c'))}),null,undefined,'text',[],42]){
    const r=s.observe(bad);assert.equal(r.status,'BLOCKED');assert.equal(r.reasonCode,'INPUT_INVALID');assert.equal(r.failClosed,true);assert.equal(r.provenance.inputDigest,null);
  }
  const accessor=input();Object.defineProperty(accessor,'observedAt',{get(){return 1_000_000;},enumerable:true});
  assert.equal(s.observe(accessor).reasonCode,'INPUT_INVALID');
  assert.equal(s.observe(input({policy:{maxEvidenceAgeMs:0}})).reasonCode,'POLICY_INVALID');
  assert.equal(s.observe(input({policy:{maxEvidenceAgeMs:10,extra:true}})).reasonCode,'POLICY_INVALID');
  assert.equal(s.observe(input({policy:{maxEvidenceAgeMs:'10'}})).reasonCode,'POLICY_INVALID');
  assert.equal(s.observe(input({context:{}})).reasonCode,'CONTEXT_INVALID');
  assert.equal(s.observe(input({evidenceSet:{}})).reasonCode,'EVIDENCE_SET_INVALID');
  assert.equal(s.observe(input({evidenceSet:set([ITEMS.repo,ITEMS.repo])})).reasonCode,'EVIDENCE_SET_INVALID');
  assert.equal(s.observe(input({claims:[claim('c1',{assertionMode:'GUESSED'})]})).reasonCode,'CLAIMS_INVALID');
  assert.equal(s.observe(input({claims:[claim('c1',{text:''})]})).reasonCode,'CLAIMS_INVALID');
  assert.equal(s.observe(input({claims:[claim('c1',{evidenceIds:['ev-repo','ev-repo']})]})).reasonCode,'CLAIMS_INVALID');
  assert.equal(s.observe(input({claims:[claim('c1',{extra:1})]})).reasonCode,'CLAIMS_INVALID');
  assert.equal(s.observe(input({claims:[claim('c1'),claim('c1')]})).reasonCode,'CLAIMS_DUPLICATE');
});

test('taps are recorded, not interpreted: the same rules apply at every tap',()=>{
  const reports=s.TAPS.map(tap=>s.observe(input({tap,claims:[claim('c1',{evidenceIds:['ev-repo']})]})));
  assert.deepEqual(reports.map(r=>r.tap),[...s.TAPS]);
  assert.equal(new Set(reports.map(r=>JSON.stringify({...r,tap:null,reportDigest:null,provenance:{...r.provenance,inputDigest:null}}))).size,1);
});

test('exports are frozen and contain no execute, wire, decide, approve, rewrite or fetch capability',()=>{
  assert.equal(Object.isFrozen(s),true);
  assert.deepEqual(Object.keys(s),['VERSION','INPUT_VERSION','REPORT_VERSION','RULESET_VERSION','TAPS','ASSERTION_MODES','STATUSES','SIGNALS','COVERAGE','TRUTH_STATES','INPUT_FIELDS','CLAIM_FIELDS','POLICY_FIELDS','MAX_CLAIMS','DEFAULT_POLICY','RULES','SPECIFIC_VALUE','sha256','canonical','claim','policy','observe','verifyReport']);
  assert.deepEqual([...s.TRUTH_STATES],['VERIFIED','NOT_VERIFIED','CONFLICT','SOURCE_MISSING','BLOCKED','NOT_APPLICABLE']);
  assert.deepEqual([...s.SIGNALS],['CLEAR','ATTENTION','RISK','BLOCKED']);assert.deepEqual([...s.STATUSES],['OBSERVED','BLOCKED']);
  assert.equal(s.RULES.length,10);assert.equal(new Set(s.RULES.map(r=>r.ruleId)).size,10);
  assert.deepEqual(s.DEFAULT_POLICY,{maxEvidenceAgeMs:86_400_000});
});
