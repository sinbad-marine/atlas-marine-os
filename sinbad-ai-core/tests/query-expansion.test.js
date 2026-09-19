'use strict';
// Project 2 Phase 4.9 - query expansion: the small model is not an authority. What it writes only fetches passages, and
// anything that looks like a fact it made up throws the whole expansion away.
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const expansion=require('../pipeline/query-expansion.js');
const retriever=require('../pipeline/lexical-retriever.js');
const Q='How often must internal safety audits be carried out on board under the ISM Code?';

test('a well-formed expansion is accepted: two labelled lines, fragments of source wording, nothing the question did not contain',()=>{
  const v=expansion.check(Q,'Q1: internal safety audits shall be carried out at intervals\nQ2: iç güvenlik denetimleri belirli aralıklarla yapılır');
  assert.deepEqual(v,{version:expansion.VERSION,valid:true,queries:['internal safety audits shall be carried out at intervals','iç güvenlik denetimleri belirli aralıklarla yapılır'],reason:null});
  // A number or a reference that IS in the question may be repeated.
  assert.equal(expansion.check('What does security level 1 mean in the ISPS Code?','Q1: security level 1 means the level for which minimum measures\nQ2: güvenlik seviyesi 1 asgari tedbirlerin uygulandığı seviye').valid,true);
  assert.equal(expansion.check('What does rule 19 say about restricted visibility?','Q1: rule 19 conduct of vessels in restricted visibility shall\nQ2: kısıtlı görüşte gemilerin davranışı kural 19').valid,true);
});

test('a hallucinated fact discards the WHOLE expansion: numbers, number words, periods, regulation and section references',()=>{
  // Real outputs of the local model on the DEV probes (2026-09-19): each states a "fact" the question did not contain, and each is wrong.
  for(const [raw,reason] of [
    ['Q1: internal safety audits shall be carried out at intervals not exceeding two years\nQ2: iç güvenlik denetimleri iki yılda bir yapılmak zorundadır','NUMBER_WORD_NOT_IN_QUESTION'],
    ['Q1: internal safety audits shall be carried out at intervals not exceeding 12 months\nQ2: iç güvenlik denetimleri yapılır ve kayıt altına alınır','NUMBER_NOT_IN_QUESTION'],
    ['Q1: internal safety audits shall be carried out annually by the company\nQ2: iç güvenlik denetimleri şirket tarafından yapılır','NUMBER_WORD_NOT_IN_QUESTION'],
    ['Q1: internal audits shall be carried out in accordance with section 12 of the code\nQ2: iç güvenlik denetimleri şirket tarafından yapılır','NUMBER_NOT_IN_QUESTION'],
    ['Q1: internal audits shall be carried out in accordance with chapter IX of the convention\nQ2: iç güvenlik denetimleri şirket tarafından yapılır','REFERENCE_NOT_IN_QUESTION'],
    ['Q1: internal audits shall be carried out as required by part A of the code\nQ2: iç güvenlik denetimleri şirket tarafından yapılır','REFERENCE_NOT_IN_QUESTION'],
    ['Q1: iç denetimler kodun bölüm IV uyarınca yapılır ve kayıt altına alınır\nQ2: internal audits shall be carried out by the company','REFERENCE_NOT_IN_QUESTION']
  ]){const v=expansion.check(Q,raw);assert.deepEqual([v.valid,v.reason,v.queries],[false,reason,[]],raw);}
});

test('anything that is not exactly the required shape is discarded: reasoning text, a question, one line too many, duplicates, extremes of length',()=>{
  for(const [raw,reason] of [
    ['We are given a user question in English. Let me think about the ISM Code...','FORMAT_INVALID'],
    ['<think>the user asks about audits</think>','FORMAT_INVALID'],['<think>unfinished reasoning','FORMAT_INVALID'],['','FORMAT_INVALID'],[null,'FORMAT_INVALID'],
    ['Q1: internal safety audits shall be carried out\nQ2: iç denetimler yapılır ve kaydedilir\nQ3: one more line of text here','FORMAT_INVALID'],
    ['Q2: internal safety audits shall be carried out\nQ1: iç denetimler yapılır ve kaydedilir','FORMAT_INVALID'],
    ['Here are the queries:\nQ1: internal safety audits shall be carried out','FORMAT_INVALID'],
    ['Q1: How often are internal safety audits carried out?\nQ2: iç denetimler yapılır ve kaydedilir','QUERY_IS_A_QUESTION'],
    ['Q1: audits shall\nQ2: iç denetimler yapılır ve kaydedilir','LENGTH_INVALID'],
    [`Q1: ${'audits shall be carried out '.repeat(8)}\nQ2: iç denetimler yapılır ve kaydedilir`,'LENGTH_INVALID'],
    ['Q1: internal safety audits shall be carried out\nQ2: Internal Safety Audits shall be carried out','DUPLICATE_QUERY']
  ])assert.equal(expansion.check(Q,raw).reason,reason,String(raw).slice(0,50));
  assert.equal(expansion.check('','Q1: internal safety audits shall be carried out').reason,'QUESTION_REQUIRED');
  // Reasoning that Ollama left inside <think> tags is removed, never searched with.
  assert.deepEqual(expansion.check(Q,'<think>two years? no...</think>\nQ1: internal safety audits shall be carried out at intervals').queries,['internal safety audits shall be carried out at intervals']);
});

