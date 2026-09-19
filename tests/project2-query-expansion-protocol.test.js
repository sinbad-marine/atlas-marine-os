'use strict';
// Project 2 Phase 4.9 - the measurement PROTOCOL of the query-expansion experiment (Owner directive of 2026-09-19):
// DEV is for development, the old TEST split is a used holdout, the blind set is locked behind --final + a preregistration,
// baseline and candidate are compared probe by probe with regressions counted, and only one tool may call a model.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const evaluator=require('../tools/evaluate-retrieval');
const generator=require('../tools/generate-query-expansions');
const retriever=require('../sinbad-ai-core/pipeline/lexical-retriever');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('the blind set is locked: neither tool touches TEST-2 without --final and a preregistration, and --final is for nothing else',()=>{
  for(const tool of [evaluator,generator]){
    const base=tool===evaluator?['--run-id','RETRIEVAL-009']:['--out','x.json'];
    assert.throws(()=>tool.parseArgs([...base,'--split','TEST2']),/BLIND_SET_NEEDS_FINAL_AND_PREREGISTRATION/u);
    assert.throws(()=>tool.parseArgs([...base,'--split','TEST2','--final']),/BLIND_SET_NEEDS_FINAL_AND_PREREGISTRATION/u);
    assert.throws(()=>tool.parseArgs([...base,'--split','TEST2','--preregistration','p.json']),/BLIND_SET_NEEDS_FINAL_AND_PREREGISTRATION/u);
    assert.equal(tool.parseArgs([...base,'--split','TEST2','--final','--preregistration','p.json']).split,'TEST2');
  }
  assert.throws(()=>evaluator.parseArgs(['--run-id','RETRIEVAL-009','--split','DEV','--final']),/FINAL_IS_FOR_THE_BLIND_SET_ONLY/u);
  // The used holdout cannot be selected on its own: it is only ever reported inside ALL, as a historical figure.
  assert.throws(()=>evaluator.parseArgs(['--run-id','RETRIEVAL-009','--split','TEST']),/SPLIT_INVALID/u);assert.throws(()=>generator.parseArgs(['--out','x.json','--split','TEST']),/SPLIT_MUST_BE_DEV_OR_TEST2/u);
  assert.throws(()=>generator.parseArgs(['--out','x.json','--split','ALL']),/SPLIT_MUST_BE_DEV_OR_TEST2/u);
  // The default probe file of the evaluator is probes-v1; the blind file is opened only on the TEST2 path.
  const source=read('tools/evaluate-retrieval.js');assert.match(source,/loadProbes\(args\.split==='TEST2'\?PROBES_TEST2_PATH:PROBES_PATH\)/u);assert.equal([...source.matchAll(/PROBES_TEST2_PATH/gu)].length,2);
});

test('the probe sets say what they are: the old TEST split is a USED HOLDOUT, TEST-2 is blind, disjoint from v1 and well formed',()=>{
  const v1=JSON.parse(read('tests/benchmark/retrieval/probes-v1.json'));assert.match(v1.test_split_status,/^USED HOLDOUT \/ historical benchmark/u);assert.match(v1.test_split_status,/not used for tuning, for choosing between candidates or for any architecture decision/u);
  const t2=evaluator.loadProbes(path.join(ROOT,'tests/benchmark/retrieval/probes-test2-v1.json'));const raw=JSON.parse(read('tests/benchmark/retrieval/probes-test2-v1.json'));
  assert.equal(raw.set,'BLIND TEST-2');assert.match(raw.blind_rule,/COUNTING matching chunks only/u);assert.equal(t2.probes.length,36);assert.ok(t2.probes.every(p=>p.split==='TEST2'));
  assert.deepEqual([t2.probes.filter(p=>p.language==='en').length,t2.probes.filter(p=>p.language==='tr').length],[27,9]);
  const ids=new Set(v1.probes.map(p=>p.id)),questions=new Set(v1.probes.map(p=>p.question)),needles=new Set(v1.probes.map(p=>p.needle));
  for(const p of t2.probes){assert.equal(ids.has(p.id),false,p.id);assert.equal(questions.has(p.question),false,p.id);assert.equal(needles.has(p.needle),false,p.id);assert.match(p.id,/^T2-\d{2}$/u);}
});

