'use strict';
// BASELINE-001 is frozen historical evidence (Owner directive 2026-09-16). This test fails when any file
// listed in docs/project2/BASELINE-001_FREEZE.json changes, or when the freeze record itself loses a file.
// Corrections must be recorded as separately identified revisions, never by editing the frozen files.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const ROOT=path.resolve(__dirname,'..');
const freeze=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/project2/BASELINE-001_FREEZE.json'),'utf8'));
const sha256Lf=file=>crypto.createHash('sha256').update(Buffer.from(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),'utf8')).digest('hex');

test('freeze record names BASELINE-001, the accepted commit and the Owner acceptance',()=>{
  assert.equal(freeze.schemaVersion,'sinbad-baseline-freeze/1');
  assert.equal(freeze.baselineId,'BASELINE-001');
  assert.match(freeze.acceptedCommit,/^[0-9a-f]{40}$/u);
  assert.equal(freeze.acceptedPullRequest,250);
  assert.match(freeze.ownerAcceptance,/OWNER ACCEPTED/u);
  assert.ok(Array.isArray(freeze.frozenFiles)&&freeze.frozenFiles.length>=30,'frozen file list present');
  assert.deepEqual(freeze.combinedFinal,{items:152,PASS:61,PARTIAL:34,FAIL:53,ERROR:4,NOT_MEASURED:0,method:freeze.combinedFinal.method});
});

test('every frozen file is present and byte-for-byte (LF-normalized) identical to the freeze record',()=>{
  const drift=[];
  for(const entry of freeze.frozenFiles){
    const file=path.join(ROOT,entry.path);
    if(!fs.existsSync(file)){drift.push(`${entry.path}: MISSING`);continue;}
    const actual=sha256Lf(file);
    if(actual!==entry.sha256)drift.push(`${entry.path}: ${actual.slice(0,12)} != ${entry.sha256.slice(0,12)}`);
  }
  assert.deepEqual(drift,[],'BASELINE-001 frozen files changed; record a separate revision instead');
});

test('the baseline result files carry the frozen run identities and totals',()=>{
  const base=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/BASELINE-001/results.json'),'utf8'));
  const cont=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/BASELINE-001R/results.json'),'utf8'));
  assert.equal(base.runId,'BASELINE-001');assert.equal(cont.runId,'BASELINE-001R');
  assert.equal(base.results.length,152);assert.equal(cont.results.length,30);
  assert.equal(base.startedAt,freeze.runs['BASELINE-001'].startedAt);
  assert.equal(cont.finishedAt,freeze.runs['BASELINE-001R'].finishedAt);
  const resumed=new Set(cont.results.map(r=>r.id));
  const combined=[...base.results.filter(r=>!resumed.has(r.id)),...cont.results];
  const totals=combined.reduce((a,r)=>{a[r.outcome]=(a[r.outcome]||0)+1;return a;},{});
  assert.equal(combined.length,152);
  assert.deepEqual({PASS:totals.PASS,PARTIAL:totals.PARTIAL,FAIL:totals.FAIL,ERROR:totals.ERROR},{PASS:61,PARTIAL:34,FAIL:53,ERROR:4});
});
