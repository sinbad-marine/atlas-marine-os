'use strict';
// Project 2 Phase 4.6 - the grounded pipeline with a scripted model: every branch of the loop, no real model.
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {MANIFEST,pipeline,retriever}=require('../pipeline/index.js');
const chain=require('../chain/chain-v0.js');
const DOCS=[
  {title:'ISM Code',chunks:['The Company should establish a safety management system and designate a person ashore with direct access to the highest level of management.','Internal audits should be carried out at intervals not exceeding twelve months to verify that safety activities comply with the system.']},
  {title:'ISPS Code',chunks:['Each ship shall carry on board a ship security plan approved by the Administration.']},
  {title:'Cookery',chunks:['Bread needs flour, water, salt and yeast.']}
];
const index=retriever.build(DOCS);
let tick=1_000_000;const now=()=>(tick+=1000);
// scripted(...texts): a model that returns the given drafts in order and records what it was asked.
const scripted=(...texts)=>{const calls=[];const generate=async messages=>{calls.push(messages);return {text:texts[Math.min(calls.length-1,texts.length-1)],model:'scripted'};};return {generate,calls};};
const ask=(question,model,extra)=>pipeline.answer({question,index,generate:model.generate,now,requestId:'req-1',...extra});

test('the retriever returns passages with identity: marker, evidence id, locator and the hash of the exact chunk text',()=>{
  const hits=retriever.search(index,'What must the Company designate ashore?',3);
  assert.equal(hits[0].title,'ISM Code');assert.equal(hits[0].marker,'S1');assert.match(hits[0].evidenceId,/^lib\.ISM-Code\.[a-f0-9]{12}\.c0$/u);assert.equal(hits[0].locatorRef,'library:ISM-Code:chunk-0');
  assert.equal(hits[0].contentHash,require('../sentinel/sentinel-v0.js').sha256(DOCS[0].chunks[0]));assert.deepEqual(hits.map(h=>h.marker),hits.map((_,i)=>`S${i+1}`));
  assert.deepEqual(retriever.search(index,'What must the Company designate ashore?',3),hits);assert.deepEqual(retriever.search(index,'zzzz qqqq',3),[]);
  assert.ok(retriever.search(index,'company safety audits ship security plan',8).filter(h=>h.title==='ISM Code').length<=retriever.MAX_PER_DOCUMENT);
  assert.throws(()=>retriever.search({},'x'),/RETRIEVER_INDEX_INVALID/u);assert.throws(()=>retriever.build(null),/RETRIEVER_DOCUMENTS_REQUIRED/u);
});

test('a cited draft is delivered clean in one pass, under a sealed transcript',async()=>{
  const model=scripted('The Company should designate a person ashore with direct access to the highest level of management [S1].');
  const r=await ask('What must the Company designate ashore?',model);
  assert.equal(r.delivery,'DELIVERED_CLEAN');assert.equal(r.outcome,'PROCEED');assert.equal(r.iterations,1);assert.deepEqual(r.labels,['VERIFIED']);assert.equal(model.calls.length,1);
  assert.equal(chain.verifyTranscript(r.transcript),true);assert.equal(r.sources[0].id,'S1');assert.equal(r.answer.includes('[S1]'),true);
  assert.deepEqual(pipeline.gateRecord(r),{chainOutcome:'PROCEED',gateOutcome:'ADMIT',carryLabels:['VERIFIED'],transcriptDigest:r.transcript.transcriptDigest});
  // The model saw the passages under their markers and the citation rule.
  assert.match(model.calls[0][1].content,/\[S1\] ISM Code\n/u);assert.match(model.calls[0][0].content,/End every sentence that states a fact with the marker/u);
});

