'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {s,ITEMS,set,claim,input,claimOf,rule,flagsOf}=require('./helpers/sentinel-v0-builders.js');

test('missing evidence: a claim without evidence is SOURCE_MISSING and an asserted one is flagged; nothing is guessed from plausible wording',()=>{
  const r=s.observe(input({claims:[claim('c1',{text:'The document says the plan was approved by everyone yesterday and it is fine.'}),claim('c2',{assertionMode:'REPORTED'})]}));
  assert.equal(claimOf(r,'c1').truthState,'SOURCE_MISSING');assert.equal(claimOf(r,'c1').reasonCode,'NO_EVIDENCE');
  assert.deepEqual(flagsOf(r,'c1').map(f=>[f.warningClass,f.severity]),[['UNSUPPORTED_FACTUAL_ASSERTION','WARN'],['FALSE_CERTAINTY','BLOCKING']]);
  assert.deepEqual([...claimOf(r,'c1').reservedTerms],['APPROVED']);
  assert.equal(claimOf(r,'c2').truthState,'SOURCE_MISSING');assert.deepEqual(flagsOf(r,'c2'),[]);
  assert.equal(rule(r,'SENTINEL.CLAIMS_SUPPORTED').outcome,'FAIL');assert.equal(rule(r,'SENTINEL.CLAIMS_SUPPORTED').detailRef,'claims:c1');
});

test('missing evidence set: provenance cannot be resolved, coverage is PARTIAL and claims are NOT_VERIFIED rather than VERIFIED',()=>{
  const r=s.observe(input({evidenceSet:null,claims:[claim('c1',{evidenceIds:['ev-repo']}),claim('c2')]}));
  assert.equal(r.status,'OBSERVED');assert.equal(r.coverage,'PARTIAL');
  assert.deepEqual([...r.unobservable],['EVIDENCE_SET_NOT_PROVIDED','CLAIM_TEXT_NOT_PROVIDED']);
  assert.equal(claimOf(r,'c1').truthState,'NOT_VERIFIED');assert.equal(claimOf(r,'c1').reasonCode,'EVIDENCE_SET_NOT_PROVIDED');
  assert.deepEqual([...claimOf(r,'c1').unobservable],['CLAIM_TEXT_NOT_PROVIDED','EVIDENCE_NOT_RESOLVABLE_WITHOUT_SET']);
  assert.equal(claimOf(r,'c2').truthState,'SOURCE_MISSING');
  assert.equal(r.flags[0].warningClass,'PROVENANCE_GAP');assert.equal(r.flags[0].pointerRef,'evidence-set:not-provided');
  assert.equal(rule(r,'SENTINEL.EVIDENCE_SET_PRESENT').outcome,'FAIL');assert.equal(r.evidence.setRef,null);assert.equal(r.evidence.itemCount,0);
  // At ingress with no claims, a missing set is not a gap.
  const ingress=s.observe(input({tap:'INGRESS',evidenceSet:null}));
  assert.equal(ingress.coverage,'FULL');assert.equal(rule(ingress,'SENTINEL.EVIDENCE_SET_PRESENT').outcome,'PASS');assert.equal(ingress.signal,'CLEAR');
});

test('stale evidence: items older than the policy age are reported and cannot verify a claim',()=>{
  const r=s.observe(input({evidenceSet:set([ITEMS.repo,ITEMS.stale]),claims:[claim('c1',{evidenceIds:['ev-stale']}),claim('c2',{evidenceIds:['ev-stale','ev-repo']})]}));
  assert.deepEqual([...r.evidence.staleEvidenceIds],['ev-stale']);
  assert.equal(claimOf(r,'c1').truthState,'NOT_VERIFIED');assert.equal(claimOf(r,'c1').reasonCode,'ELIGIBLE_EVIDENCE_MISSING_STALE_OR_FOREIGN');
  assert.deepEqual([...claimOf(r,'c1').staleEvidenceIds],['ev-stale']);assert.deepEqual([...claimOf(r,'c1').eligibleEvidenceIds],[]);
  assert.equal(claimOf(r,'c2').truthState,'VERIFIED');assert.deepEqual([...claimOf(r,'c2').eligibleEvidenceIds],['ev-repo']);
  const staleFlag=r.flags.find(f=>f.warningClass==='STALE_AUTHORITATIVE_STATE');
  assert.deepEqual([...staleFlag.evidenceIds],['ev-stale']);assert.equal(staleFlag.pointerRef,'evidence:stale:count=1:maxAgeMs=10000');
  assert.equal(rule(r,'SENTINEL.EVIDENCE_FRESH').outcome,'FAIL');assert.equal(r.signal,'ATTENTION');
  // The same item is fresh under a wider policy.
  const wide=s.observe(input({evidenceSet:set([ITEMS.stale]),claims:[claim('c1',{evidenceIds:['ev-stale']})],policy:{maxEvidenceAgeMs:200_000}}));
  assert.equal(claimOf(wide,'c1').truthState,'VERIFIED');assert.equal(wide.signal,'CLEAR');
});

