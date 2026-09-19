'use strict';
// Project 2 Phase 4.10 part 2 - the bounded regulatory-core experiment: the full build stays on hold, the corpus is defined by
// title and size rules only and pinned by hashes, throughput is reported truthfully, the four systems are compared on the same
// universe with gains and regressions by probe, every vector keeps its source, and nothing reads a blind set or is wired.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const builder=require('../tools/build-semantic-index');
const definer=require('../tools/define-regulatory-core-corpus');
const embedder=require('../tools/embed-retrieval-queries');
const evaluator=require('../tools/evaluate-semantic-retrieval');
const retriever=require('../sinbad-ai-core/pipeline/lexical-retriever');
const ROOT=path.resolve(__dirname,'..');const OUT=path.join(os.tmpdir(),'sinbad-semantic-experiment-test');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');const sha256=t=>crypto.createHash('sha256').update(t).digest('hex');

test('the full library build is on hold: without --limit or --corpus the builder refuses unless the Owner GO is stated on the command line',()=>{
  assert.throws(()=>builder.parseArgs(['--out-dir',OUT]),/FULL_BUILD_IS_ON_HOLD/u);
  assert.equal(builder.parseArgs(['--out-dir',OUT,'--full-build-owner-go']).fullBuildOwnerGo,true);
  assert.equal(builder.parseArgs(['--out-dir',OUT,'--corpus','c.json']).corpus,'c.json');assert.equal(builder.parseArgs(['--out-dir',OUT,'--limit','8']).limit,8);
  assert.throws(()=>builder.parseArgs(['--out-dir',OUT,'--corpus','c.json','--limit','8']),/CORPUS_AND_LIMIT_EXCLUDE_EACH_OTHER/u);
});

test('throughput is rows actually embedded over the time spent embedding them (regression: a short final shard was counted as a full one)',()=>{
  // One finished shard of 10 rows in 50 s. The old formula reported built*SHARD_ROWS = 128 rows over the whole run.
  assert.deepEqual(builder.throughput({rowsBuilt:10,tokens:9000,embedSeconds:50}),{chunksPerSecond:0.2,tokensPerSecond:180});
  assert.notEqual(builder.throughput({rowsBuilt:10,tokens:9000,embedSeconds:50}).chunksPerSecond,Number((builder.SHARD_ROWS/50).toFixed(3)));
  assert.deepEqual(builder.throughput({rowsBuilt:128+101,tokens:229000,embedSeconds:1000}),{chunksPerSecond:0.229,tokensPerSecond:229});
  for(const nothing of [{rowsBuilt:0,tokens:0,embedSeconds:0},{rowsBuilt:0,tokens:0,embedSeconds:17},{rowsBuilt:5,tokens:1,embedSeconds:0}])assert.deepEqual(builder.throughput(nothing),{chunksPerSecond:null,tokensPerSecond:null});
  const source=read('tools/build-semantic-index.js');assert.doesNotMatch(source,/built\*SHARD_ROWS/u);assert.match(source,/rowsBuilt\+=rows;embedSeconds\+=\(Date\.now\(\)-t0\)\/1000;/u);
});

