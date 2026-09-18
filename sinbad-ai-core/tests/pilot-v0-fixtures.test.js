'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fixture=require('./fixtures/pilot-v0/cases.json');
const p=require('../pilot/pilot-v0.js');

test('fixture identity matches the module under test',()=>{
  assert.equal(fixture.fixture,'sinbad-pilot-v0-fixtures/0-v1');assert.equal(fixture.pilotVersion,p.VERSION);assert.equal(fixture.rulesetVersion,p.RULESET_VERSION);
  assert.equal(fixture.gatekeeperDecisionVersion,'sinbad-gatekeeper-decision/0-v1');assert.equal(fixture.copilotReviewVersion,'sinbad-copilot-review/0-v1');
  assert.equal(fixture.cases.length,24);assert.equal(new Set(fixture.cases.map(x=>x.name)).size,24);
});

for(const x of fixture.cases){
  test(`fixture ${x.name} [${x.expectedClass}] -> ${x.expectedDecision}: ${x.description}`,()=>{
    const decision=JSON.parse(JSON.stringify(p.decide(x.input)));
    assert.deepEqual(decision,x.expected);assert.equal(decision.decision,x.expectedDecision);
    assert.equal(p.verifyPilotDecision(x.expected),true);assert.equal(x.expected.authority,'NONE');assert.equal(x.expected.recommendationOnly,true);
    for(const flag of ['executes','approves','grantsAuthority','rewrites','callsModel'])assert.equal(x.expected[flag],false,flag);
  });
}

test('false proceeding and false stopping on the fixture corpus are both zero (fixture measurement, not a live measurement)',()=>{
  const benign=fixture.cases.filter(x=>x.expectedClass==='BENIGN'),adversarial=fixture.cases.filter(x=>x.expectedClass==='ADVERSARIAL');
  assert.equal(benign.length,8);assert.equal(adversarial.length,16);
  assert.deepEqual(adversarial.filter(x=>x.expected.decision==='PROCEED').map(x=>x.name),[]);
  assert.deepEqual(benign.filter(x=>['STOP','ESCALATE_OWNER'].includes(x.expected.decision)).map(x=>x.name),[]);
  // Every decision other than a clean PROCEED says why: a rule id, a reason code, and findings unless the input itself was refused.
  for(const x of fixture.cases){assert.ok(p.RULES.some(r=>r.ruleId===x.expected.ruleId),x.name);assert.ok(x.expected.reasonCode.length>0,x.name);if(['REVISE_DRAFT','REQUEST_EVIDENCE','ESCALATE_OWNER'].includes(x.expected.decision))assert.ok(x.expected.findings.length>0,x.name);}
});

test('the fixtures exercise every decision class, every Pilot rule and both finding sources',()=>{
  assert.deepEqual([...new Set(fixture.cases.map(x=>x.expected.decision))].sort(),[...p.DECISIONS].sort());
  const fired=new Set(fixture.cases.map(x=>x.expected.ruleId));for(const r of p.RULES)assert.ok(fired.has(r.ruleId),r.ruleId);
  const sources=new Set(fixture.cases.flatMap(x=>x.expected.findings.map(f=>f.source)));assert.deepEqual([...sources].sort(),['GATE_RULE','VERDICT_WARNING']);
  assert.ok(fixture.cases.some(x=>x.expected.decision==='PROCEED'&&x.expected.carryLabels.includes('NOT_VERIFIED')));
  assert.ok(fixture.cases.filter(x=>x.expected.decision!=='PROCEED').every(x=>x.expected.carryLabels.length===0));
});