test('conflicting evidence: one locator observed with two contents is a CONFLICT for every claim resting on it',()=>{
  const r=s.observe(input({evidenceSet:set([ITEMS.repo,ITEMS.drift,ITEMS.live]),claims:[claim('c1',{evidenceIds:['ev-repo']}),claim('c2',{evidenceIds:['ev-repo','ev-drift']}),claim('c3',{evidenceIds:['ev-live']})]}));
  assert.deepEqual(r.evidence.driftedLocators,[{locatorRef:'git:main:docs/state.json',evidenceIds:['ev-repo','ev-drift'],conflictKind:'OBSERVED_CONFLICT',resolution:'CONFLICT_UNRESOLVED_SAME_QUALITY'}]);
  for(const claimId of ['c1','c2']){assert.equal(claimOf(r,claimId).truthState,'CONFLICT');assert.equal(claimOf(r,claimId).reasonCode,'EVIDENCE_CONFLICT');assert.equal(flagsOf(r,claimId)[0].warningClass,'CONTRADICTION_WITH_REPOSITORY_OR_RUNTIME_TRUTH');}
  assert.equal(claimOf(r,'c3').truthState,'VERIFIED');
  assert.equal(r.flags.find(f=>f.pointerRef==='locator:git:main:docs/state.json').severity,'WARN');
  assert.equal(rule(r,'SENTINEL.EVIDENCE_CONSISTENT').outcome,'FAIL');assert.equal(rule(r,'SENTINEL.EVIDENCE_CONSISTENT').detailRef,'locators:git:main:docs/state.json');
  // A conflict is not "filled in" by a claim that cites only one side, and it is not an unsupported assertion.
  assert.deepEqual(flagsOf(r,'c1').map(f=>f.warningClass),['CONTRADICTION_WITH_REPOSITORY_OR_RUNTIME_TRUTH']);
});

test('foreign-scope evidence is identified and never verifies a claim of this task',()=>{
  const r=s.observe(input({evidenceSet:set([ITEMS.repo,ITEMS.foreign]),claims:[claim('c1',{evidenceIds:['ev-foreign']})]}));
  assert.deepEqual([...r.evidence.foreignEvidenceIds],['ev-foreign']);
  assert.equal(claimOf(r,'c1').truthState,'NOT_VERIFIED');assert.deepEqual([...claimOf(r,'c1').foreignEvidenceIds],['ev-foreign']);
  const f=r.flags.find(x=>x.pointerRef==='evidence:foreign-scope:count=1');assert.equal(f.warningClass,'CONTEXT_MISMATCH');assert.equal(f.severity,'WARN');
  assert.equal(rule(r,'SENTINEL.EVIDENCE_IN_SCOPE').outcome,'FAIL');assert.equal(rule(r,'SENTINEL.EVIDENCE_IN_SCOPE').detailRef,'evidence:ev-foreign');
});

test('evidence observed in the future or a set retrieved after the observation fails closed',()=>{
  assert.equal(s.observe(input({evidenceSet:set([{...ITEMS.repo,observedAt:1_000_001}])})).reasonCode,'EVIDENCE_TIME_INCONSISTENT');
  assert.equal(s.observe(input({evidenceSet:set([ITEMS.repo],{retrievedAt:1_000_001})})).reasonCode,'EVIDENCE_TIME_INCONSISTENT');
  assert.equal(s.observe(input({evidenceSet:set([ITEMS.repo],{taskRef:'task-2'})})).reasonCode,'EVIDENCE_TASK_MISMATCH');
});