const LIBRARY=[
  {title:'IMO ISM Code 2018',chunks:['a','b']},{title:'UK MCA MGN 71 Musters and drills SOLAS',chunks:['c']},{title:'ILO MLC 2006 consolidated',chunks:['d','e','f']},
  {title:'ClassNK ISM audit guidance',chunks:['g']},{title:'ISM Code soru bankası IMO',chunks:['h']},{title:'American Practical Navigator',chunks:['i']},
  {title:'ClassNK Hull Construction Part C',chunks:['j']},{title:'IMO SOLAS huge manual',chunks:Array.from({length:151},(_,i)=>`x${i}`)},{title:'IMO ISM Code 2018',chunks:['zz']}
];
test('the corpus is whole documents chosen by authority, topic, teaching-material and size rules on the TITLE only; every entry is pinned by hash',()=>{
  const {picked,counts}=definer.define(LIBRARY);
  assert.deepEqual(picked.map(p=>[p.title,p.authority,p.topic,p.chunks]),[['IMO ISM Code 2018','IMO','ism',2],['UK MCA MGN 71 Musters and drills SOLAS','FLAG_STATE','muster',1],['ILO MLC 2006 consolidated','ILO','mlc',3],['ClassNK ISM audit guidance','CLASS','ism',1]]);
  assert.deepEqual([counts.excludedTeaching,counts.excludedNoAuthority,counts.excludedNoTopic,counts.excludedTooLarge,counts.duplicateTitle],[1,1,1,1,1]);
  assert.equal(picked[0].documentSha256,sha256(['a','b'].map(sha256).join('\n')));assert.equal(picked[0].documentSha256,builder.documentSha256(LIBRARY[0]));
  const source=read('tools/define-regulatory-core-corpus.js');// It never opens a probe file: the rules cannot depend on a question, a needle or an answer.
  assert.doesNotMatch(source,/probes-v1|probes-test|loadProbes|\.needle|\.question|node:http|\bfetch\(|11434/u);assert.equal([...source.matchAll(/writeFileSync\(/gu)].length,1);
  assert.deepEqual(definer.define(LIBRARY),definer.define(LIBRARY));
});

test('the recorded corpus manifest: provenance, rules, totals - and no text',()=>{
  const c=JSON.parse(read('tests/benchmark/retrieval/corpus-regulatory-core-v1.json'));
  assert.equal(c.version,'sinbad-retrieval-corpus/1');assert.equal(c.name,'regulatory-core-v1');assert.match(c.librarySha256,/^[0-9a-f]{64}$/u);assert.equal(c.rules.wholeDocumentsOnly,true);
  assert.equal(c.totals.documents,c.documents.length);assert.equal(c.totals.chunks,c.documents.reduce((s,d)=>s+d.chunks,0));assert.ok(c.totals.chunks<5000,'bounded');assert.ok(c.totals.chunks>1000,'a real retrieval problem');
  assert.equal(new Set(c.documents.map(d=>d.title)).size,c.documents.length);
  for(const d of c.documents){assert.ok(d.chunks>=1&&d.chunks<=c.maxDocumentChunks,d.title);assert.match(d.documentSha256,/^[0-9a-f]{64}$/u);assert.ok(['IMO','ILO','FLAG_STATE','CLASS'].includes(d.authority));assert.equal(definer.EXCLUDE.test(d.title),false,d.title);assert.deepEqual(Object.keys(d).sort(),['authority','chunks','documentSha256','inclusionReason','title','topic']);}
  assert.equal(Object.values(c.totals.byAuthority).reduce((s,a)=>s+a.chunks,0),c.totals.chunks);
});

test('a corpus is loaded by title AND content hash; a changed or foreign library is refused',()=>{
  fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});const file=path.join(OUT,'corpus.json');const lib='library-sha';
  const entry=d=>({title:d.title,chunks:d.chunks.length,documentSha256:builder.documentSha256(d)});
  fs.writeFileSync(file,JSON.stringify({version:'sinbad-retrieval-corpus/1',name:'t',librarySha256:lib,documents:[entry(LIBRARY[2]),entry(LIBRARY[0])]}));
  const loaded=builder.loadCorpus(file,LIBRARY,lib);assert.deepEqual(loaded.documents.map(d=>d.title),['ILO MLC 2006 consolidated','IMO ISM Code 2018']);assert.equal(loaded.documents[1],LIBRARY[0],'the duplicate title with other content is not taken');assert.match(loaded.sha256,/^[0-9a-f]{16}$/u);
  assert.throws(()=>builder.loadCorpus(file,LIBRARY,'another-library'),/CORPUS_MISMATCH: the corpus was defined on another library index/u);
  assert.throws(()=>builder.loadCorpus(file,[{title:'ILO MLC 2006 consolidated',chunks:['d','e','CHANGED']},LIBRARY[0]],lib),/CORPUS_MISMATCH: ILO MLC 2006 consolidated is missing or changed/u);
  fs.writeFileSync(file,JSON.stringify({version:'other',documents:[]}));assert.throws(()=>builder.loadCorpus(file,LIBRARY,lib),/CORPUS_INVALID/u);fs.rmSync(OUT,{recursive:true,force:true});
});

