'use strict';
// Project 2 D6 remediation (Owner decision "PROJECT 2 / D6 PRE-CLOSE REMEDIATION", point 7). RETRIEVAL ONLY:
// no model call. Measures whether adding a chunk's same-document neighbours (chunkIndex +/-2) as candidate
// passages would have found the passage MR-ISM-05 needed (Phase 4.7's finding: the answer sat 2 chunks away
// from what was actually shown), and what it would cost across the WHOLE maritime-reasoning set (32 items;
// none are part of any DEV/TEST split or blind set - this category has no held-out set to protect - so the
// entire set is used). "DEV" per the Owner directive; not promoted into the retriever or the live service.
//
// Method: for each item, "gold chunks" are found by counting, over the WHOLE library, how many of the item's
// anchor groups each chunk alone satisfies (a phrase from each group must occur in the chunk text); the
// chunk(s) with the highest count are gold for that item (ties kept; an item whose best count is 0 has no
// gold chunk in this library - CORPUS_GAP, see MR-ISM-01). BASELINE is exactly what the live grounded service
// shows (top 6, at most 2 per document, from the plain BM25 ranking). EXPANDED adds, for each of the top
// NEIGHBOUR_POOL_DEPTH ranked chunks, its +/-1/+/-2 same-document neighbours as extra candidates, scored at
// the parent's own BM25 score times a decay (never overriding a neighbour's own higher natural score), then
// re-applies the SAME selection rule (best first, cap 2 per document, top 6). Nothing here is wired into
// lexical-retriever.js, sinbad-grounded-service.js or any other live file.
// Run: node --max-old-space-size=4096 tools/evaluate-neighbor-expansion-dev.js [--run-id NAME] [--decay 0.85] [--pool-depth 30]
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const retriever=require('../sinbad-ai-core/pipeline/lexical-retriever');

const ROOT=path.resolve(__dirname,'..');
const GOLD_PATH=path.join(ROOT,'tests/benchmark/questions/maritime-reasoning.json');
const DEFAULT_LIBRARY=path.join(os.homedir(),'OneDrive','Belgeler','Sinbad Bridge','Library','.sinbad-index.json');
const PASSAGES=6,NEIGHBOUR_RADIUS=2;

function parseArgs(argv){
  const args={runId:'NEIGHBOR-EXPANSION-DEV-001',decay:0.85,poolDepth:30,library:process.env.SINBAD_LIBRARY_INDEX||DEFAULT_LIBRARY};
  for(let i=0;i<argv.length;i+=1){const a=argv[i],v=argv[i+1];if(a==='--run-id'){args.runId=v;i+=1;}else if(a==='--decay'){args.decay=Number(v);i+=1;}else if(a==='--pool-depth'){args.poolDepth=Number(v);i+=1;}else if(a==='--library'){args.library=v;i+=1;}}
  if(!Number.isFinite(args.decay)||args.decay<=0||args.decay>=1)throw new Error('DECAY_MUST_BE_BETWEEN_0_AND_1');
  if(!Number.isInteger(args.poolDepth)||args.poolDepth<1)throw new Error('POOL_DEPTH_INVALID');
  return args;
}
const cap=(index,ranked,limit)=>{const per=new Map();const out=[];for(const [id] of ranked){if(out.length>=limit)break;const d=index.chunks[id].docIndex;const used=per.get(d)||0;if(used>=retriever.MAX_PER_DOCUMENT)continue;per.set(d,used+1);out.push(id);}return out;};

