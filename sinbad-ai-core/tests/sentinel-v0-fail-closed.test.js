'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {s,NOW,context,ITEMS,set,claim,input}=require('./helpers/sentinel-v0-builders.js');

function assertBlocked(report,reasonCode){
  assert.equal(report.status,'BLOCKED',reasonCode);assert.equal(report.failClosed,true);assert.equal(report.reasonCode,reasonCode);assert.equal(report.signal,'BLOCKED');assert.equal(report.coverage,'NONE');
  assert.deepEqual([...report.unobservable],[reasonCode]);assert.deepEqual(report.claims,[]);assert.equal(report.evidence,null);assert.deepEqual(report.flags,[]);
  assert.deepEqual(report.ruleResults,[{ruleId:'SENTINEL.INPUT_ADMITTED',outcome:'FAIL',blocking:true,detailRef:`reason:${reasonCode}`}]);
  assert.equal(report.authority,'NONE');assert.equal(report.decides,false);assert.equal(Object.isFrozen(report),true);assert.equal(s.verifyReport(report),true);
}

test('an expired task context fails closed even when every claim is well supported',()=>{
  const r=s.observe(input({observedAt:NOW+50_000,claims:[claim('c1',{evidenceIds:['ev-repo']})]}));
  assertBlocked(r,'CONTEXT_EXPIRED');assert.equal(r.taskRef,'task-1');assert.equal(r.observedAt,NOW+50_000);assert.match(r.provenance.inputDigest,/^[a-f0-9]{64}$/u);
  assert.equal(s.observe(input({context:context({expiresAt:NOW})})).reasonCode,'CONTEXT_EXPIRED');
  assert.equal(s.observe(input({context:context({expiresAt:NOW+1})})).status,'OBSERVED');
});

test('structural failures block before any digest is computed; semantic failures block with the digest of the admitted input',()=>{
  const structural=[[null,'INPUT_INVALID'],[input({policy:null}),'POLICY_INVALID'],[input({context:null}),'CONTEXT_INVALID'],[input({evidenceSet:[]}),'EVIDENCE_SET_INVALID'],[input({claims:[null]}),'CLAIMS_INVALID'],[input({claims:[claim('x'),claim('x')]}),'CLAIMS_DUPLICATE']];
  for(const [bad,reason] of structural){const r=s.observe(bad);assertBlocked(r,reason);assert.equal(r.provenance.inputDigest,null);}
  const semantic=[[input({observedAt:NOW+60_000}),'CONTEXT_EXPIRED'],[input({evidenceSet:set([ITEMS.repo],{taskRef:'task-9'})}),'EVIDENCE_TASK_MISMATCH'],[input({evidenceSet:set([{...ITEMS.repo,observedAt:NOW+1}])}),'EVIDENCE_TIME_INCONSISTENT'],[input({claims:[claim('c',{text:'x',contentHash:'0'.repeat(64)})]}),'CLAIM_CONTENT_HASH_MISMATCH']];
  for(const [bad,reason] of semantic){const r=s.observe(bad);assertBlocked(r,reason);assert.match(r.provenance.inputDigest,/^[a-f0-9]{64}$/u);}
});

test('a blocked report still identifies what it can (observation id, tap, task, policy) and nothing it cannot',()=>{
  const r=s.observe(input({observationId:'obs-77',tap:'DELIVERY',evidenceSet:set([ITEMS.repo],{taskRef:'task-9'})}));
  assert.equal(r.reportId,'obs-77');assert.equal(r.tap,'DELIVERY');assert.equal(r.taskRef,'task-1');assert.equal(r.provenance.evidenceSetId,'set-1');assert.deepEqual(r.provenance.policy,{maxEvidenceAgeMs:10_000});
  const invalid=s.observe({});
  assert.equal(invalid.reportId,'invalid');assert.equal(invalid.taskRef,null);assert.equal(invalid.provenance.policy,null);assert.equal(invalid.observedAt,0);
});

test('observe never throws: hostile inputs (throwing getters, proxies, cyclic objects, exotic prototypes) fail closed',()=>{
  const throwing={};Object.defineProperty(throwing,'version',{get(){throw new Error('boom');},enumerable:true});
  const proxy=new Proxy(input(),{ownKeys(){throw new Error('boom');}});
  const cyclic=input();cyclic.claims=[claim('c')];cyclic.claims[0].evidenceIds=cyclic.claims;
  const exotic=Object.assign(Object.create({version:s.INPUT_VERSION}),input());
  for(const hostile of [throwing,proxy,cyclic,exotic,Symbol('x'),()=>{},new Date(0),new Map()]){
    let r;assert.doesNotThrow(()=>{r=s.observe(hostile);});assert.equal(r.status,'BLOCKED');assert.equal(r.failClosed,true);
  }
});

test('fail-closed reports are deterministic and chainable like observed reports',()=>{
  const a=s.observe(input({observedAt:NOW+60_000}));const b=s.observe(input({observedAt:NOW+60_000}));
  assert.deepEqual(a,b);
  const next=s.observe(input({observationId:'obs-2',priorReportDigest:a.reportDigest}));
  assert.equal(next.status,'OBSERVED');assert.equal(next.provenance.priorReportDigest,a.reportDigest);
});