const D=builder.DIMENSION;const vec=(...pairs)=>{const v=new Array(D).fill(0);for(const [i,x] of pairs)v[i]=x;const n=Math.sqrt(v.reduce((s,x)=>s+x*x,0));return v.map(x=>x/n);};
const DOCS=[{title:'Notice',chunks:['Audits audits how often audits reminders on board.','How often audits carried out on board reminder.']},{title:'Exam',chunks:['How often internal audits on board question.']},{title:'ISM Code',chunks:['The Company should verify compliance at intervals not exceeding twelve months.','The master has overriding authority.']}];
test('four systems on the same universe: gains, regressions and unchanged cases by probe, top-k, MRR, categories, provenance of every hit',()=>{
  const index=retriever.build(DOCS);assert.equal(index.chunks.length,5);
  // Chunk 3 (the ISM passage) lies along axis 0, chunk 4 along axis 1, the chatty ones along axis 2.
  const matrix=Float32Array.from([vec([2,1]),vec([2,1],[3,0.2]),vec([2,1],[4,0.2]),vec([0,1]),vec([1,1])].flat());
  const probes=[{id:'A',split:'DEV',language:'en',topic:'ISM',question:'How often must internal audits be carried out on board?',needle:'not exceeding twelve months'},
    {id:'B',split:'DEV',language:'en',topic:'X',question:'reminders about audits on board',needle:'reminders on board'},{id:'C',split:'DEV',language:'tr',topic:'Y',question:'ekmek nasıl yapılır',needle:'nowhere in this corpus'}];
  const queries={A:{RAW:vec([0,1],[2,0.3]),INSTRUCTED:vec([0,1])},B:{RAW:vec([0,1]),INSTRUCTED:vec([0,1])},C:{RAW:vec([0,1]),INSTRUCTED:vec([0,1])}};
  const r=evaluator.evaluate(index,matrix,queries,probes);
  assert.deepEqual([r.probesUsed,r.probesUnanswerableInCorpus,r.hybridsTried,Object.keys(r.systems).length],[2,['C'],18,21]);
  const lex=r.systems.LEXICAL,sem=r.systems['SEMANTIC INSTRUCTED'];assert.equal(lex.rows[0].topic,'ISM');
  assert.deepEqual([sem.rows[0].hit,sem.rows[0].firstRank,sem.rows[0].hitAt[1]],[true,1,true]);assert.deepEqual(sem.rows[0].hitProvenance,{title:'ISM Code',chunkIndex:0,contentHash:sha256(DOCS[2].chunks[0]).slice(0,16),marker:'S1'});
  // B: lexical finds the chatty notice at once; the semantic vectors put it last.
  assert.deepEqual([lex.rows[1].hit,lex.rows[1].firstRank],[true,1]);assert.ok(sem.rows[1].firstRank>lex.rows[1].firstRank);
  const c=r.comparisonWithLexical['SEMANTIC INSTRUCTED'];assert.equal(c.gained.length+c.lost.length+c.unchangedHits+c.unchangedMisses.length,2);assert.equal(c.net,c.gained.length-c.lost.length);assert.ok(c.ranksWorsened>=1);
  assert.deepEqual(Object.keys(lex.topK),['hit@1','hit@3','hit@6','hit@10']);assert.ok(lex.mrr>0&&lex.mrr<=1);assert.deepEqual(lex.language.en.probes,2);
  assert.deepEqual(r.perProbe.map(p=>p.id),['A','B']);for(const p of r.perProbe)assert.ok(['BOTH_FIND_IT','LEXICAL_ONLY','SEMANTIC_ONLY','NONE_FINDS_IT'].includes(p.category));
  assert.equal(JSON.stringify(r).includes('twelve months'),false,'no passage text in a result');assert.deepEqual(evaluator.evaluate(index,matrix,queries,probes),r);
  // Every hybrid that is tried is declared up front, is RRF or SLOTS, and names its query mode.
  assert.equal(evaluator.HYBRIDS.length,18);assert.ok(evaluator.HYBRIDS.every(h=>['RRF','SLOTS'].includes(h.method)&&['RAW','INSTRUCTED'].includes(h.mode)));
});

