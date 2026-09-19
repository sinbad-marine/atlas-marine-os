'use strict';
// Project 2 Phase 4.8 - retrieval evaluation. Owner delegation of 2026-09-19.
//
// Does the passage that answers a question reach the model? Measured without a model: for every hand-declared probe
// (tests/benchmark/retrieval/probes-v1.json) the retriever is asked the question; the probe is HIT when one of the passages
// it would show matches the probe's needle. Reads the library index read-only, calls no model and no network, and writes
// only its own result directory. The library is the Owner's private data and is not in the repository, so a result is a
// measurement record (it names the index it was taken on), not something CI can rebuild; CI tests the arithmetic on a
// synthetic index. Results carry titles and ranks, never passage text.
// Run: node --max-old-space-size=4096 tools/evaluate-retrieval.js --run-id RETRIEVAL-001 [--index file] [--passages 6]
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const retriever=require('../sinbad-ai-core/pipeline/lexical-retriever');

const ROOT=path.resolve(__dirname,'..');
const PROBES_PATH=path.join(ROOT,'tests/benchmark/retrieval/probes-v1.json');
const DEFAULT_INDEX=path.join(os.homedir(),'OneDrive','Belgeler','Sinbad Bridge','Library','.sinbad-index.json');
const RANK_HORIZON=200;   // a needle ranked below this is reported as not found
const STRICT_MAX_CHUNKS=20; // a needle matching at most this many chunks of the library is a strict probe

function parseArgs(argv){
  const args={runId:null,index:process.env.SINBAD_LIBRARY_INDEX||DEFAULT_INDEX,passages:6};
  for(let i=0;i<argv.length;i+=1){const a=argv[i],v=argv[i+1];if(a==='--run-id'){args.runId=v;i+=1;}else if(a==='--index'){args.index=v;i+=1;}else if(a==='--passages'){args.passages=Number(v);i+=1;}}
  if(typeof args.runId!=='string'||!/^RETRIEVAL-\d{3}$/u.test(args.runId))throw new Error('RUN_ID_REQUIRED');
  if(!Number.isInteger(args.passages)||args.passages<1||args.passages>retriever.MAX_PASSAGES)throw new Error('PASSAGES_INVALID');
  return args;
}
function loadProbes(file=PROBES_PATH){
  const set=JSON.parse(fs.readFileSync(file,'utf8'));
  if(set.version!=='sinbad-retrieval-probes/1'||!Array.isArray(set.probes)||!set.probes.length)throw new Error('PROBES_INVALID');
  const ids=new Set();
  for(const p of set.probes){
    if(typeof p.id!=='string'||ids.has(p.id)||!['DEV','TEST'].includes(p.split)||!['en','tr'].includes(p.language)||typeof p.question!=='string'||!p.question.trim()||typeof p.needle!=='string')throw new Error(`PROBE_INVALID ${p&&p.id}`);
    ids.add(p.id);new RegExp(p.needle,'iu');
  }
  return set;
}
const summarize=rows=>{
  const n=rows.length;const hits=rows.filter(r=>r.hit).length;
  const mrr=n?rows.reduce((s,r)=>s+(r.firstRank?1/r.firstRank:0),0)/n:0;
  return {probes:n,hit:hits,hitRate:n?Number((hits/n).toFixed(3)):0,mrr:Number(mrr.toFixed(3)),notFoundWithinHorizon:rows.filter(r=>!r.firstRank).length};
};
// evaluate(index, probes, passages) -> result object. Pure: the caller loads the index and the probes.
function evaluate(index,probes,passages=6){
  const rows=probes.map(p=>{
    const needle=new RegExp(p.needle,'iu');
    const needleChunks=index.chunks.reduce((n,c)=>n+(needle.test(c.text)?1:0),0);
    const shown=retriever.search(index,p.question,passages);
    const shownHit=shown.findIndex(s=>needle.test(s.text));
    const ranked=retriever.rank(index,p.question);let firstRank=null;
    for(let i=0;i<Math.min(ranked.length,RANK_HORIZON);i+=1)if(needle.test(index.chunks[ranked[i][0]].text)){firstRank=i+1;break;}
    return {id:p.id,split:p.split,language:p.language,topic:p.topic,needleChunks,strict:needleChunks>0&&needleChunks<=STRICT_MAX_CHUNKS,hit:shownHit>=0,hitMarker:shownHit>=0?shown[shownHit].marker:null,firstRank,
      shownTitles:shown.map(s=>s.title)};
  });
  const by=f=>summarize(rows.filter(f));
  return {retriever:retriever.VERSION,passages,rankHorizon:RANK_HORIZON,strictMaxChunks:STRICT_MAX_CHUNKS,overall:summarize(rows),
    split:{dev:by(r=>r.split==='DEV'),test:by(r=>r.split==='TEST')},language:{en:by(r=>r.language==='en'),tr:by(r=>r.language==='tr')},
    strict:{all:by(r=>r.strict),dev:by(r=>r.strict&&r.split==='DEV'),test:by(r=>r.strict&&r.split==='TEST')},
    needleAbsent:rows.filter(r=>r.needleChunks===0).map(r=>r.id),rows};
}
function main(){
  const args=parseArgs(process.argv.slice(2));const set=loadProbes();
  const text=fs.readFileSync(args.index,'utf8');const indexSha256=crypto.createHash('sha256').update(text).digest('hex');
  const raw=JSON.parse(text.replace(/^﻿/u,''));const index=retriever.build(raw.documents||[]);
  const result={run:args.runId,probes:set.version,library:{builtAt:raw.builtAt||null,documents:index.documentCount,chunks:index.chunks.length,indexSha256},
    method:'Each probe question is given to the retriever; HIT = one of the passages it would show to the model matches the probe needle. firstRank = position of the first matching chunk in the full ranking (no per-document cap), null beyond the horizon. Strict probes are those whose needle matches few chunks of the library, so a hit means the right passage and not merely the right topic. No model, no network. Titles and ranks only, no passage text.',
    ...evaluate(index,set.probes,args.passages)};
  const outDir=path.join(ROOT,'tests/benchmark/results',args.runId);fs.mkdirSync(outDir,{recursive:true});
  fs.writeFileSync(path.join(outDir,'results.json'),`${JSON.stringify(result,null,2)}\n`);
  const o=result.overall,s=result.strict;
  process.stdout.write(`${args.runId} (${result.retriever}, ${args.passages} passages): hit ${o.hit}/${o.probes} (${o.hitRate}), MRR ${o.mrr}; strict ${s.all.hit}/${s.all.probes}; DEV ${result.split.dev.hit}/${result.split.dev.probes}, TEST ${result.split.test.hit}/${result.split.test.probes}; EN ${result.language.en.hit}/${result.language.en.probes}, TR ${result.language.tr.hit}/${result.language.tr.probes}\n`);
  for(const r of result.rows.filter(x=>!x.hit))process.stdout.write(`  MISS ${r.id} ${r.split} ${r.topic} needleChunks=${r.needleChunks} firstRank=${r.firstRank}\n`);
}
if(require.main===module)main();
module.exports={parseArgs,loadProbes,evaluate,summarize,RANK_HORIZON,STRICT_MAX_CHUNKS};
