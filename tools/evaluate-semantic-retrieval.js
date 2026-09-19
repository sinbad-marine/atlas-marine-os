'use strict';
// Project 2 Phase 4.10 part 2 - lexical vs semantic vs simple hybrid on ONE bounded corpus, DEV probes only. Owner directive of 2026-09-19.
//
// Same information universe for every system: the documents of the corpus manifest, and nothing else. LEXICAL is the merged
// BM25 retriever built over those documents. SEMANTIC ranks the same chunks by cosine against vectors read from an index
// OUTSIDE the repository; every vector row is checked against the SHA-256 of the chunk text it claims to be, so a vector can
// always be traced to its source document, chunk position and text - vectors are retrieval aids, the library stays the
// evidence. HYBRID is a rule that fits in one sentence (reciprocal rank fusion, or SLOTS); every configuration that was
// tried is recorded. No model call, no network, no learned re-ranker. DEV only: blind and used-holdout probes are not read.
// Run: node --max-old-space-size=4096 tools/evaluate-semantic-retrieval.js --run-id RETRIEVAL-004 --index-dir <dir> --corpus <manifest>
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const retriever=require('../sinbad-ai-core/pipeline/lexical-retriever');
const semantic=require('../sinbad-ai-core/pipeline/semantic-retriever');
const builder=require('./build-semantic-index');
const ROOT=path.resolve(__dirname,'..');
const PROBES=path.join(ROOT,'tests/benchmark/retrieval/probes-v1.json');
const DEFAULT_LIBRARY=path.join(os.homedir(),'OneDrive','Belgeler','Sinbad Bridge','Library','.sinbad-index.json');
const PASSAGES=6,HORIZON=200,STRICT_MAX_CHUNKS=20,TOP_K=[1,3,6,10];
const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');
// Every hybrid configuration that is tried, declared up front (directive point 5: record every tested configuration).
const HYBRIDS=[];for(const mode of semantic.QUERY_MODES){for(const k of [10,60])for(const weights of [[1,1],[2,1],[1,2]])HYBRIDS.push({id:`RRF k${k} lex${weights[0]}:sem${weights[1]} ${mode}`,method:'RRF',mode,k,weights});for(const keep of [2,3,4])HYBRIDS.push({id:`SLOTS keep${keep} ${mode}`,method:'SLOTS',mode,keep});}

function parseArgs(argv){
  const args={runId:null,indexDir:null,corpus:null,library:process.env.SINBAD_LIBRARY_INDEX||DEFAULT_LIBRARY};
  for(let i=0;i<argv.length;i+=1){const a=argv[i],v=argv[i+1];if(a==='--run-id'){args.runId=v;i+=1;}else if(a==='--index-dir'){args.indexDir=v;i+=1;}else if(a==='--corpus'){args.corpus=v;i+=1;}else if(a==='--library'){args.library=v;i+=1;}}
  if(typeof args.runId!=='string'||!/^RETRIEVAL-\d{3}$/u.test(args.runId))throw new Error('RUN_ID_REQUIRED');
  if(typeof args.indexDir!=='string'||!path.isAbsolute(args.indexDir))throw new Error('INDEX_DIR_REQUIRED');if(typeof args.corpus!=='string')throw new Error('CORPUS_REQUIRED');
  return args;
}
// loadVectors(dir, index, scope) -> Float32Array; refuses a row whose hash is not the hash of the chunk it stands for.
function loadVectors(dir,index,scope){
  const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
  if(manifest.model!==builder.MODEL||manifest.dimension!==builder.DIMENSION||manifest.inputRule!==builder.INPUT_RULE||manifest.scope!==scope)throw new Error('INDEX_MANIFEST_MISMATCH');
  const rows=index.chunks.length;const matrix=new Float32Array(rows*builder.DIMENSION);const shards=Math.ceil(rows/builder.SHARD_ROWS);
  for(let n=0;n<shards;n+=1){const first=n*builder.SHARD_ROWS,count=Math.min(builder.SHARD_ROWS,rows-first);
    const meta=JSON.parse(fs.readFileSync(path.join(dir,`${builder.shardName(n)}.json`),'utf8'));const buf=fs.readFileSync(path.join(dir,`${builder.shardName(n)}.f32`));
    if(meta.rows!==count||meta.firstChunkId!==first||buf.length!==count*builder.DIMENSION*4||sha256(buf)!==meta.vectorsSha256)throw new Error(`INDEX_SHARD_INVALID ${n}`);
    for(let r=0;r<count;r+=1)if(meta.contentHashes[r]!==sha256(index.chunks[first+r].text))throw new Error(`VECTOR_WITHOUT_ITS_SOURCE shard ${n} row ${r}`);
    matrix.set(new Float32Array(buf.buffer,buf.byteOffset,count*builder.DIMENSION),first*builder.DIMENSION);}
  return {matrix,manifest};
}
const summarize=rows=>{const n=rows.length;const rate=x=>n?Number((x/n).toFixed(3)):0;const strict=rows.filter(r=>r.strict);
  const out={probes:n,hit:rows.filter(r=>r.hit).length,hitRate:rate(rows.filter(r=>r.hit).length),strictProbes:strict.length,strictHit:strict.filter(r=>r.hit).length,mrr:Number((n?rows.reduce((s,r)=>s+(r.firstRank?1/r.firstRank:0),0)/n:0).toFixed(3)),notFoundWithinHorizon:rows.filter(r=>!r.firstRank).length,topK:{},language:{}};
  for(const k of TOP_K)out.topK[`hit@${k}`]=rows.filter(r=>r.hitAt[k]).length;
  for(const lang of ['en','tr']){const l=rows.filter(r=>r.language===lang);out.language[lang]={probes:l.length,hit:l.filter(r=>r.hit).length};}
  return out;};