test('a vector without its source is refused: the loader checks every row against the hash of the chunk text it stands for',()=>{
  fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});const index=retriever.build(DOCS);const scope='CORPUS t 0123456789abcdef';
  const vectors=index.chunks.map((_,i)=>vec([i,1]));const buf=builder.toBuffer(vectors);const hashes=index.chunks.map(c=>sha256(c.text));
  fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify({model:builder.MODEL,dimension:D,inputRule:builder.INPUT_RULE,scope}));
  const write=h=>{fs.writeFileSync(path.join(OUT,'shard-00000.f32'),buf);fs.writeFileSync(path.join(OUT,'shard-00000.json'),JSON.stringify({shard:0,firstChunkId:0,rows:5,vectorsSha256:sha256(buf),contentHashes:h}));};
  write(hashes);assert.equal(evaluator.loadVectors(OUT,index,scope).matrix.length,5*D);
  assert.throws(()=>evaluator.loadVectors(OUT,index,'CORPUS other ffff'),/INDEX_MANIFEST_MISMATCH/u);
  write([hashes[1],hashes[0],...hashes.slice(2)]);assert.throws(()=>evaluator.loadVectors(OUT,index,scope),/VECTOR_WITHOUT_ITS_SOURCE shard 0 row 0/u);
  write(hashes);fs.writeFileSync(path.join(OUT,'shard-00000.f32'),Buffer.concat([buf.subarray(0,buf.length-4),Buffer.alloc(4,1)]));assert.throws(()=>evaluator.loadVectors(OUT,index,scope),/INDEX_SHARD_INVALID 0/u);
  fs.rmSync(OUT,{recursive:true,force:true});
});

test('DEV model selection is mechanical and was frozen beforehand: primary metric, tie-breaks and eligibility in the code equal the preregistration',()=>{
  const p=JSON.parse(read('tests/benchmark/results/RETRIEVAL-004/DEV_SELECTION_PREREGISTRATION.json'));const S=evaluator.SELECTION;
  assert.deepEqual(S.queryMode,p.selectionRule.step1_queryMode.order);assert.equal(`${S.hybrid.primary} - strict hits at 6 passages, the success metric Project 2 already uses`,p.selectionRule.step2_hybrid.primaryMetric);
  assert.deepEqual(S.hybrid.tieBreaks,p.selectionRule.step2_hybrid.tieBreaks);assert.equal(S.maxRegressions,1);assert.match(p.selectionRule.step2_hybrid.eligibility,/regressions against lexical <= 1/u);
  assert.match(S.label,/^DEV MODEL SELECTION - a candidate, not a verified gain$/u);assert.match(p.whatThisIs,/not a verified gain, not a product truth/u);assert.match(p.whatThisIs,/TEST-3, which this task does not run/u);
  assert.match(p.universe,/No figure measured on the full library \(RETRIEVAL-001, -002, -003\) is compared/u);assert.match(p.configurationsTried.hybrids,/^18, declared/u);
  // The rule, applied to made-up numbers: mode by strict hits; then strict hits, regressions, hits, MRR, simplicity; more than one regression is out.
  const sys=(strictHit,hit,mrr)=>({strictHit,hit,mrr});const cmp=lost=>({lost:Array.from({length:lost},(_,i)=>`x${i}`)});const systems={'SEMANTIC RAW':sys(5,10,0.5),'SEMANTIC INSTRUCTED':sys(6,9,0.4)};const comparison={};
  for(const h of evaluator.HYBRIDS){systems[`HYBRID ${h.id}`]=sys(7,12,0.6);comparison[`HYBRID ${h.id}`]=cmp(0);}
  const set=(id,s,lost)=>{systems[`HYBRID ${id}`]=s;comparison[`HYBRID ${id}`]=cmp(lost);};
  set('RRF k10 lex1:sem1 INSTRUCTED',sys(9,14,0.9),2);        // best numbers, two regressions -> not eligible
  set('SLOTS keep2 INSTRUCTED',sys(8,11,0.5),1);               // most strict hits among the eligible -> selected although hits and MRR are lower
  set('RRF k60 lex1:sem1 RAW',sys(9,15,0.95),0);               // other query mode -> not considered
  const chosen=evaluator.select({systems,comparisonWithLexical:comparison});
  assert.equal(chosen.queryMode,'INSTRUCTED');assert.equal(chosen.selectedHybrid,'HYBRID SLOTS keep2 INSTRUCTED');assert.deepEqual(chosen.excludedForRegressions,['HYBRID RRF k10 lex1:sem1 INSTRUCTED']);assert.deepEqual([chosen.hybridsConsidered,chosen.hybridsEligible],[9,8]);
  // All else equal, the simplest rule wins: RRF k60 1:1.
  set('SLOTS keep2 INSTRUCTED',sys(7,12,0.6),0);assert.equal(evaluator.select({systems,comparisonWithLexical:comparison}).selectedHybrid,'HYBRID RRF k60 lex1:sem1 INSTRUCTED');
  // Fewer regressions beat more hits; nothing eligible is a valid outcome.
  set('RRF k60 lex2:sem1 INSTRUCTED',sys(7,13,0.7),1);assert.equal(evaluator.select({systems,comparisonWithLexical:comparison}).selectedHybrid,'HYBRID RRF k60 lex1:sem1 INSTRUCTED');
  for(const h of evaluator.HYBRIDS)comparison[`HYBRID ${h.id}`]=cmp(2);assert.equal(evaluator.select({systems,comparisonWithLexical:comparison}).selectedHybrid,null);
  systems['SEMANTIC RAW']=sys(6,9,0.4);assert.equal(evaluator.select({systems,comparisonWithLexical:comparison}).queryMode,'RAW','a full tie goes to the simpler query');
});

