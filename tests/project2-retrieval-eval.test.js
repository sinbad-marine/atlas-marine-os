'use strict';
// Project 2 Phase 4.8 - the retrieval evaluation: its arithmetic on a synthetic index, the probe set's shape, and the
// boundaries of the tool. The Owner's library is private and not in the repository, so the recorded runs are not rebuilt here.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const tool=require('../tools/evaluate-retrieval');
const retriever=require('../sinbad-ai-core/pipeline/lexical-retriever');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

const DOCS=[
  {title:'ISM Code',chunks:['Internal audits should be carried out at intervals not exceeding twelve months.','The Company should designate a person ashore having direct access to the highest level of management.']},
  {title:'Flag notice on audits',chunks:['Audits audits audits: the flag administration reminds companies about audits and audit planning.','Audit reports are kept by the company.','Audit interval reminders are sent by the flag.']},
  {title:'Cookery',chunks:['Bread needs flour, water, salt and yeast.']}
];
const PROBES=[
  {id:'P1',split:'DEV',language:'en',topic:'ISM',question:'Who is the designated person ashore?',needle:'direct access to the highest level'},
  {id:'P2',split:'TEST',language:'en',topic:'ISM',question:'Reminders about audits from the flag',needle:'not exceeding twelve months'},
  {id:'P3',split:'DEV',language:'tr',topic:'X',question:'Ekmek nasıl yapılır?',needle:'this text is nowhere'}
];

test('a probe is a hit when a shown passage matches its needle; the first rank is read from the whole ranking, without the per-document cap',()=>{
  const index=retriever.build(DOCS);const result=tool.evaluate(index,PROBES,2);
  const [p1,p2,p3]=result.rows;
  assert.deepEqual([p1.hit,p1.firstRank,p1.hitMarker,p1.needleChunks,p1.strict],[true,1,'S1',1,true]);
  // P2: the chatty notice fills the two shown places; the passage that answers exists further down the ranking.
  assert.equal(p2.hit,false);assert.ok(p2.firstRank>2);assert.deepEqual(p2.shownTitles,['Flag notice on audits','Flag notice on audits']);
  assert.deepEqual([p3.hit,p3.firstRank,p3.needleChunks,p3.strict],[false,null,0,false]);assert.deepEqual(result.needleAbsent,['P3']);
  assert.deepEqual(result.overall,{probes:3,hit:1,hitRate:0.333,mrr:Number(((1+1/p2.firstRank)/3).toFixed(3)),notFoundWithinHorizon:1});
  assert.deepEqual([result.split.dev.hit,result.split.dev.probes,result.split.test.hit,result.split.test.probes],[1,2,0,1]);
  assert.deepEqual([result.language.en.probes,result.language.tr.probes,result.strict.all.probes],[2,1,2]);
  assert.equal(result.retriever,retriever.VERSION);
  // Titles and ranks only: no passage text leaves the evaluation.
  assert.equal(JSON.stringify(result).includes('twelve months'),false);
  assert.deepEqual(tool.evaluate(index,PROBES,2),result);
});

test('rank() is the ranking search() shows the top of: adding it changed no search result',()=>{
  const index=retriever.build(DOCS);const ranked=retriever.rank(index,'internal audits audit company flag');
  assert.ok(ranked.length>=4,String(ranked.length));for(let i=1;i<ranked.length;i+=1)assert.ok(ranked[i-1][1]>ranked[i][1]||(ranked[i-1][1]===ranked[i][1]&&ranked[i-1][0]<ranked[i][0]));
  const shown=retriever.search(index,'internal audits audit company flag',8);const perDocument=new Map();const expected=[];
  for(const [id] of ranked){const c=index.chunks[id];const used=perDocument.get(c.docIndex)||0;if(used>=retriever.MAX_PER_DOCUMENT)continue;perDocument.set(c.docIndex,used+1);expected.push(c.text);}
  assert.deepEqual(shown.map(s=>s.text),expected.slice(0,8));assert.equal(retriever.VERSION,'sinbad-lexical-retriever/0-v1');
});

test('the probe set is well formed: unique ids, a held-out TEST third, both languages, needles that compile and are not the question',()=>{
  const set=tool.loadProbes();assert.equal(set.probes.length,36);assert.equal(new Set(set.probes.map(p=>p.id)).size,36);
  assert.deepEqual([set.probes.filter(p=>p.split==='DEV').length,set.probes.filter(p=>p.split==='TEST').length],[24,12]);
  assert.deepEqual([set.probes.filter(p=>p.language==='en').length,set.probes.filter(p=>p.language==='tr').length],[28,8]);
  for(const p of set.probes){assert.doesNotThrow(()=>new RegExp(p.needle,'iu'),p.id);assert.ok(p.question.length>=20,p.id);}
});

test('the recorded runs say what they are: RETRIEVAL-001 is the merged retriever, RETRIEVAL-002 a rejected candidate',()=>{
  const first=JSON.parse(read('tests/benchmark/results/RETRIEVAL-001/results.json'));const second=JSON.parse(read('tests/benchmark/results/RETRIEVAL-002/results.json'));const note=JSON.parse(read('tests/benchmark/results/RETRIEVAL-002/NOTE.json'));
  assert.equal(first.retriever,'sinbad-lexical-retriever/0-v1');assert.deepEqual([first.overall.hit,first.overall.probes,first.strict.all.hit,first.strict.all.probes,first.split.test.hit,first.split.test.probes],[29,36,9,14,9,12]);
  assert.equal(second.retriever,'sinbad-lexical-retriever/0-v2');assert.deepEqual([second.overall.hit,second.strict.all.hit,second.split.dev.hit,second.split.test.hit,second.language.tr.hit],[30,10,21,9,6]);
  assert.equal(note.status,'REJECTED CANDIDATE - NOT MERGED');
  // The held-out set decided: no gain there, so the ranking change was not shipped.
  assert.equal(second.split.test.hit,first.split.test.hit);assert.ok(second.language.tr.hit<first.language.tr.hit);
  for(const run of [first,second]){assert.equal(run.library.documents,1686);assert.equal(JSON.stringify(run).includes('"text"'),false);}
});

test('the tool reads the library and writes only its own result directory; no model, no network',()=>{
  const source=read('tools/evaluate-retrieval.js');
  assert.doesNotMatch(source,/node:http|node:https|node:net|\bfetch\(|child_process|ollama|api\.openai|supabase/u);
  assert.deepEqual([...source.matchAll(/writeFileSync\(/gu)].length,1);assert.match(source,/writeFileSync\(path\.join\(outDir,name\)/u);assert.match(source,/const name=args\.label\?`results-\$\{args\.label\}\.json`:'results\.json';/u);
  assert.throws(()=>tool.parseArgs([]),/RUN_ID_REQUIRED/u);assert.throws(()=>tool.parseArgs(['--run-id','GROUNDED-001']),/RUN_ID_REQUIRED/u);
  assert.throws(()=>tool.parseArgs(['--run-id','RETRIEVAL-009','--passages','99']),/PASSAGES_INVALID/u);assert.equal(tool.parseArgs(['--run-id','RETRIEVAL-009']).passages,6);
});
