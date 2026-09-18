'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fixture=require('./fixtures/gatekeeper-v0/cases.json');
const g=require('../gatekeeper/gatekeeper-v0.js');

test('fixture identity matches the module under test',()=>{
  assert.equal(fixture.fixture,'sinbad-gatekeeper-v0-fixtures/0-v1');assert.equal(fixture.gatekeeperVersion,g.VERSION);assert.equal(fixture.rulesetVersion,g.RULESET_VERSION);assert.equal(fixture.sentinelVersion,'sinbad-sentinel/0-v1');
  assert.equal(fixture.cases.length,20);assert.equal(new Set(fixture.cases.map(c=>c.name)).size,20);
});

for(const c of fixture.cases){
  test(`fixture ${c.name} [${c.expectedClass}]: ${c.description}`,()=>{
    const decision=JSON.parse(JSON.stringify(g.decide(c.input)));
    assert.deepEqual(decision,c.expected);
    assert.equal(g.verifyDecision(c.expected),true);assert.equal(c.expected.authority,'NONE');assert.equal(c.expected.executes,false);
  });
}

test('false blocking and false allowing on the fixture corpus are both zero (fixture measurement, not a live measurement)',()=>{
  const benign=fixture.cases.filter(c=>c.expectedClass==='BENIGN'),adversarial=fixture.cases.filter(c=>c.expectedClass==='ADVERSARIAL');
  assert.equal(benign.length,8);assert.equal(adversarial.length,12);
  const falseBlocks=benign.filter(c=>c.expected.outcome==='BLOCK').map(c=>c.name);
  const falseAllows=adversarial.filter(c=>c.expected.outcome!=='BLOCK').map(c=>c.name);
  assert.deepEqual(falseBlocks,[]);assert.deepEqual(falseAllows,[]);
  assert.ok(benign.some(c=>c.expected.outcome==='ADMIT'));assert.ok(benign.some(c=>c.expected.outcome==='LABEL'));
  // Every adversarial block is attributable: either to named deterministic rules, or to the verdict, or to a fail-closed contract reason.
  for(const c of adversarial){
    const a=c.expected.decision.attribution;
    assert.ok(a.deterministicRuleIds.length>0||a.modelVerdictId!==null||['VERDICT_MISSING_FOR_PROTECTED_ACTION','REQUEST_INVALID'].includes(a.reasonCode)||c.expected.failClosed,c.name);
  }
});

test('the fixtures cover every outcome, every delivery label except NOT_VERIFIED-only edge, and both attribution kinds',()=>{
  const outcomes=new Set(fixture.cases.map(c=>c.expected.outcome));
  for(const o of ['ADMIT','LABEL','BLOCK'])assert.ok(outcomes.has(o),o);
  const labels=new Set(fixture.cases.map(c=>c.expected.deliveryLabel));
  for(const l of ['VERIFIED','NOT_VERIFIED','SOURCE_MISSING','BLOCKED','NOT_APPLICABLE'])assert.ok(labels.has(l),l);
  assert.ok(fixture.cases.some(c=>c.expected.decision.attribution.modelVerdictId!==null));
  assert.ok(fixture.cases.some(c=>c.expected.decision.attribution.deterministicRuleIds.length>0));
  const failedRules=new Set(fixture.cases.flatMap(c=>c.expected.ruleResults.filter(r=>r.outcome==='FAIL').map(r=>r.ruleId)));
  for(const r of ['GATE.CITATIONS_IN_EVIDENCE','GATE.SPECIFICITY_SUPPORTED','GATE.VOCABULARY_BOUND','GATE.FOREIGN_CLAIMS_EXCLUDED','GATE.VOLATILE_CLAIMS_LIVE','GATE.ACTIONS_AUTHORIZED','GATE.VERDICT_MATCHES_DRAFT','GATE.CLAIM_EVIDENCE_RESOLVABLE','GATE.CLAIMS_SUPPORTED','GATE.EVIDENCE_FRESH','GATE.PROVENANCE_ADEQUATE','GATE.INPUT_ADMITTED'])assert.ok(failedRules.has(r),r);
});
