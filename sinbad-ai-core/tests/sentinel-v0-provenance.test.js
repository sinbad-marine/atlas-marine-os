'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {s,h,ITEMS,set,claim,input,claimOf,rule,flagsOf}=require('./helpers/sentinel-v0-builders.js');

test('provenance loss: a claim citing an evidence id that is not in the set is BLOCKED with a BLOCKING provenance gap',()=>{
  const r=s.observe(input({claims:[claim('lost',{evidenceIds:['ev-repo','ev-gone']}),claim('ok',{evidenceIds:['ev-repo']})]}));
  const c=claimOf(r,'lost');
  assert.equal(c.truthState,'BLOCKED');assert.equal(c.reasonCode,'UNKNOWN_EVIDENCE');assert.deepEqual([...c.unknownEvidenceIds],['ev-gone']);assert.deepEqual([...c.eligibleEvidenceIds],[]);
  assert.deepEqual(flagsOf(r,'lost').map(f=>[f.warningClass,f.severity,[...f.evidenceIds]]),[['PROVENANCE_GAP','BLOCKING',['ev-gone']]]);
  assert.equal(claimOf(r,'ok').truthState,'VERIFIED');
  assert.equal(rule(r,'SENTINEL.PROVENANCE_RESOLVABLE').outcome,'FAIL');assert.equal(rule(r,'SENTINEL.PROVENANCE_RESOLVABLE').blocking,true);
  assert.equal(r.signal,'RISK');assert.equal(r.status,'OBSERVED');
});

test('provenance loss: claim text that does not match its content hash fails the whole observation closed',()=>{
  const r=s.observe(input({claims:[claim('ok',{text:'A'}),claim('tampered',{text:'B',contentHash:h('1')})]}));
  assert.equal(r.status,'BLOCKED');assert.equal(r.reasonCode,'CLAIM_CONTENT_HASH_MISMATCH');assert.deepEqual(r.claims,[]);
  assert.match(r.provenance.inputDigest,/^[a-f0-9]{64}$/u);
});

test('provenance loss: a report edited after sealing no longer verifies',()=>{
  const r=s.observe(input({claims:[claim('c1',{evidenceIds:['ev-repo']})]}));
  const edited=JSON.parse(JSON.stringify(r));edited.claims[0].truthState='VERIFIED';edited.claims[0].evidenceIds=[];
  assert.equal(s.verifyReport(edited),false);
  const relabelled=JSON.parse(JSON.stringify(r));relabelled.signal='CLEAR';relabelled.flags=[];relabelled.ruleResults=[];
  assert.equal(s.verifyReport(relabelled),false);
  assert.equal(s.verifyReport(JSON.parse(JSON.stringify(r))),true);
});

test('every statement in the report points back to identifiers: claims to evidence ids, flags to claim or evidence pointers, rules to detail refs',()=>{
  const r=s.observe(input({evidenceSet:set([ITEMS.repo,ITEMS.foreign,ITEMS.stale,ITEMS.drift]),claims:[claim('a',{evidenceIds:['ev-repo']}),claim('b',{evidenceIds:['ev-nope']}),claim('c')]}));
  for(const f of r.flags){assert.match(f.pointerRef,/^(?:claim:[A-Za-z0-9._:-]+:|evidence:|locator:|evidence-set:)/u);assert.equal(f.checkerKind,'DETERMINISTIC');}
  for(const c of r.claims)for(const p of c.flagRefs)assert.ok(r.flags.some(f=>f.pointerRef===p),p);
  for(const x of r.ruleResults)if(x.outcome==='FAIL')assert.match(x.detailRef,/^(?:claims:|evidence:|locators:|evidence-set:)/u);
  assert.equal(r.evidence.setRef,'set-1');assert.equal(r.evidence.itemCount,4);
});

test('the evidence-id lists inside flags are capped at 64 while the report keeps the full lists',()=>{
  const items=Array.from({length:70},(_,i)=>({...ITEMS.stale,evidenceId:`ev-stale-${i}`,locatorRef:`db:row:${i}`}));
  const r=s.observe(input({evidenceSet:set(items)}));
  assert.equal(r.evidence.staleEvidenceIds.length,70);
  const f=r.flags.find(x=>x.warningClass==='STALE_AUTHORITATIVE_STATE');assert.equal(f.evidenceIds.length,64);assert.equal(f.pointerRef,'evidence:stale:count=70:maxAgeMs=10000');
});