const DOCS=[
  {title:'Notice A',chunks:['Audits audits how often audits on board carried out company reminders.','How often must audits be carried out: a reminder on board.']},
  {title:'Notice B',chunks:['How often internal safety audits: exam question on board.','Internal safety audits on board under the code: question bank.']},
  {title:'ISM Code',chunks:['The Company should verify whether activities comply, at intervals not exceeding twelve months.','The master has the overriding authority and the responsibility to make decisions.']}
];
const PROBES=[
  {id:'A',split:'DEV',language:'en',topic:'ISM',question:'How often must internal safety audits be carried out on board?',needle:'not exceeding twelve months'},
  {id:'B',split:'DEV',language:'en',topic:'ISM',question:'How often must audits be carried out on board, reminder?',needle:'a reminder on board'},
  {id:'C',split:'DEV',language:'tr',topic:'ISM',question:'Kaptanın yetkisi nedir ve kararları kim verir acaba?',needle:'overriding authority'}
];
test('baseline and candidate are compared probe by probe: gains, regressions, kept hits, language breakdown, MRR; an invalid expansion changes nothing',()=>{
  const index=retriever.build(DOCS);
  const expansions={A:{raw:'Q1: company should verify whether activities comply at intervals\nQ2: şirket faaliyetlerin uygunluğunu belirli aralıklarla doğrular'},
    B:{raw:'Q1: audits shall be carried out at intervals not exceeding two years\nQ2: denetimler iki yılda bir yapılır'},C:{raw:null,reason:'MODEL_ERROR'}};
  const r=evaluator.evaluate(index,PROBES,3,{expansions,keep:2,use:1});const c=r.candidate,k=c.comparison;
  assert.deepEqual(r.rows.map(x=>x.hit),[false,true,false]);assert.deepEqual(c.rows.map(x=>x.hit),[true,true,false]);
  assert.deepEqual([k.gained,k.lost,k.gains,k.regressions,k.net,k.baselineHits,k.baselineHitsKept,k.baselineHitsLost],[['A'],[],1,0,1,1,1,0]);
  assert.deepEqual([c.rows[0].expansionValid,c.rows[0].hitSource,c.rows[0].fromExpansion],[true,'expansion',1]);
  // B: the model invented "two years" -> discarded whole -> exactly the original result, original hit kept.
  assert.deepEqual([c.rows[1].expansionValid,c.rows[1].expansionReason,c.rows[1].fromExpansion,c.rows[1].hitSource],[false,'NUMBER_WORD_NOT_IN_QUESTION',0,'original']);assert.deepEqual(c.rows[1].shownTitles,r.rows[1].shownTitles);
  assert.deepEqual([c.rows[2].expansionValid,c.rows[2].expansionReason],[false,'MODEL_ERROR']);assert.deepEqual(c.rows[2].shownTitles,r.rows[2].shownTitles);
  assert.deepEqual(c.expansions,{valid:1,invalid:2,invalidReasons:{NUMBER_WORD_NOT_IN_QUESTION:1,MODEL_ERROR:1}});
  assert.deepEqual([k.delta.overallHit,k.delta.enHit,k.delta.trHit,k.delta.rankImproved,k.delta.rankWorsened],[1,1,0,1,0]);assert.ok(c.overall.mrr>r.overall.mrr);
  assert.deepEqual(c.fusion,{method:'SLOTS',keep:2,use:1});
  // keep = passages: a pure measurement of the baseline, identical rows.
  const same=evaluator.evaluate(index,PROBES,3,{expansions,keep:3,use:1});assert.deepEqual(same.candidate.rows.map(x=>x.shownTitles),same.rows.map(x=>x.shownTitles));assert.equal(same.candidate.comparison.net,0);
  // Without a candidate the result has the shape Phase 4.8 recorded.
  assert.equal(evaluator.evaluate(index,PROBES,3).candidate,undefined);assert.equal(JSON.stringify(r).includes('twelve months'),false);
});