test('one universe: lexical index and vector matrix must cover the same chunks, and the full-build flag is an interlock, not an authorisation',()=>{
  const index=retriever.build(DOCS);const ok=evaluator.oneUniverse(index,new Float32Array(index.chunks.length*D));
  assert.deepEqual([ok.lexicalIndexChunks,ok.vectorRows,ok.documents],[5,5,3]);assert.equal(ok.chunkSetSha256,sha256(index.chunks.map(c=>sha256(c.text)).join('\n')));assert.match(ok.statement,/all rank the same chunks/u);
  assert.throws(()=>evaluator.oneUniverse(index,new Float32Array(4*D)),/NOT_ONE_UNIVERSE/u);assert.throws(()=>evaluator.oneUniverse(index,new Float32Array(5*D+1)),/NOT_ONE_UNIVERSE/u);
  const ev=read('tools/evaluate-semantic-retrieval.js');assert.match(ev,/const index=retriever\.build\(corpus\.documents\);/u);assert.doesNotMatch(ev,/RETRIEVAL-00[123]\/|retriever\.build\(raw\.documents/u);assert.match(ev,/result\.devModelSelection=select\(result\);/u);
  const b=read('tools/build-semantic-index.js');assert.match(b,/THE FLAG IS A TECHNICAL INTERLOCK, NOT AN AUTHORISATION/u);assert.match(b,/only when the Owner has separately and\s*\/\/ explicitly given a GO/u);
});

test('corpus accounting: manifest chunks minus punctuation-only chunks equals the lexical universe, or the tool stops (3 813 -> 3 810 explained)',()=>{
  const docs=[{title:'A',chunks:['The master has overriding authority.','.......... ---- ____ ((()))','Internal audits at intervals.']},{title:'B',chunks:['Seafarers are entitled to repatriation.']}];
  const index=retriever.build(docs);assert.equal(index.chunks.length,3);const manifest={totals:{chunks:4},documents:[{title:'A',chunks:3},{title:'B',chunks:1}]};
  const a=evaluator.corpusAccounting(manifest,docs,index);assert.deepEqual([a.manifestDocuments,a.manifestChunks,a.notIndexableChunks,a.universeChunks],[2,4,1,3]);
  assert.deepEqual(a.notIndexable,[{title:'A',chunkIndex:1,chars:27,letters:0,digits:0,contentHash:sha256(docs[0].chunks[1]).slice(0,16)}]);
  // A textual chunk that is missing from the universe, a wrong total, or a document without any chunk is scope drift.
  assert.throws(()=>evaluator.corpusAccounting(manifest,docs,retriever.build([docs[0]])),/SCOPE_DRIFT/u);
  assert.throws(()=>evaluator.corpusAccounting({totals:{chunks:5},documents:manifest.documents},docs,index),/SCOPE_DRIFT/u);
  assert.throws(()=>evaluator.corpusAccounting({totals:{chunks:4},documents:[...manifest.documents,{title:'C',chunks:0}]},docs,index),/SCOPE_DRIFT/u);
  // The frozen parts were not touched by this addition: same 18 hybrids, same selection constants as the preregistration commit.
  // Hashes taken from the preregistration commit 8201b1375a14f61f83554818ccee50ff8e857938 (pushed before any DEV measurement).
  const now=read('tools/evaluate-semantic-retrieval.js').replace(/\r\n/g,'\n');
  assert.equal(sha256(now.slice(now.indexOf('const HYBRIDS=[]'),now.indexOf('function parseArgs'))),'480f7a798c205ac7ca5acd6f1ea0f9f35e97fe33ade4f37532a21d4a7300a9c0','HYBRIDS, SELECTION and select() are byte-identical to the preregistration commit');
  assert.equal(sha256(read('tests/benchmark/results/RETRIEVAL-004/DEV_SELECTION_PREREGISTRATION.json').replace(/\r\n/g,'\n')),'36a99c1242d8a49719b994a0b030e2403a9cc3d2b9f9c3129d2b46b3018e84ff','the preregistration file is byte-identical to the preregistration commit');
});

test('DEV only, local only, nothing wired: no tool of the experiment reads a blind or used-holdout set, the evaluator calls no model',()=>{
  assert.throws(()=>embedder.parseArgs(['--index-dir',OUT,'--split','TEST2']),/DEV_ONLY/u);assert.throws(()=>embedder.parseArgs(['--index-dir',OUT,'--split','TEST']),/DEV_ONLY/u);
  assert.throws(()=>embedder.parseArgs(['--index-dir',path.join(ROOT,'x')]),/OUTSIDE_THE_REPOSITORY/u);assert.throws(()=>embedder.parseArgs(['--index-dir',OUT,'--ollama','http://8.8.8.8:11434']),/OLLAMA_MUST_BE_LOOPBACK/u);
  for(const file of ['tools/evaluate-semantic-retrieval.js','tools/embed-retrieval-queries.js','tools/define-regulatory-core-corpus.js','tools/build-semantic-index.js'])assert.doesNotMatch(read(file),/probes-test2|probes-test3|TEST-3 probes|node:https|api\.openai|supabase/u,file);
  const ev=read('tools/evaluate-semantic-retrieval.js');assert.doesNotMatch(ev,/node:http|\bfetch\(|child_process|api\/embed/u);assert.match(ev,/filter\(p=>p\.split==='DEV'\)/u);assert.equal([...ev.matchAll(/writeFileSync\(/gu)].length,1);
  const em=read('tools/embed-retrieval-queries.js');assert.match(em,/filter\(p=>p\.split==='DEV'\)/u);assert.match(em,/await embed\(FILLER\);/u);assert.doesNotMatch(em,/index\.chunks|\.text\b/u,'no document text goes into a query');
  for(const file of ['sinbad-ai-core/pipeline/grounded-pipeline.js','sinbad-ai-core/pipeline/index.js','tools/sinbad-grounded-service.js','tools/run-grounded-subset.js'])assert.doesNotMatch(read(file),/semantic|embed-retrieval|regulatory-core/u,file);
});