// expandWithNeighbours(index, ranked, {decay, poolDepth}) -> new ranked list (same shape as retriever.rank()),
// original entries first at their own score, same-document neighbours of the top poolDepth chunks appended
// (or re-scored upward if already present) at parent_score*decay^|offset| (a closer neighbour outranks a
// farther one when both are otherwise unscored), never below their own natural score.
function expandWithNeighbours(index,ranked,{decay,poolDepth}){
  const score=new Map(ranked.map(([id,s])=>[id,s]));
  for(const [id,s] of ranked.slice(0,poolDepth)){
    const chunk=index.chunks[id];
    for(let off=-NEIGHBOUR_RADIUS;off<=NEIGHBOUR_RADIUS;off+=1){
      if(off===0)continue;const ni=id+off;const neighbour=index.chunks[ni];
      if(!neighbour||neighbour.docIndex!==chunk.docIndex)continue;
      const inherited=s*decay**Math.abs(off);const current=score.get(ni);
      if(current===undefined||inherited>current)score.set(ni,current===undefined?inherited:Math.max(current,inherited));
    }
  }
  return [...score.entries()].sort((a,b)=>b[1]-a[1]||a[0]-b[0]);
}
// goldChunks(index, item) -> {chunkIds:[...], bestHits, groups} - the chunk(s) that alone satisfy the most
// anchor groups; bestHits === groups.length means a chunk exists that answers the item completely by itself.
function goldChunks(index,item){
  const groups=item.anchorGroups||[];let bestHits=0;let chunkIds=[];
  index.chunks.forEach((c,id)=>{
    const text=c.text.toLowerCase();const hits=groups.filter(group=>group.some(phrase=>text.includes(phrase.toLowerCase()))).length;
    if(hits>bestHits){bestHits=hits;chunkIds=[id];}else if(hits===bestHits&&hits>0)chunkIds.push(id);
  });
  return {chunkIds,bestHits,groups:groups.length};
}
function evaluate(index,items,options){
  const gold=new Map(items.map(item=>[item.id,goldChunks(index,item)]));
  const rows=items.map(item=>{
    const g=gold.get(item.id);const goldSet=new Set(g.chunkIds);
    const ranked=retriever.rank(index,item.prompt);
    const baseline=cap(index,ranked,PASSAGES);
    const expandedRanked=expandWithNeighbours(index,ranked,options);
    const expanded=cap(index,expandedRanked,PASSAGES);
    const inBaseline=baseline.some(id=>goldSet.has(id));const inExpanded=expanded.some(id=>goldSet.has(id));
    const newInExpanded=expanded.filter(id=>!baseline.includes(id));
    const category=g.bestHits===0?'CORPUS_GAP':inBaseline&&inExpanded?'UNCHANGED_HIT':!inBaseline&&inExpanded?'GAIN':inBaseline&&!inExpanded?'REGRESSION':'UNCHANGED_MISS';
    // Wrong-neighbour risk: does a chunk introduced only by expansion better satisfy a DIFFERENT item's own
    // anchor groups than this item's? (adjacent "Element" confusion, as found by hand for MR-ISM-05.)
    const wrongNeighbourRisk=[];
    for(const id of newInExpanded){const text=index.chunks[id].text.toLowerCase();const ownHits=g.groups?g.groups:0;const ownActual=(item.anchorGroups||[]).filter(group=>group.some(p=>text.includes(p.toLowerCase()))).length;
      for(const other of items){if(other.id===item.id)continue;const otherHits=(other.anchorGroups||[]).filter(group=>group.some(p=>text.includes(p.toLowerCase()))).length;
        if(otherHits>0&&otherHits>ownActual)wrongNeighbourRisk.push({chunkId:id,title:index.chunks[id].title,betterMatchFor:other.id,otherHits,ownHits:ownActual});}}
    return {id:item.id,bestPossibleHits:g.bestHits,groups:g.groups,category,
      baselineHasGold:inBaseline,expandedHasGold:inExpanded,newCandidates:newInExpanded.length,
      goldChunkCount:g.chunkIds.length,wrongNeighbourRisk};
  });
  const counts={};for(const r of rows)counts[r.category]=(counts[r.category]||0)+1;
  return {passages:PASSAGES,neighbourRadius:NEIGHBOUR_RADIUS,...options,items:rows.length,counts,
    contextGrowth:{averageNewCandidatesPerItem:Number((rows.reduce((s,r)=>s+r.newCandidates,0)/rows.length).toFixed(2))},
    wrongNeighbourRiskCount:rows.reduce((s,r)=>s+r.wrongNeighbourRisk.length,0),
    rows};
}
function main(){
  const args=parseArgs(process.argv.slice(2));
  const items=JSON.parse(fs.readFileSync(GOLD_PATH,'utf8'));const list=Array.isArray(items)?items:(items.items||items.questions);
  const raw=JSON.parse(fs.readFileSync(args.library,'utf8').replace(/^﻿/u,''));const index=retriever.build(raw.documents||[]);
  const result={run:args.runId,retriever:retriever.VERSION,library:{documents:index.documentCount,chunks:index.chunks.length,builtAt:raw.builtAt||null},
    method:'RETRIEVAL ONLY, no model. All 32 maritime-reasoning items (no DEV/TEST split, no blind set exists for this category). Gold chunk(s) per item found by counting anchor-group matches over the whole library. Baseline = current live selection rule (top 6, cap 2/doc). Expanded = same-document +/-2 neighbours of the top pool-depth ranked chunks added as extra candidates at a decayed score, then the same selection rule reapplied. Not wired anywhere; a DEV measurement only.',
    ...evaluate(index,list,{decay:args.decay,poolDepth:args.poolDepth})};
  const outDir=path.join(ROOT,'tests/benchmark/results',args.runId);fs.mkdirSync(outDir,{recursive:true});
  fs.writeFileSync(path.join(outDir,'results.json'),`${JSON.stringify(result,null,1)}\n`);
  process.stdout.write(`${args.runId}: ${JSON.stringify(result.counts)} | avg new candidates/item ${result.contextGrowth.averageNewCandidatesPerItem} | wrong-neighbour risk rows ${result.wrongNeighbourRiskCount}\n`);
  for(const r of result.rows.filter(r=>r.category==='GAIN'||r.category==='REGRESSION'))process.stdout.write(`  ${r.category} ${r.id}\n`);
}
if(require.main===module)main();
module.exports={parseArgs,expandWithNeighbours,goldChunks,evaluate,PASSAGES,NEIGHBOUR_RADIUS};
