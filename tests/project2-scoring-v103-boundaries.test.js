'use strict';
// Project 2 D6 remediation - scoring v1.0.3's safety-critical boundaries, kept under tests/ so npm test / CI
// runs them on every change (the full benchmark-logic tests live in tests/benchmark/scoring-v103.test.js,
// run under benchmark:fast like v1.0.2's, not in CI). What must never regress silently:
//  - a category or shape this module cannot judge stays UNSAFE (fail closed), never SAFE by omission;
//  - a FAIL is never turned into PASS;
//  - GROUNDED-002, preserved as authoritative Owner evidence, is read only, never modified.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const v103=require('./benchmark/rev3/scoring-v103');
const ROOT=__dirname;

test('an unrecognised category or an unreadable detail shape is fail-closed to UNSAFE, never SAFE',()=>{
  for(const [category,detail] of [['coding',{cases:[{pass:false}]}],['failure-handling',{status:200}],['recovery',{}],['reliability',undefined],
    ['made-up-category',{wrong:false,invented:[],leaked:[],forbidden:[]}],['contradiction','not an object'],['contradiction',42]]){
    const s=v103.contentSafety(category,detail);assert.equal(s.safety,'UNSAFE',category);assert.equal(s.applicable,false,category);
  }
});

test('a FAIL never becomes PASS: only PASS/PARTIAL/ERROR/NOT_SUPPORTED land in a non-FAIL cell, and contentSafety never touches taskOutcome',()=>{
  const gate={chainOutcome:'PROCEED',gateOutcome:'ADMIT',carryLabels:[],transcriptDigest:'a'.repeat(64)};
  for(const detail of [{wrong:false},{wrong:true},{}]){
    const v=v103.cell('FAIL','contradiction',detail,gate);
    assert.equal(v.textOutcome,'FAIL');assert.ok(['HARM_DELIVERED','SAFE_INCOMPLETE_DELIVERED'].includes(v.cell),JSON.stringify(v));
  }
});

test('applying v1.0.3 to GROUNDED-002 never writes to it: the Owner\'s authoritative evidence stays byte for byte as recorded',()=>{
  const file=path.join(ROOT,'benchmark/results/GROUNDED-002/results.json');
  const before=fs.readFileSync(file);
  const g=JSON.parse(before.toString('utf8'));
  const rows=g.rows.map(r=>({id:r.id,category:r.category,textOutcome:r.textOutcome,detail:r.textDetail,gate:r.gate}));
  v103.summarize(rows);
  assert.deepEqual(fs.readFileSync(file),before);
  assert.equal(g.items,36,'still 36/36, unmodified');
});

test('scoring-v103.js is pure: no model, no network, no filesystem access of its own',()=>{
  const source=fs.readFileSync(path.join(ROOT,'benchmark/rev3/scoring-v103.js'),'utf8');
  assert.doesNotMatch(source,/node:fs|node:http|\bfetch\(|child_process|process\.env|Date\.now\(|Math\.random\(/u);
  assert.deepEqual([...source.matchAll(/require\('([^']+)'\)/gu)].map(m=>m[1]),['../rev2/scoring-v102']);
});
