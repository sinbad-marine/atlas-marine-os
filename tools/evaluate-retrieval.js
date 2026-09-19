'use strict';
// Project 2 Phase 4.8 / 4.9 - retrieval evaluation. Owner delegation and directive of 2026-09-19.
//
// Does the passage that answers a question reach the model? Measured without a model: for every hand-declared probe the
// retriever is asked the question; the probe is HIT when one of the passages it would show matches the probe's needle.
// Phase 4.9 adds a CANDIDATE next to the baseline: the same retrieval plus query expansions read from a file written
// earlier by tools/generate-query-expansions.js (this tool itself calls no model and no network). Baseline and candidate
// are reported side by side with gains and REGRESSIONS, because "the total went up" is not an acceptance criterion.
// Reads the library index read-only and writes only its own result directory. The library is the Owner's private data and
// is not in the repository, so a result is a measurement record (it names the index it was taken on), not something CI can
// rebuild; CI tests the arithmetic on a synthetic index. Results carry titles and ranks, never passage text.
//
// Protocol (Owner directive): development and tuning read the DEV split only. The TEST split of probes-v1 is a USED HOLDOUT
// (read once on 2026-09-19): it is reported as a historical figure with --split ALL, never used to choose anything. The
// blind set probes-test2-v1.json is refused unless --final is given together with a preregistration file that exists.
// Run: node --max-old-space-size=4096 tools/evaluate-retrieval.js --run-id RETRIEVAL-003 --split DEV [--expansions file --keep 4 --use 2]
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const retriever=require('../sinbad-ai-core/pipeline/lexical-retriever');
const expansion=require('../sinbad-ai-core/pipeline/query-expansion');

const ROOT=path.resolve(__dirname,'..');
const PROBES_PATH=path.join(ROOT,'tests/benchmark/retrieval/probes-v1.json');
const PROBES_TEST2_PATH=path.join(ROOT,'tests/benchmark/retrieval/probes-test2-v1.json');
const DEFAULT_INDEX=path.join(os.homedir(),'OneDrive','Belgeler','Sinbad Bridge','Library','.sinbad-index.json');
const RANK_HORIZON=200;   // a needle ranked below this is reported as not found
const STRICT_MAX_CHUNKS=20; // a needle matching at most this many chunks of the library is a strict probe

function parseArgs(argv){
  const args={runId:null,index:process.env.SINBAD_LIBRARY_INDEX||DEFAULT_INDEX,passages:6,split:'ALL',expansions:null,keep:null,use:expansion.MAX_QUERIES,final:false,preregistration:null,label:null};
  for(let i=0;i<argv.length;i+=1){const a=argv[i],v=argv[i+1];
    if(a==='--run-id'){args.runId=v;i+=1;}else if(a==='--index'){args.index=v;i+=1;}else if(a==='--passages'){args.passages=Number(v);i+=1;}else if(a==='--split'){args.split=v;i+=1;}
    else if(a==='--expansions'){args.expansions=v;i+=1;}else if(a==='--keep'){args.keep=Number(v);i+=1;}else if(a==='--use'){args.use=Number(v);i+=1;}else if(a==='--preregistration'){args.preregistration=v;i+=1;}else if(a==='--label'){args.label=v;i+=1;}else if(a==='--final')args.final=true;}
  if(typeof args.runId!=='string'||!/^RETRIEVAL-\d{3}$/u.test(args.runId))throw new Error('RUN_ID_REQUIRED');
  if(!Number.isInteger(args.passages)||args.passages<1||args.passages>retriever.MAX_PASSAGES)throw new Error('PASSAGES_INVALID');
  if(!['ALL','DEV','TEST2'].includes(args.split))throw new Error('SPLIT_INVALID');
  if(args.split==='TEST2'&&(!args.final||typeof args.preregistration!=='string'))throw new Error('BLIND_SET_NEEDS_FINAL_AND_PREREGISTRATION');
  if(args.split!=='TEST2'&&args.final)throw new Error('FINAL_IS_FOR_THE_BLIND_SET_ONLY');
  if(args.expansions!==null){if(args.keep===null)args.keep=args.passages;if(!Number.isInteger(args.keep)||args.keep<0||args.keep>args.passages)throw new Error('KEEP_INVALID');if(!Number.isInteger(args.use)||args.use<1||args.use>expansion.MAX_QUERIES)throw new Error('USE_INVALID');}
  if(args.label!==null&&!/^[a-z0-9-]{1,40}$/u.test(args.label))throw new Error('LABEL_INVALID');
  return args;
}
function loadProbes(file=PROBES_PATH){
  const set=JSON.parse(fs.readFileSync(file,'utf8'));
  if(set.version!=='sinbad-retrieval-probes/1'||!Array.isArray(set.probes)||!set.probes.length)throw new Error('PROBES_INVALID');
  const ids=new Set();
  for(const p of set.probes){
    if(typeof p.id!=='string'||ids.has(p.id)||!['DEV','TEST','TEST2'].includes(p.split)||!['en','tr'].includes(p.language)||typeof p.question!=='string'||!p.question.trim()||typeof p.needle!=='string')throw new Error(`PROBE_INVALID ${p&&p.id}`);
    ids.add(p.id);new RegExp(p.needle,'iu');
  }
  return set;
}
const summarize=rows=>{
  const n=rows.length;const hits=rows.filter(r=>r.hit).length;
  const mrr=n?rows.reduce((s,r)=>s+(r.firstRank?1/r.firstRank:0),0)/n:0;
  return {probes:n,hit:hits,hitRate:n?Number((hits/n).toFixed(3)):0,mrr:Number(mrr.toFixed(3)),notFoundWithinHorizon:rows.filter(r=>!r.firstRank).length};
};
const breakdown=rows=>{const by=f=>summarize(rows.filter(f));return {overall:summarize(rows),split:{dev:by(r=>r.split==='DEV'),test:by(r=>r.split==='TEST'),test2:by(r=>r.split==='TEST2')},language:{en:by(r=>r.language==='en'),tr:by(r=>r.language==='tr')},
  strict:{all:by(r=>r.strict),dev:by(r=>r.strict&&r.split==='DEV'),test:by(r=>r.strict&&r.split==='TEST'),test2:by(r=>r.strict&&r.split==='TEST2'),en:by(r=>r.strict&&r.language==='en'),tr:by(r=>r.strict&&r.language==='tr')}};};
