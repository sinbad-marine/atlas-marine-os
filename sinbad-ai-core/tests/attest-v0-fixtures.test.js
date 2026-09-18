'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fixture=require('./fixtures/attest-v0/cases.json');
const a=require('../attest/attest-v0.js');

test('fixture identity matches the module under test',()=>{
  assert.equal(fixture.fixture,'sinbad-attest-v0-fixtures/0-v1');assert.equal(fixture.attestVersion,a.VERSION);assert.equal(fixture.cases.length,16);assert.equal(new Set(fixture.cases.map(c=>c.name)).size,16);
});

for(const c of fixture.cases){
  test(`fixture ${c.name} [${c.expectedClass}] -> ${c.expectedStatus} ${c.expectedReason}: ${c.description}`,()=>{
    // The stored envelopes carry signatures made once; checking them again must give the identical sealed result.
    const check=JSON.parse(JSON.stringify(a.check(c.input)));
    assert.deepEqual(check,c.expected);assert.equal(check.status,c.expectedStatus);assert.equal(check.reasonCode,c.expectedReason);
    assert.equal(a.verifyCheck(c.expected),true);assert.equal(c.expected.authority,'NONE');assert.equal(c.expected.originOnly,true);assert.equal(c.expected.grantsAuthority,false);
  });
}

test('false acceptance and false rejection on the fixture corpus are both zero (fixture measurement, not a live measurement)',()=>{
  const genuine=fixture.cases.filter(c=>c.expectedClass==='GENUINE'),forged=fixture.cases.filter(c=>c.expectedClass==='FORGED');
  assert.equal(genuine.length,6);assert.equal(forged.length,10);
  assert.deepEqual(forged.filter(c=>c.expected.authentic).map(c=>c.name),[]);assert.deepEqual(genuine.filter(c=>!c.expected.authentic).map(c=>c.name),[]);
  assert.deepEqual([...new Set(genuine.map(c=>c.expected.recordKind))].sort(),[...a.KIND_NAMES].sort());
  assert.ok(new Set(forged.map(c=>c.expected.reasonCode)).size>=8);
});
