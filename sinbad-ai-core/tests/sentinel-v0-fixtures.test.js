'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fixture=require('./fixtures/sentinel-v0/cases.json');
const s=require('../sentinel/sentinel-v0.js');

test('fixture identity matches the module under test',()=>{
  assert.equal(fixture.fixture,'sinbad-sentinel-v0-fixtures/0-v1');assert.equal(fixture.sentinelVersion,s.VERSION);assert.equal(fixture.rulesetVersion,s.RULESET_VERSION);
  assert.equal(fixture.cases.length,8);assert.equal(new Set(fixture.cases.map(c=>c.name)).size,fixture.cases.length);
});

for(const c of fixture.cases){
  test(`fixture ${c.name}: ${c.description}`,()=>{
    const report=JSON.parse(JSON.stringify(s.observe(c.input)));
    assert.deepEqual(report,c.expected);
    assert.equal(s.verifyReport(c.expected),true);
    assert.equal(c.expected.authority,'NONE');assert.equal(c.expected.decides,false);
  });
}

test('the fixtures cover every status, signal, coverage level and truth state except NOT_APPLICABLE',()=>{
  const reports=fixture.cases.map(c=>c.expected);
  assert.deepEqual([...new Set(reports.map(r=>r.status))].sort(),['BLOCKED','OBSERVED']);
  assert.deepEqual([...new Set(reports.map(r=>r.signal))].sort(),['ATTENTION','BLOCKED','CLEAR','RISK']);
  assert.deepEqual([...new Set(reports.map(r=>r.coverage))].sort(),['FULL','NONE','PARTIAL']);
  const states=new Set(reports.flatMap(r=>r.claims.map(x=>x.truthState)));
  assert.deepEqual([...states].sort(),['BLOCKED','CONFLICT','NOT_VERIFIED','SOURCE_MISSING','VERIFIED']);
  const classes=new Set(reports.flatMap(r=>r.flags.map(f=>f.warningClass)));
  for(const w of ['CONTEXT_MISMATCH','SOURCE_EVIDENCE_MISMATCH','UNSUPPORTED_FACTUAL_ASSERTION','STALE_AUTHORITATIVE_STATE','CONTRADICTION_WITH_REPOSITORY_OR_RUNTIME_TRUTH','FALSE_CERTAINTY','PROVENANCE_GAP'])assert.ok(classes.has(w),w);
  const chained=fixture.cases.find(c=>c.name==='chained-delivery');const first=fixture.cases.find(c=>c.name==='clear-verified-claims');
  assert.equal(chained.expected.provenance.priorReportDigest,first.expected.reportDigest);
});
