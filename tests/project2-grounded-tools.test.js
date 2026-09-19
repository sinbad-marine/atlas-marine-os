'use strict';
// Project 2 Phase 4.6 / 4.7 - the two tools around the grounded pipeline keep their boundaries:
// loopback only, never the bridge's port, never the frozen harness. Under tests/, so CI runs it.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const service=require('../tools/sinbad-grounded-service');
const runner=require('../tools/run-grounded-subset');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('the service refuses the bridge port, privileged ports and any model endpoint that is not on the loopback interface',()=>{
  assert.equal(service.parseArgs([]).port,31990);assert.equal(service.parseArgs(['--port','32000']).port,32000);
  for(const bad of [['--port','31983'],['--port','80'],['--port','70000'],['--port','x'],['--ollama','http://10.0.0.5:11434'],['--ollama','https://api.example.com']])assert.throws(()=>service.parseArgs(bad),/PORT_INVALID|OLLAMA_MUST_BE_LOOPBACK/u,bad.join(' '));
  assert.equal(service.parseArgs(['--ollama','http://localhost:11434']).ollama,'http://localhost:11434');
  const source=read('tools/sinbad-grounded-service.js');
  assert.match(source,/server\.listen\(args\.port,HOST,/u);assert.match(source,/const HOST='127\.0\.0\.1'/u);
  // It reads the library index and nothing of the bridge; it writes no file at all.
  assert.doesNotMatch(source,/writeFileSync|appendFileSync|unlinkSync|child_process|sinbad-bridge|api\.openai|supabase/u);
});

test('the subset runner talks to a loopback service only, needs an explicit run id, and leaves the frozen harness alone',()=>{
  assert.throws(()=>runner.parseArgs([]),/RUN_ID_REQUIRED/u);assert.throws(()=>runner.parseArgs(['--run-id','x']),/RUN_ID_REQUIRED/u);
  assert.throws(()=>runner.parseArgs(['--run-id','GROUNDED-001','--base-url','http://example.com:31990']),/BASE_URL_MUST_BE_LOOPBACK/u);
  assert.equal(runner.parseArgs(['--run-id','GROUNDED-001']).baseUrl,'http://127.0.0.1:31990');
  const source=read('tools/run-grounded-subset.js');
  // It may name the frozen harness in a comment; it must not load it.
  assert.doesNotMatch(source,/require\([^)]*run-sinbad-benchmark|api\.openai|supabase|child_process/u);
  assert.doesNotMatch(source,/(?:writeFileSync|appendFileSync)\([^)]*(?:BASELINE-001|REV-1|REV-2|GATE-SIM|rev1|rev2|questions)/u);
});

test('the prompt plan is fixed: the 30 gating items of stage-gate subset v1 plus a 6-item maritime-reasoning slice that is measured but does not gate',()=>{
  const plan=runner.plan();const subset=JSON.parse(read('tests/benchmark/rev2/stage-gate-subset-v1.json'));
  assert.equal(plan.length,36);assert.equal(new Set(plan.map(p=>p.id)).size,36);assert.deepEqual(plan.slice(0,30).map(p=>p.id),subset.items.map(i=>i.id));assert.ok(plan.slice(0,30).every(p=>p.gating===true));
  const slice=runner.maritimeSlice();assert.deepEqual(plan.slice(30),slice);assert.ok(slice.every(p=>p.category==='maritime-reasoning'&&p.gating===false));
  assert.deepEqual(slice.map(p=>p.role).sort(),['CONTROL','CONTROL','OTHER','TARGET','TARGET','TARGET']);assert.deepEqual(runner.plan(),plan);
});

test('text is scored with the accepted detectors, per category, and an unsupported category is refused rather than guessed',()=>{
  assert.throws(()=>runner.scoreText('coding','x',{},[]),/CATEGORY_NOT_SUPPORTED/u);
  assert.equal(runner.scoreText('provenance-citation','It is required.\n\n[S1] Source: SOLAS Consolidated',{},['SOLAS Consolidated']).outcome,'PASS');
  assert.equal(runner.scoreText('provenance-citation','It is required.\n\n[S1] Source: An Invented Manual',{},['SOLAS Consolidated']).outcome,'FAIL');
});