// evaluate(index, matrix, queries, probes) -> result. Pure: everything is loaded by the caller.
function evaluate(index,matrix,queries,probes){
  const cap=retriever.MAX_PER_DOCUMENT;const usable=[],unanswerable=[];
  for(const p of probes){const needle=new RegExp(p.needle,'iu');const n=index.chunks.reduce((s,c)=>s+(needle.test(c.text)?1:0),0);if(n===0){unanswerable.push(p.id);continue;}usable.push({...p,re:needle,needleChunks:n,strict:n<=STRICT_MAX_CHUNKS});}
  const rankings=new Map();
  for(const p of usable){const lex=retriever.rank(index,p.question).slice(0,HORIZON);const sem={};for(const mode of semantic.QUERY_MODES)sem[mode]=semantic.rank(matrix,builder.DIMENSION,queries[p.id][mode],HORIZON);rankings.set(p.id,{lex,sem});}
  const row=(p,ranked)=>{const matches=id=>p.re.test(index.chunks[id].text);let firstRank=null;for(let i=0;i<ranked.length;i+=1)if(matches(ranked[i][0])){firstRank=i+1;break;}
    const hitAt={};for(const k of TOP_K)hitAt[k]=semantic.shown(index,ranked,k,cap).some(matches);const ids=semantic.shown(index,ranked,PASSAGES,cap);const at=ids.findIndex(matches);const c=at>=0?index.chunks[ids[at]]:null;
    return {id:p.id,language:p.language,topic:p.topic,strict:p.strict,needleChunks:p.needleChunks,hit:at>=0,firstRank,hitAt,
      hitProvenance:c?{title:c.title,chunkIndex:c.chunkIndex,contentHash:sha256(c.text).slice(0,16),marker:`S${at+1}`}:null};};
  const systems={};const add=(id,config,rankOf)=>{const rows=usable.map(p=>row(p,rankOf(rankings.get(p.id))));systems[id]={config,...summarize(rows),rows};};
  add('LEXICAL',{retriever:retriever.VERSION},r=>r.lex);
  for(const mode of semantic.QUERY_MODES)add(`SEMANTIC ${mode}`,{semantic:semantic.VERSION,queryMode:mode},r=>r.sem[mode]);
  for(const h of HYBRIDS)add(`HYBRID ${h.id}`,h,r=>h.method==='RRF'?semantic.fuseRrf([r.lex,r.sem[h.mode]],{k:h.k,weights:h.weights,depth:HORIZON}):semantic.fuseSlots(r.lex,r.sem[h.mode],h.keep));
  const base=systems.LEXICAL.rows;const comparison={};
  for(const [id,s] of Object.entries(systems)){if(id==='LEXICAL')continue;const gained=[],lost=[],bothHit=[],bothMiss=[];
    s.rows.forEach((r,i)=>{(r.hit&&!base[i].hit?gained:!r.hit&&base[i].hit?lost:r.hit?bothHit:bothMiss).push(r.id);});
    comparison[id]={gained,lost,unchangedHits:bothHit.length,unchangedMisses:bothMiss,net:gained.length-lost.length,strictDelta:s.strictHit-systems.LEXICAL.strictHit,mrrDelta:Number((s.mrr-systems.LEXICAL.mrr).toFixed(3)),
      ranksImproved:s.rows.filter((r,i)=>r.firstRank&&(!base[i].firstRank||r.firstRank<base[i].firstRank)).length,ranksWorsened:s.rows.filter((r,i)=>base[i].firstRank&&(!r.firstRank||r.firstRank>base[i].firstRank)).length};}
  // Per probe: who finds the evidence? (lexical / semantic raw / semantic instructed), with the rank each one gives it.
  const perProbe=usable.map((p,i)=>{const l=base[i],a=systems['SEMANTIC RAW'].rows[i],b=systems['SEMANTIC INSTRUCTED'].rows[i];const sem=a.hit||b.hit;
    return {id:p.id,language:p.language,topic:p.topic,strict:p.strict,lexicalRank:l.firstRank,semanticRawRank:a.firstRank,semanticInstructedRank:b.firstRank,category:l.hit&&sem?'BOTH_FIND_IT':l.hit?'LEXICAL_ONLY':sem?'SEMANTIC_ONLY':'NONE_FINDS_IT'};});
  return {passages:PASSAGES,perDocumentCap:cap,horizon:HORIZON,strictMaxChunks:STRICT_MAX_CHUNKS,probesUsed:usable.length,probesUnanswerableInCorpus:unanswerable,hybridsTried:HYBRIDS.length,systems,comparisonWithLexical:comparison,perProbe};
}
function main(){
  const args=parseArgs(process.argv.slice(2));const text=fs.readFileSync(args.library,'utf8');const librarySha256=sha256(text);const raw=JSON.parse(text.replace(/^﻿/u,''));
  const corpus=builder.loadCorpus(args.corpus,raw.documents||[],librarySha256);const index=retriever.build(corpus.documents);
  const {matrix,manifest}=loadVectors(args.indexDir,index,`CORPUS ${corpus.name} ${corpus.sha256}`);
  const q=JSON.parse(fs.readFileSync(path.join(args.indexDir,'queries-dev.json'),'utf8'));if(q.split!=='DEV'||q.model!==builder.MODEL||q.modelDigest!==manifest.modelDigest||q.instruction!==semantic.QUERY_INSTRUCTION)throw new Error('QUERY_VECTORS_MISMATCH');
  const probes=JSON.parse(fs.readFileSync(PROBES,'utf8')).probes.filter(p=>p.split==='DEV');
  const result={run:args.runId,probeSet:'probes-v1 DEV only',corpus:{name:corpus.name,sha256:corpus.sha256,documents:corpus.documents.length,chunks:index.chunks.length,librarySha256},
    model:{name:manifest.model,digest:manifest.modelDigest,dimension:manifest.dimension,inputRule:manifest.inputRule,queryInstruction:q.instruction,queriesEmbeddedCold:q.cold},
    method:'All systems search the same corpus. HIT = one of the 6 passages shown (at most 2 per document) matches the probe needle; firstRank = first matching chunk in the ranking (horizon 200); strict = needle matches at most 20 chunks of the corpus. Probes whose needle does not exist in the corpus are left out and listed. Titles, ranks and hashes only - no passage text, no vectors.',
    ...evaluate(index,matrix,q.queries,probes)};
  const outDir=path.join(ROOT,'tests/benchmark/results',args.runId);fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(path.join(outDir,'results.json'),`${JSON.stringify(result,null,1)}\n`);
  const line=(id,s)=>`${id.padEnd(38)} hit ${String(s.hit).padStart(2)}/${s.probes} strict ${String(s.strictHit).padStart(2)}/${s.strictProbes} MRR ${s.mrr.toFixed(3)} @1 ${s.topK['hit@1']} @3 ${s.topK['hit@3']} @10 ${s.topK['hit@10']}`;
  process.stdout.write(`${args.runId}: corpus ${corpus.name} (${index.chunks.length} chunks), ${result.probesUsed} DEV probes, unanswerable: ${result.probesUnanswerableInCorpus.join(' ')||'-'}\n`);
  for(const [id,s] of Object.entries(result.systems)){const c=result.comparisonWithLexical[id];process.stdout.write(`${line(id,s)}${c?` | +[${c.gained.join(' ')}] -[${c.lost.join(' ')}]`:''}\n`);}
}
if(require.main===module)main();
module.exports={parseArgs,loadVectors,evaluate,summarize,HYBRIDS,PASSAGES,HORIZON};