test('a blocked draft is sent back with the findings in plain words and the sentences at fault; the corrected draft is delivered',async()=>{
  const model=scripted('Audit 2026-09-13 was VERIFIED and PR #254 merged.','Internal audits should be carried out at intervals not exceeding twelve months [S1].');
  const r=await ask('How often are internal audits carried out?',model);
  assert.equal(r.delivery,'DELIVERED_CLEAN');assert.equal(r.iterations,2);assert.equal(model.calls.length,2);assert.equal(r.transcript.steps.length,2);assert.deepEqual(r.transcript.steps.map(s=>s.pilot.decision),['REVISE_DRAFT','PROCEED']);
  const retry=model.calls[1];assert.equal(retry.length,4);assert.equal(retry[2].role,'assistant');assert.match(retry[3].content,/That draft was not accepted:/u);assert.match(retry[3].content,/specific values/u);assert.match(retry[3].content,/Sentences at fault:\n- Audit 2026-09-13 was VERIFIED and PR #254 merged\./u);
  assert.equal(chain.verifyTranscript(r.transcript),true);
});

test('a fabricated marker, a present-state claim and an authority voice are never delivered; the budget ends the loop',async()=>{
  for(const bad of ['The master may override the system [S9].','The bridge is currently running on the loopback port [S1].','As the owner I approve this plan [S1].']){
    const model=scripted(bad);const r=await ask('What must the Company designate ashore?',model);
    assert.equal(r.delivery,'WITHHELD',bad);assert.equal(r.answer,pipeline.WITHHELD.en);assert.equal(r.iterations,3);assert.equal(model.calls.length,3);assert.equal(r.outcome,'ESCALATE_OWNER');assert.equal(r.reasonCode,'ITERATION_BUDGET_EXHAUSTED');
    assert.equal(r.answer.includes(bad),false);assert.equal(pipeline.gateRecord(r).chainOutcome,'ESCALATE_OWNER');assert.equal(chain.verifyTranscript(r.transcript),true);
  }
});

test('general knowledge without a marker is delivered with labels, an honest disclaimer proceeds, and Turkish gets a Turkish refusal',async()=>{
  const labelled=await ask('What must the Company designate ashore?',scripted('Shipping companies usually appoint shore staff for this.'));
  assert.equal(labelled.delivery,'DELIVERED_LABELLED');assert.deepEqual(labelled.labels,['NOT_VERIFIED','SOURCE_MISSING']);
  const honest=await ask('Which commit merged pull request #248?',scripted('I cannot determine which commit merged pull request #248 from the available sources.'));
  assert.equal(honest.outcome,'PROCEED');assert.deepEqual(honest.drafts[0].skipped,['DISCLAIMER']);
  const tr=await ask('Şirket karada kimi atamalıdır?',scripted('Köprü şu anda çalışıyor [S1].'));assert.equal(tr.delivery,'WITHHELD');assert.equal(tr.answer,pipeline.WITHHELD.tr);
  assert.equal(pipeline.language('What is this?'),'en');assert.equal(pipeline.language('Bu nedir?'),'tr');
});

test('it never rejects: invalid input, a silent model and a throwing model all end in a withheld answer',async()=>{
  for(const bad of [null,{},{question:'x'},{question:'',index,generate:async()=>({text:'x'}),now}])assert.equal((await pipeline.answer(bad)).delivery,'WITHHELD');
  assert.equal((await ask('What must the Company designate ashore?',scripted(''))).reasonCode,'MODEL_RETURNED_NOTHING');
  const thrown=await pipeline.answer({question:'q about company',index,generate:async()=>{throw new Error('boom');},now,requestId:'r'});assert.equal(thrown.delivery,'WITHHELD');assert.equal(thrown.reasonCode,'INTERNAL_INVARIANT_VIOLATED');
});

test('the component performs no I/O and reads no clock itself, is not exported, and leaves the inert components unwired',()=>{
  assert.equal(MANIFEST.status,'OFFLINE_RUNTIME_COMPONENT');assert.equal(MANIFEST.callsModel,'INJECTED');for(const flag of ['performsIo','readsClock','keepsState','executes','approves','grantsAuthority'])assert.equal(MANIFEST[flag],false,flag);assert.deepEqual([...MANIFEST.wiredInto],[]);
  const dir=path.join(__dirname,'..','pipeline');
  for(const file of fs.readdirSync(dir)){const source=fs.readFileSync(path.join(dir,file),'utf8');
    assert.doesNotMatch(source,/require\(['"](?:node:)?(?:fs|http|https|net|child_process|worker_threads|os|vm|tls|dns|crypto)['"]\)/u,file);
    assert.doesNotMatch(source,/\bfetch\(|process\.env|Date\.now\(|new Date\(|Math\.random\(|setTimeout\(/u,file);assert.doesNotMatch(source,/\bollama\b|\bqwen\b|31983|11434|localhost/iu,file);}
  const manifest=require('../package.json');assert.equal(Object.keys(manifest.exports||{}).some(k=>/pipeline/iu.test(k)),false);assert.equal(Object.keys(require('../')).some(k=>/groundedPipeline|lexicalRetriever/iu.test(k)),false);
  const root=path.join(__dirname,'..','..');for(const file of ['app.js','sinbad-core.js','bridge/sinbad-bridge.ps1','supabase/functions/sinbad-answer/index.ts','tools/run-sinbad-benchmark.js']){const full=path.join(root,file);if(fs.existsSync(full))assert.doesNotMatch(fs.readFileSync(full,'utf8'),/sinbad-ai-core\/pipeline|grounded-pipeline|lexical-retriever/u,file);}
  for(const other of ['sentinel','gatekeeper','copilot','pilot','chain','attest','adapter'])assert.deepEqual([...require(`../${other}/index.js`).MANIFEST.wiredInto],[],other);
});