test('the verdict follows from the preregistered criteria and the recorded final run: NOT ACCEPTED, nothing wired, the blind set is used',()=>{
  const p=JSON.parse(read('tests/benchmark/results/RETRIEVAL-003/PREREGISTRATION.json'));const v=JSON.parse(read('tests/benchmark/results/RETRIEVAL-003/VERDICT.json'));const r=JSON.parse(read('tests/benchmark/results/RETRIEVAL-003/results-final-test2.json'));
  assert.deepEqual([r.probeSet,r.probeSplit,r.final,r.passages,r.candidate.fusion],['BLIND TEST-2','TEST2',true,p.candidate.fusion.passages,{method:'SLOTS',keep:p.candidate.fusion.keep,use:p.candidate.fusion.use}]);
  assert.equal(r.preregistration,'tests/benchmark/results/RETRIEVAL-003/PREREGISTRATION.json');assert.equal(r.retriever,p.candidate.retriever);assert.equal(r.rows.length,36);assert.ok(r.rows.every(x=>x.split==='TEST2'));
  const c=r.candidate,k=c.comparison;
  // The criteria, recomputed here from the recorded run - not copied from the verdict file.
  const met={A:c.strict.all.hit-r.strict.all.hit>=3,B:k.gains-k.regressions>=4,C:k.regressions<=1,D:c.overall.mrr>r.overall.mrr,E:c.language.en.hit>=r.language.en.hit&&c.language.tr.hit>=r.language.tr.hit,F:c.expansions.valid/36>=0.6};
  assert.deepEqual(met,{A:false,B:false,C:true,D:true,E:true,F:true});assert.deepEqual(Object.fromEntries(v.criteria.map(x=>[x.id,x.met])),met);
  assert.equal(r.strict.all.hit<23,true);assert.equal(v.verdict,'NOT ACCEPTED');assert.equal(Object.values(met).every(Boolean),false);
  assert.deepEqual([r.overall.hit,c.overall.hit,r.strict.all.hit,c.strict.all.hit,r.strict.all.probes,k.gained,k.lost,k.baselineHitsKept],[22,24,12,14,25,['T2-03','T2-05','T2-08'],['T2-19'],21]);
  assert.deepEqual([v.measured.baseline.hit,v.measured.candidate.hit,v.measured.baseline.strictHit,v.measured.candidate.strictHit,v.measured.gains,v.measured.regressions],[22,24,12,14,k.gained,k.lost]);
  assert.match(JSON.parse(read('tests/benchmark/retrieval/probes-test2-v1.json')).status,/^USED HOLDOUT since 2026-09-19/u);
  // NOT ACCEPTED means not wired: no file of the pipeline, the service or the runner knows the module.
  for(const file of ['sinbad-ai-core/pipeline/grounded-pipeline.js','sinbad-ai-core/pipeline/index.js','tools/sinbad-grounded-service.js','tools/run-grounded-subset.js'])assert.equal(read(file).includes('query-expansion'),false,file);
  for(const run of [r,JSON.parse(read('tests/benchmark/results/RETRIEVAL-003/results-dev-qwen3-14b-keep4-use1.json'))])assert.equal(JSON.stringify(run).includes('"text"'),false);
});

test('only one tool may call a model, and only a local one; it guards the host and never lowers its memory floor',()=>{
  const gen=read('tools/generate-query-expansions.js');const ev=read('tools/evaluate-retrieval.js');
  assert.doesNotMatch(ev,/node:http|node:https|node:net|\bfetch\(|child_process|api\.openai|supabase/u);
  assert.doesNotMatch(gen,/node:https|\bfetch\(|child_process|api\.openai|supabase|lexical-retriever|\.rank\(|\.search\(/u);
  assert.throws(()=>generator.parseArgs(['--split','DEV','--out','x.json','--ollama','http://10.0.0.5:11434']),/OLLAMA_MUST_BE_LOOPBACK/u);assert.throws(()=>generator.parseArgs(['--split','DEV']),/OUT_REQUIRED/u);
  assert.throws(()=>generator.parseArgs(['--split','DEV','--out','x.json','--predict','9']),/PREDICT_INVALID/u);
  assert.deepEqual([generator.START_FLOOR_GB,generator.RUN_FLOOR_GB],[6,2.5]);assert.match(gen,/Math\.max\(START_FLOOR_GB,/u);
  // It unloads the model it used and no other; it never sends keep_alive 0 for a different model name.
  assert.equal([...gen.matchAll(/keep_alive:0/gu)].length,1);assert.match(gen,/\{model:args\.model,keep_alive:0\}/u);
});

test('the final run was preregistered: frozen configuration, acceptance criteria and consequences exist in writing',()=>{
  const p=JSON.parse(read('tests/benchmark/results/RETRIEVAL-003/PREREGISTRATION.json'));
  assert.deepEqual(p.candidate.fusion,{method:'SLOTS',passages:6,keep:4,use:1});assert.equal(p.candidate.retriever,'sinbad-lexical-retriever/0-v1');assert.match(p.candidate.promptSha256,/^[0-9a-f]{64}$/u);
  assert.equal(p.acceptance.criteria.length,6);assert.match(p.acceptance.criteria[2],/regressions <= 1/u);assert.match(p.acceptance.inconclusive,/INCONCLUSIVE \(CEILING\)/u);
  assert.match(p.deviationFromTheDirective,/qwen3:4b is a thinking-only variant/u);assert.match(p.consequences['NOT ACCEPTED or INCONCLUSIVE'],/embedding \/ semantic re-ranker option is brought to the Owner/u);
  const dev=JSON.parse(read('tests/benchmark/results/RETRIEVAL-003/results-dev-qwen3-14b-keep4-use1.json'));assert.equal(dev.probeSplit,'DEV');assert.ok(dev.rows.every(r=>r.split==='DEV'));assert.equal(dev.split.test.probes,0);assert.equal(dev.split.test2.probes,0);
  // The frozen prompt is the prompt in the repository.
  const crypto=require('node:crypto');assert.equal(crypto.createHash('sha256').update(require('../sinbad-ai-core/pipeline/query-expansion').SYSTEM).digest('hex'),p.candidate.promptSha256);
});