// evaluate(index, probes, passages, candidate?) -> result object. Pure: the caller loads the index, the probes and the
// expansions. candidate = {expansions:{probeId:{valid,queries}}, keep, use}.
function evaluate(index,probes,passages=6,candidate=null){
  const base=[];const cand=[];
  for(const p of probes){
    const needle=new RegExp(p.needle,'iu');const matches=id=>needle.test(index.chunks[id].text);
    const needleChunks=index.chunks.reduce((n,c)=>n+(needle.test(c.text)?1:0),0);const strict=needleChunks>0&&needleChunks<=STRICT_MAX_CHUNKS;
    const shown=retriever.search(index,p.question,passages);const shownHit=shown.findIndex(s=>needle.test(s.text));
    const ranked=retriever.rank(index,p.question);let firstRank=null;
    for(let i=0;i<Math.min(ranked.length,RANK_HORIZON);i+=1)if(matches(ranked[i][0])){firstRank=i+1;break;}
    const common={id:p.id,split:p.split,language:p.language,topic:p.topic,needleChunks,strict};
    base.push({...common,hit:shownHit>=0,hitMarker:shownHit>=0?shown[shownHit].marker:null,firstRank,shownTitles:shown.map(s=>s.title)});
    if(candidate){
      // The stored verdict is not trusted: the raw model output is checked again, here, with the check as it is now.
      const stored=candidate.expansions[p.id];const e=stored&&typeof stored.raw==='string'?expansion.check(p.question,stored.raw):stored&&stored.raw===undefined?stored:{valid:false,queries:[],reason:stored?stored.reason||'MODEL_ERROR':'NO_EXPANSION'};
      const queries=e&&e.valid===true&&Array.isArray(e.queries)?e.queries:[];
      const fused=expansion.fuse({index,question:p.question,queries,passages,keep:candidate.keep,use:candidate.use});
      const hitAt=fused.ids.findIndex(matches);
      // The candidate's ranking = what it shows, then the rest of the original ranking.
      let rank=hitAt>=0?hitAt+1:null;if(rank===null){const shownSet=new Set(fused.ids);let pos=fused.ids.length;for(const [id] of ranked){if(shownSet.has(id))continue;pos+=1;if(pos>RANK_HORIZON)break;if(matches(id)){rank=pos;break;}}}
      cand.push({...common,hit:hitAt>=0,hitMarker:hitAt>=0?`S${hitAt+1}`:null,firstRank:rank,expansionValid:queries.length>0,expansionReason:e?e.reason||null:'NO_EXPANSION',fromExpansion:fused.fromExpansion,hitSource:hitAt>=0?fused.sources[hitAt]:null,
        shownTitles:fused.ids.map(id=>index.chunks[id].title)});
    }
  }
  const result={retriever:retriever.VERSION,passages,rankHorizon:RANK_HORIZON,strictMaxChunks:STRICT_MAX_CHUNKS,...breakdown(base),needleAbsent:base.filter(r=>r.needleChunks===0).map(r=>r.id),rows:base};
  if(candidate){
    const gained=cand.filter((r,i)=>r.hit&&!base[i].hit).map(r=>r.id),lost=cand.filter((r,i)=>!r.hit&&base[i].hit).map(r=>r.id);
    const baseHits=base.filter(r=>r.hit).length;const delta=(a,b)=>Number((a-b).toFixed(3));const c=breakdown(cand);
    result.candidate={expansion:expansion.VERSION,fusion:{method:'SLOTS',keep:candidate.keep,use:candidate.use},...c,
      expansions:{valid:cand.filter(r=>r.expansionValid).length,invalid:cand.filter(r=>!r.expansionValid).length,invalidReasons:cand.filter(r=>!r.expansionValid).reduce((m,r)=>{m[r.expansionReason]=(m[r.expansionReason]||0)+1;return m;},{})},
      comparison:{gained,lost,gains:gained.length,regressions:lost.length,net:gained.length-lost.length,baselineHits:baseHits,baselineHitsKept:baseHits-lost.length,baselineHitsLost:lost.length,
        strictGained:gained.filter(id=>cand.find(r=>r.id===id).strict),strictLost:lost.filter(id=>cand.find(r=>r.id===id).strict),
        delta:{overallHit:c.overall.hit-result.overall.hit,strictHit:c.strict.all.hit-result.strict.all.hit,mrr:delta(c.overall.mrr,result.overall.mrr),enHit:c.language.en.hit-result.language.en.hit,trHit:c.language.tr.hit-result.language.tr.hit,
          rankImproved:cand.filter((r,i)=>r.firstRank&&(!base[i].firstRank||r.firstRank<base[i].firstRank)).length,rankWorsened:cand.filter((r,i)=>base[i].firstRank&&(!r.firstRank||r.firstRank>base[i].firstRank)).length}},
      rows:cand};
  }
  return result;
}
function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args.split==='TEST2'&&!fs.existsSync(path.resolve(ROOT,args.preregistration)))throw new Error('PREREGISTRATION_NOT_FOUND');
  const set=loadProbes(args.split==='TEST2'?PROBES_TEST2_PATH:PROBES_PATH);const probes=args.split==='ALL'?set.probes:set.probes.filter(p=>p.split===args.split);
  let candidate=null;let expansionsMeta=null;
  if(args.expansions){const file=JSON.parse(fs.readFileSync(path.resolve(ROOT,args.expansions),'utf8'));if(file.version!==expansion.VERSION||!file.expansions)throw new Error('EXPANSIONS_INVALID');
    candidate={expansions:file.expansions,keep:args.keep,use:args.use};expansionsMeta={file:args.expansions.replace(/\\/gu,'/'),model:file.model,options:file.options,split:file.split};}
  const text=fs.readFileSync(args.index,'utf8');const indexSha256=crypto.createHash('sha256').update(text).digest('hex');
  const raw=JSON.parse(text.replace(/^﻿/u,''));const index=retriever.build(raw.documents||[]);
  const result={run:args.runId,label:args.label,probes:set.version,probeSet:args.split==='TEST2'?'BLIND TEST-2':'probes-v1',probeSplit:args.split,final:args.final,preregistration:args.preregistration,expansionsSource:expansionsMeta,
    library:{builtAt:raw.builtAt||null,documents:index.documentCount,chunks:index.chunks.length,indexSha256},
    method:'Each probe question is given to the retriever; HIT = one of the passages it would show to the model matches the probe needle. firstRank = position of the first matching chunk in the full ranking (no per-document cap), null beyond the horizon. Strict probes are those whose needle matches few chunks of the library, so a hit means the right passage and not merely the right topic. With a candidate, the same probes are also retrieved with validated query expansions fused by SLOTS (the first `keep` passages are the untouched original result) and compared probe by probe. This tool calls no model and no network. Titles and ranks only, no passage text.',
    ...evaluate(index,probes,args.passages,candidate)};
  const outDir=path.join(ROOT,'tests/benchmark/results',args.runId);fs.mkdirSync(outDir,{recursive:true});
  const name=args.label?`results-${args.label}.json`:'results.json';
  fs.writeFileSync(path.join(outDir,name),`${JSON.stringify(result,null,2)}\n`);
  const line=(tag,r)=>`${tag}: hit ${r.overall.hit}/${r.overall.probes} (${r.overall.hitRate}), MRR ${r.overall.mrr}; strict ${r.strict.all.hit}/${r.strict.all.probes}; EN ${r.language.en.hit}/${r.language.en.probes}, TR ${r.language.tr.hit}/${r.language.tr.probes}`;
  process.stdout.write(`${args.runId}${args.label?` [${args.label}]`:''} split ${args.split} (${result.retriever}, ${args.passages} passages)\n  ${line('baseline ',result)}\n`);
  if(result.candidate){const c=result.candidate,k=c.comparison;process.stdout.write(`  ${line('candidate',c)}  [keep ${args.keep}, use ${args.use}; expansions valid ${c.expansions.valid}/${probes.length}]\n  gains ${k.gains} [${k.gained.join(' ')}] regressions ${k.regressions} [${k.lost.join(' ')}] net ${k.net}; strict +${k.strictGained.length}/-${k.strictLost.length}; baseline hits kept ${k.baselineHitsKept}/${k.baselineHits}; ranks improved ${k.delta.rankImproved} worsened ${k.delta.rankWorsened}\n`);}
  else for(const r of result.rows.filter(x=>!x.hit))process.stdout.write(`  MISS ${r.id} ${r.split} ${r.topic} needleChunks=${r.needleChunks} firstRank=${r.firstRank}\n`);
}
if(require.main===module)main();
module.exports={parseArgs,loadProbes,evaluate,summarize,RANK_HORIZON,STRICT_MAX_CHUNKS};
