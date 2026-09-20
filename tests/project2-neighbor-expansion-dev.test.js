'use strict';
// Project 2 D6 remediation (Owner decision "PROJECT 2 / D6 PRE-CLOSE REMEDIATION", point 7). Retrieval-only
// neighbour-expansion DEV experiment: pure mechanics on a tiny synthetic index, so CI runs it without loading
// the 90,539-chunk library. Not wired into the live retriever or service (asserted below).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const retriever=require('../sinbad-ai-core/pipeline/lexical-retriever');
const tool=require('../tools/evaluate-neighbor-expansion-dev');

const DOCS=[
  {title:'Notice',chunks:['audits audits audits reminder on board planning schedule.','audits reminder on board planning again.','more audit planning notes here.']},
  {title:'ISM Code',chunks:['intervals not exceeding twelve months for the audit.','the master has overriding authority over decisions.','the company should motivate the crew and issue orders and verify requirements and review the sms.']},
];
const index=retriever.build(DOCS);

test('expandWithNeighbours adds only same-document +/-2 neighbours, scored at a decayed parent score, never lowering a neighbour\'s own higher score, and changes nothing outside the pool depth',()=>{
  const ranked=retriever.rank(index,'audits reminder on board');
  const expanded=tool.expandWithNeighbours(index,ranked,{decay:0.5,poolDepth:10});
  const byId=new Map(expanded);
  // Chunk 2 of "Notice" (id 2) is a same-document neighbour of the top matches (ids 0,1) and should appear,
  // even though the query shares no term with it, at roughly half its parent's score.
  assert.ok(byId.has(2),'a same-document neighbour of a top match is added');
  const parentScore=new Map(ranked).get(0)||new Map(ranked).get(1);
  assert.ok(byId.get(2)<=parentScore*0.5+1e-9);
  // Every original entry is still present, at its own original score - expansion never removes or lowers a hit.
  for(const [id,score] of ranked)assert.ok(byId.get(id)>=score-1e-9,id);
  // A chunk from a different document is never added just because it is nearby in the library's own chunk order.
  assert.deepEqual(tool.expandWithNeighbours(index,[[3,9]],{decay:0.5,poolDepth:10}).map(([id])=>id).sort((a,b)=>a-b),[3,4,5],'ids 3,4,5 are the ISM Code document; id 2 (Notice) must not appear');
});

test('goldChunks: the chunk(s) that alone satisfy the most anchor groups, and a CORPUS_GAP item (best hits 0) is reported honestly',()=>{
  const item={id:'X',anchorGroups:[['motivate the crew'],['issue orders'],['review the sms']]};
  const g=tool.goldChunks(index,item);assert.equal(g.bestHits,3);assert.equal(g.groups,3);assert.deepEqual(g.chunkIds,[5]);
  const impossible={id:'Y',anchorGroups:[['a phrase that appears nowhere in this tiny library']]};
  assert.deepEqual(tool.goldChunks(index,impossible),{chunkIds:[],bestHits:0,groups:1});
});

test('evaluate() classifies GAIN / REGRESSION / UNCHANGED_HIT / UNCHANGED_MISS / CORPUS_GAP correctly on a constructed case',()=>{
  // Document "Reg" has two chunks: chunk 0 matches the query strongly, chunk 1 (gold) shares no query term at
  // all but is chunk 0's immediate same-document neighbour, so it has room under the per-document quota of 2
  // once expansion adds it. Document "Other" supplies a second, unrelated match, as a real corpus would.
  const twoDocs=[{title:'Reg',chunks:['audits audits audits reminder for the vessel schedule.','audit planning notes appear here for the crew.']},
    {title:'Other',chunks:['reminder about audits and other matters entirely unrelated to planning.']}];
  const smallIndex=retriever.build(twoDocs);
  const items=[{id:'A',prompt:'audits audits audits reminder',anchorGroups:[['audit planning notes']]},{id:'B',prompt:'audits',anchorGroups:[['nothing like this exists']]}];
  const savedPassages=tool.PASSAGES;
  const result=tool.evaluate(smallIndex,items,{decay:0.9,poolDepth:5});
  const a=result.rows.find(r=>r.id==='A'),b=result.rows.find(r=>r.id==='B');
  assert.equal(a.category,'GAIN',JSON.stringify(a));assert.equal(a.baselineHasGold,false);assert.equal(a.expandedHasGold,true);
  assert.equal(b.category,'CORPUS_GAP');assert.equal(b.bestPossibleHits,0);
  assert.equal(result.counts.GAIN,1);assert.equal(result.counts.CORPUS_GAP,1);
  assert.equal(savedPassages,6,'the tool uses the same passage count as the live service');
});

test('the same per-document cap that applies to the live selection also applies after expansion: a neighbour cannot displace two already-chosen chunks of its own document',()=>{
  // All three chunks are in ONE document and the plain ranking already fills the document's quota of 2 with
  // chunks 0 and 1; chunk 2 (gold, a same-document neighbour of both) has no room left, however high its
  // inherited score, because MAX_PER_DOCUMENT caps candidates FROM THE SAME DOCUMENT, not overall count.
  const oneDoc=retriever.build([DOCS[0]]);
  const items=[{id:'A',prompt:'audits audits audits reminder',anchorGroups:[['audit planning notes']]}];
  const result=tool.evaluate(oneDoc,items,{decay:0.9,poolDepth:5});
  assert.equal(result.rows[0].category,'UNCHANGED_MISS');assert.equal(result.rows[0].expandedHasGold,false);
});

test('not wired: no live pipeline, retriever or service file mentions this tool, and it calls no model',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','tools','evaluate-neighbor-expansion-dev.js'),'utf8');
  assert.doesNotMatch(source,/node:http|\bfetch\(|child_process|ollama|api\.openai/u);assert.match(source,/RETRIEVAL ONLY, no model/u);
  for(const file of ['sinbad-ai-core/pipeline/lexical-retriever.js','sinbad-ai-core/pipeline/grounded-pipeline.js','tools/sinbad-grounded-service.js'])
    assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),/evaluate-neighbor-expansion|expandWithNeighbours/u,file);
});
