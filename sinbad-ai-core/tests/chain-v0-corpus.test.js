'use strict';
// Cross-check: the drafts of the accepted components' own fixture corpora, rehearsed through the
// whole chain. This is a fixture measurement on paper, not a measurement of any live system.
const test=require('node:test');const assert=require('node:assert/strict');
const k=require('../chain/chain-v0.js');
const copilotFixture=require('./fixtures/copilot-v0/cases.json');
const gatekeeperFixture=require('./fixtures/gatekeeper-v0/cases.json');
const chainFixture=require('./fixtures/chain-v0/cases.json');
const POLICY={maxEvidenceAgeMs:10_000,volatileMaxEvidenceAgeMs:1_000,maxIterations:3,labelledDelivery:'PROCEED'};
const rehearse=(name,at,context,evidenceSet,draft)=>k.rehearse({version:k.INPUT_VERSION,chainId:`corpus.${name}`.slice(0,96),at,context,passes:[{evidenceSet,draft}],policy:POLICY,priorTranscriptDigest:null});

test('Co-Pilot v0 corpus through the chain: no adversarial draft proceeds, no benign draft is stopped or escalated, and the chain reproduces the fixture review',()=>{
  assert.equal(copilotFixture.cases.length,20);
  for(const c of copilotFixture.cases){
    const t=rehearse(c.name,c.input.issuedAt,c.input.context,c.input.evidenceSet,c.input.draft);
    assert.equal(k.verifyTranscript(t),true,c.name);assert.equal(t.passesRun,1,c.name);
    if(c.expectedClass==='ADVERSARIAL')assert.notEqual(t.outcome,'PROCEED',c.name);else assert.equal(t.outcome,'PROCEED',c.name);
    // Same draft, same evidence, same time: the chain's review carries the same verdict content as the component's own fixture.
    const mine=t.steps[0].records.review,theirs=c.expected;
    assert.equal(mine.status,theirs.status,c.name);assert.deepEqual(mine.verdict&&{warnings:mine.verdict.warnings,recommendation:mine.verdict.recommendation},theirs.verdict&&{warnings:theirs.verdict.warnings,recommendation:theirs.verdict.recommendation},c.name);
  }
});

test('Gatekeeper v0 corpus through the chain: every draft the gate fixture blocks by its own rules is also not proceeded with',()=>{
  assert.equal(gatekeeperFixture.cases.length,20);let checked=0;
  for(const c of gatekeeperFixture.cases){
    const t=rehearse(c.name,c.input.observedAt,c.input.context,c.input.evidenceSet,c.input.draft);
    assert.equal(k.verifyTranscript(t),true,c.name);
    // Cases that depend on a verdict supplied by the fixture (missing, foreign or blocking verdict) are out of scope here: the chain computes its own verdict.
    const ruleBlocked=c.expected.outcome==='BLOCK'&&c.expected.decision.attribution.deterministicRuleIds.filter(r=>r!=='GATE.VERDICT_MATCHES_DRAFT').length>0;
    if(ruleBlocked){checked+=1;assert.notEqual(t.outcome,'PROCEED',c.name);assert.equal(t.steps[0].gate.outcome,'BLOCK',c.name);}
    if(c.expectedClass==='BENIGN')assert.ok(['PROCEED','AWAITING_DRAFT'].includes(t.outcome),`${c.name}: ${t.outcome}`);
  }
  assert.ok(checked>=7,`rule-blocked cases checked: ${checked}`);
});

test('chain fixtures: identity, exact replay, and zero false proceeding or false stopping on the corpus',()=>{
  assert.equal(chainFixture.fixture,'sinbad-offline-chain-v0-fixtures/0-v1');assert.equal(chainFixture.chainVersion,k.VERSION);assert.equal(chainFixture.cases.length,14);assert.equal(new Set(chainFixture.cases.map(c=>c.name)).size,14);
  for(const c of chainFixture.cases){
    const t=JSON.parse(JSON.stringify(k.rehearse(c.input)));
    assert.equal(t.transcriptDigest,c.expected.transcriptDigest,c.name);assert.equal(t.outcome,c.expectedOutcome,c.name);assert.deepEqual(t.steps.map(s=>`${s.gate.outcome}>${s.pilot.decision}`),c.expected.trail,c.name);
    assert.equal(t.reasonCode,c.expected.reasonCode,c.name);assert.equal(t.passesRun,c.expected.passesRun,c.name);assert.equal(k.verifyTranscript(t),true,c.name);
  }
  const benign=chainFixture.cases.filter(c=>c.expectedClass==='BENIGN'),adversarial=chainFixture.cases.filter(c=>c.expectedClass==='ADVERSARIAL');
  assert.equal(benign.length,6);assert.equal(adversarial.length,8);
  assert.deepEqual(adversarial.filter(c=>c.expectedOutcome==='PROCEED').map(c=>c.name),[]);assert.deepEqual(benign.filter(c=>c.expectedOutcome!=='PROCEED').map(c=>c.name),[]);
  assert.deepEqual([...new Set(chainFixture.cases.map(c=>c.expectedOutcome))].sort(),[...k.OUTCOMES].sort());
});
