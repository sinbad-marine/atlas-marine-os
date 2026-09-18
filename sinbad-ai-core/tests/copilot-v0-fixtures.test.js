'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fixture=require('./fixtures/copilot-v0/cases.json');
const c=require('../copilot/copilot-v0.js');
const v=require('../authority/copilot-verdict.js');

test('fixture identity matches the module under test',()=>{
  assert.equal(fixture.fixture,'sinbad-copilot-v0-fixtures/0-v1');assert.equal(fixture.copilotVersion,c.VERSION);assert.equal(fixture.checkersetVersion,c.CHECKERSET_VERSION);assert.equal(fixture.sentinelVersion,'sinbad-sentinel/0-v1');
  assert.equal(fixture.cases.length,20);assert.equal(new Set(fixture.cases.map(x=>x.name)).size,20);
});

for(const x of fixture.cases){
  test(`fixture ${x.name} [${x.expectedClass}]: ${x.description}`,()=>{
    const review=JSON.parse(JSON.stringify(c.review(x.input)));
    assert.deepEqual(review,x.expected);
    assert.equal(c.verifyReview(x.expected),true);assert.equal(x.expected.authority,'NONE');assert.equal(x.expected.callsModel,false);
    if(x.expected.verdict!==null)assert.notEqual(v.snapshot(JSON.parse(JSON.stringify(x.expected.verdict))),null);
  });
}

test('false blocking and false allowing on the fixture corpus are both zero (fixture measurement, not a live measurement)',()=>{
  const benign=fixture.cases.filter(x=>x.expectedClass==='BENIGN'),adversarial=fixture.cases.filter(x=>x.expectedClass==='ADVERSARIAL');
  assert.equal(benign.length,8);assert.equal(adversarial.length,12);
  // A benign draft is never recommended BLOCK; an adversarial one is recommended BLOCK, or no verdict exists at all (which a gate treats as fail-closed for protected actions).
  assert.deepEqual(benign.filter(x=>x.expected.verdict===null||x.expected.verdict.recommendation==='BLOCK').map(x=>x.name),[]);
  assert.deepEqual(adversarial.filter(x=>x.expected.verdict!==null&&x.expected.verdict.recommendation!=='BLOCK').map(x=>x.name),[]);
  assert.ok(benign.some(x=>x.expected.verdict.recommendation==='ALLOW'));assert.ok(benign.some(x=>x.expected.verdict.recommendation==='LABEL'));
  // Every blocking recommendation points at what caused it.
  for(const x of adversarial.filter(y=>y.expected.verdict!==null))assert.ok(x.expected.verdict.warnings.some(w=>w.severity==='BLOCKING'&&w.pointerRef!==null),x.name);
});

test('the fixtures exercise every checker, every emitted warning class and both review statuses',()=>{
  const warnedCheckers=new Set(fixture.cases.flatMap(x=>x.expected.checkers.filter(k=>k.outcome==='WARNED').map(k=>k.checkerId)));
  for(const k of c.CHECKERS)assert.ok(warnedCheckers.has(k.checkerId),k.checkerId);
  const classes=new Set(fixture.cases.flatMap(x=>x.expected.verdict?x.expected.verdict.warnings.map(w=>w.warningClass):[]));
  for(const warningClass of ['CONTEXT_MISMATCH','SOURCE_EVIDENCE_MISMATCH','UNSUPPORTED_FACTUAL_ASSERTION','FALSE_CERTAINTY','PROVENANCE_GAP','ROLE_CONFUSION','UNINTENDED_TASK_EXPANSION','UNSAFE_ACTION_REQUEST'])assert.ok(classes.has(warningClass),warningClass);
  for(const notCovered of c.NOT_COVERED)assert.equal(classes.has(notCovered),false,notCovered);
  assert.deepEqual([...new Set(fixture.cases.map(x=>x.expected.status))].sort(),['BLOCKED','REVIEWED']);
  assert.ok(fixture.cases.some(x=>x.expected.verdict===null));
  assert.ok(fixture.cases.flatMap(x=>x.expected.verdict?x.expected.verdict.warnings:[]).every(w=>w.checkerKind==='DETERMINISTIC'));
});