const DOCS=[
  {title:'Notice A',chunks:['Audits audits how often audits on board carried out company reminders.','How often must audits be carried out: a reminder on board.','Safety audits on board: how often the flag reminds.']},
  {title:'Notice B',chunks:['How often internal safety audits: exam question on board.','Internal safety audits on board under the code: question bank.']},
  {title:'ISM Code',chunks:['The Company should verify whether activities comply, at intervals not exceeding twelve months.']}
];
test('SLOTS fusion: the original result is kept untouched in front, the rewrite only fills the remaining places, and without a valid rewrite nothing changes',()=>{
  const index=retriever.build(DOCS);const original=retriever.search(index,Q,4).map(s=>s.text);
  const texts=r=>r.ids.map(id=>index.chunks[id].text);
  const none=expansion.fuse({index,question:Q,queries:[],passages:4,keep:2});assert.deepEqual(texts(none),original);assert.deepEqual(none.sources,['original','original','original','original']);assert.equal(none.fromExpansion,0);
  const fused=expansion.fuse({index,question:Q,queries:['company should verify whether activities comply at intervals'],passages:4,keep:2,use:1});
  assert.deepEqual(texts(fused).slice(0,2),original.slice(0,2));assert.equal(fused.sources[0],'original');assert.equal(fused.sources[1],'original');
  // The passage that answers was not in the original four; the rewrite brings it in, in a slot of its own.
  assert.equal(original.some(t=>/not exceeding twelve months/u.test(t)),false);const at=texts(fused).findIndex(t=>/not exceeding twelve months/u.test(t));assert.ok(at>=2);assert.equal(fused.sources[at],'expansion');
  assert.equal(new Set(fused.ids).size,fused.ids.length);assert.equal(fused.ids.length,4);
  // keep = passages means "measure only": identical to the original even with a rewrite.
  assert.deepEqual(texts(expansion.fuse({index,question:Q,queries:['company should verify whether activities comply'],passages:4,keep:4})),original);
  // use = 1 ignores the second query; a rewrite that finds nothing new gives the places back to the original ranking.
  const one=expansion.fuse({index,question:Q,queries:['company should verify','bread flour water'],passages:4,keep:2,use:1});const two=expansion.fuse({index,question:Q,queries:['company should verify','bread flour water'],passages:4,keep:2,use:2});assert.deepEqual(one.ids,two.ids);
  assert.deepEqual(texts(expansion.fuse({index,question:Q,queries:['zzzz qqqq xxxx'],passages:4,keep:2})),original);
  // The per-document cap of the retriever holds across both sources.
  for(const r of [fused,one]){const per=new Map();for(const id of r.ids){const d=index.chunks[id].docIndex;per.set(d,(per.get(d)||0)+1);}assert.ok([...per.values()].every(n=>n<=retriever.MAX_PER_DOCUMENT));}
  assert.deepEqual(expansion.fuse({index,question:Q,queries:['company should verify'],passages:4,keep:2}),expansion.fuse({index,question:Q,queries:['company should verify'],passages:4,keep:2}));
});

test('the module is pure and experimental: no I/O, no model call, not wired into the pipeline, and the prompt forbids what the check rejects',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','pipeline','query-expansion.js'),'utf8');
  assert.deepEqual([...source.matchAll(/require\('([^']+)'\)/gu)].map(m=>m[1]),['./lexical-retriever']);
  assert.doesNotMatch(source,/\bfetch\(|node:http|node:fs|process\.env|Date\.now\(|new Date\(|Math\.random\(/u);
  assert.match(expansion.SYSTEM,/^\/no_think\n/u);assert.match(expansion.SYSTEM,/do not answer the question/u);assert.match(expansion.SYSTEM,/Do not write any number, date, limit or period/u);assert.match(expansion.SYSTEM,/No question marks/u);
  assert.deepEqual(expansion.messages('  What is X?  ').map(m=>m.role),['system','user']);assert.equal(expansion.messages('  What is X?  ')[1].content,'What is X?');
  for(const file of ['grounded-pipeline.js','index.js','citation-support.js','lexical-retriever.js'])assert.equal(fs.readFileSync(path.join(__dirname,'..','pipeline',file),'utf8').includes('query-expansion'),false,file);
  assert.equal(Object.isFrozen(expansion),true);
});
