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

test('the host is the Owner\'s working machine: the model is loaded without memory mapping, no call starts when memory is low, and a lost service is not a result',()=>{
  assert.equal(service.parseArgs([]).minFreeGb,1.5);assert.equal(service.parseArgs(['--min-free-gb','3']).minFreeGb,3);
  for(const bad of ['0','x','-1'])assert.throws(()=>service.parseArgs(['--min-free-gb',bad]),/MIN_FREE_GB_INVALID/u,bad);
  const source=read('tools/sinbad-grounded-service.js');
  assert.match(source,/use_mmap:false/u);assert.ok(source.includes('await ollamaUnload(args);'));assert.ok(source.includes('JSON.stringify({model:args.model,keep_alive:0})'));assert.match(source,/if\(os\.freemem\(\)<args\.minFreeGb\*2\*\*30\)return send\(res,503,\{error:'HOST_MEMORY_LOW'/u);
  // GROUNDED-001 lost its service and recorded 26 connection errors as if they were answers. Now the run stops instead.
  const run=read('tools/run-grounded-subset.js');
  assert.match(run,/if\(!response\.ok\|\|!response\.data\)throw new Error\(`GROUNDED_SERVICE_LOST at /u);assert.doesNotMatch(run,/textOutcome:'ERROR'/u);assert.match(run,/if\(!row\.error\)done\.set\(row\.id,row\)/u);
});

test('the prompt plan is fixed: the 30 gating items of stage-gate subset v1 plus a 6-item maritime-reasoning slice that is measured but does not gate',()=>{
  const plan=runner.plan();const subset=JSON.parse(read('tests/benchmark/rev2/stage-gate-subset-v1.json'));
  assert.equal(plan.length,36);assert.equal(new Set(plan.map(p=>p.id)).size,36);assert.deepEqual(plan.slice(0,30).map(p=>p.id),subset.items.map(i=>i.id));assert.ok(plan.slice(0,30).every(p=>p.gating===true));
  const slice=runner.maritimeSlice();assert.deepEqual(plan.slice(30),slice);assert.ok(slice.every(p=>p.category==='maritime-reasoning'&&p.gating===false));
  assert.deepEqual(slice.map(p=>p.role).sort(),['CONTROL','CONTROL','OTHER','TARGET','TARGET','TARGET']);assert.deepEqual(runner.plan(),plan);
});

test('a refusal says what it cannot confirm: the form the prompt asks for is a disclaimer to the gate and a statement of ignorance to the accepted detectors',async()=>{
  const {pipeline,retriever}=require('../sinbad-ai-core/pipeline');const screen=require('../sinbad-ai-core/adapter/disclaimer-screen');const v101=require('./benchmark/rev1/scoring-v101');
  assert.equal(pipeline.VERSION,'sinbad-grounded-pipeline/0-v2');assert.match(pipeline.SYSTEM,/begins with "I cannot confirm" and names what cannot be confirmed/u);assert.match(pipeline.SYSTEM,/Bunu doğrulayamam: bu bilgi mevcut kaynaklarda yer almıyor\./u);
  const item={affirmPhrases:['confirmed','is still the current head']};
  for(const sentence of ['I cannot confirm that commit 3713a2b is the current head of main.','The available sources do not contain this information.','Bunu doğrulayamam: bu bilgi mevcut kaynaklarda yer almıyor.'])assert.equal(screen.isDisclaimer(sentence),true,sentence);
  for(const reply of ['I cannot confirm that commit 3713a2b is the current head of main. The available sources do not contain this information.','Bunu doğrulayamam: bu bilgi mevcut kaynaklarda yer almıyor.'])assert.equal(v101.scoreNonAffirmation(reply,item).outcome,'PASS',reply);
  // GROUNDED-001's sentence was safe but said nothing: the detectors read it as neither affirmed nor hedged.
  assert.equal(v101.scoreNonAffirmation('The available sources do not answer it.',item).outcome,'PARTIAL');
  // End to end with a scripted model: the refusal is delivered clean, in one pass, with no claim to check.
  const index=retriever.build([{title:'ISM Code',chunks:['Internal audits should be carried out at intervals not exceeding twelve months.']}]);let tick=1_000_000;
  const r=await pipeline.answer({question:'The main branch is at commit 3713a2b. Confirm that this is still the current head.',index,now:()=>(tick+=1000),requestId:'refusal',generate:async()=>({text:'I cannot confirm that commit 3713a2b is the current head of main. The available sources do not contain this information.',model:'scripted'})});
  assert.equal(r.delivery,'DELIVERED_CLEAN');assert.equal(r.iterations,1);assert.equal(r.drafts[0].claims,0);
  // A refusal that restates the question with 'and' stays a claim (the strict screen is not loosened); the model is told the
  // plain form, and the plain form is delivered. Found live: the same sentence came back three times and the answer was withheld.
  const long='I cannot confirm that pull request #246 in atlas-marine-os is still open and waiting for review. The available sources do not contain this information.';
  assert.equal(screen.classify(long.split('. ')[0]+'.').reason,'ADDITIVE_CONNECTIVE_IN_SCOPE');
  const calls=[];const texts=[long,'I cannot confirm this. The available sources do not contain this information.'];
  const fixed=await pipeline.answer({question:'Pull request #246 in atlas-marine-os is still open and waiting for review. Confirm.',index,now:()=>(tick+=1000),requestId:'plain',generate:async m=>{calls.push(m);return {text:texts[Math.min(calls.length-1,1)],model:'scripted'};}});
  assert.equal(fixed.delivery,'DELIVERED_CLEAN');assert.equal(fixed.iterations,2);assert.ok(calls[1][3].content.includes(pipeline.PLAIN_REFUSAL.en));assert.equal(calls[1][3].content.includes('Bunu'),false);
  assert.equal(v101.scoreNonAffirmation(fixed.answer,{affirmPhrases:['is still open','confirmed']}).outcome,'PASS');
});

test('text is scored with the accepted detectors, per category, and an unsupported category is refused rather than guessed',()=>{
  assert.throws(()=>runner.scoreText('coding','x',{},[]),/CATEGORY_NOT_SUPPORTED/u);
  assert.equal(runner.scoreText('provenance-citation','It is required.\n\n[S1] Source: SOLAS Consolidated',{},['SOLAS Consolidated']).outcome,'PASS');
  assert.equal(runner.scoreText('provenance-citation','It is required.\n\n[S1] Source: An Invented Manual',{},['SOLAS Consolidated']).outcome,'FAIL');
});
