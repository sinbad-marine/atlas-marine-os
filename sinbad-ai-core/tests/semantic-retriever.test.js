'use strict';
// Project 2 Phase 4.10 - semantic ranking and fusion: pure arithmetic, deterministic, explainable, and not wired anywhere.
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const semantic=require('../pipeline/semantic-retriever.js');
const unit=v=>{const n=Math.sqrt(v.reduce((s,x)=>s+x*x,0));return v.map(x=>x/n);};
const matrix=rows=>Float32Array.from(rows.flatMap(unit));

test('rank is the cosine against every row, best first, ties by chunk id, whatever the length of the query vector',()=>{
  const m=matrix([[1,0,0],[0,1,0],[1,1,0],[1,0,0]]);
  assert.deepEqual(semantic.rank(m,3,[5,0,0]).map(r=>r[0]),[0,3,2,1]);assert.deepEqual(semantic.rank(m,3,[5,0,0])[0],[0,1]);assert.equal(semantic.rank(m,3,[5,0,0])[2][1],0.707107);
  assert.deepEqual(semantic.rank(m,3,[0.1,0,0]),semantic.rank(m,3,[99,0,0]));assert.deepEqual(semantic.rank(m,3,[0,1,0],2).map(r=>r[0]),[1,2]);
  assert.deepEqual(semantic.rank(m,3,[1,1,0]),semantic.rank(m,3,[1,1,0]));
  for(const bad of [[m,3,[1,0]],[m,3,[0,0,0]],[m,3,[NaN,0,0]],[m,5,[1,0,0,0,0]],[[1,0,0],3,[1,0,0]],[m,3,null]])assert.throws(()=>semantic.rank(...bad),/SEMANTIC_(?:MATRIX|QUERY)_INVALID/u);
});

test('reciprocal rank fusion rewards agreement, needs no scores to be comparable, and is deterministic',()=>{
  const lexical=[[10,9.1],[11,8.0],[12,7.5],[13,1.0]],sem=[[12,0.91],[14,0.90],[10,0.62]];
  const fused=semantic.fuseRrf([lexical,sem],{k:60});
  // 10 (ranks 1 and 3) and 12 (ranks 3 and 1) tie exactly, and so do 11 and 14 (rank 2 on one side each): the lower chunk id comes first.
  assert.deepEqual(fused.map(r=>r[0]),[10,12,11,14,13]);assert.equal(fused[0][1],Number((1/61+1/63).toFixed(8)));
  assert.deepEqual(semantic.fuseRrf([lexical,sem],{k:60,weights:[2,1]}).map(r=>r[0]).slice(0,2),[10,12]);
  assert.deepEqual(semantic.fuseRrf([lexical,[]]).map(r=>r[0]),[10,11,12,13]);assert.deepEqual(semantic.fuseRrf([lexical,sem],{depth:1}).map(r=>r[0]),[10,12]);
  assert.deepEqual(semantic.fuseRrf([lexical,sem]),semantic.fuseRrf([lexical,sem]));
});

test('SLOTS keeps the head of the first ranking untouched and fills the rest from the second; nothing is lost, nothing is doubled',()=>{
  const lexical=[[10,9],[11,8],[12,7],[13,1]],sem=[[12,0.9],[14,0.8],[10,0.6]];
  assert.deepEqual(semantic.fuseSlots(lexical,sem,2).map(r=>r[0]),[10,11,12,14,13]);assert.deepEqual(semantic.fuseSlots(lexical,sem,4).map(r=>r[0]),[10,11,12,13,14]);
  assert.deepEqual(semantic.fuseSlots(lexical,sem,0).map(r=>r[0]),[12,14,10,11,13]);assert.deepEqual(semantic.fuseSlots(lexical,[],2).map(r=>r[0]),[10,11,12,13]);
  const index={chunks:[{docIndex:0},{docIndex:0},{docIndex:0},{docIndex:1}]};assert.deepEqual(semantic.shown(index,[[0,1],[1,1],[2,1],[3,1]],3,2),[0,1,3]);
});

test('the module is pure and experimental: no model, no I/O, no learned re-ranker, not wired into the pipeline',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','pipeline','semantic-retriever.js'),'utf8');
  assert.doesNotMatch(source,/require\(|\bfetch\(|process\.env|Date\.now\(|new Date\(|Math\.random\(/u);
  // Owner clarification: one fixed instruction in the model's documented format; the question is passed through unchanged.
  assert.equal(semantic.queryInput('  What is X?  '),'Instruct: Given a maritime regulatory or operational question, retrieve relevant passages that contain the evidence needed to answer the query.\nQuery: What is X?');
  assert.equal(semantic.queryInput('  What is X?  ','INSTRUCTED'),semantic.queryInput('What is X?'));assert.equal(semantic.queryInput('  What is X?  ','RAW'),'What is X?');
  assert.deepEqual(semantic.QUERY_MODES,['RAW','INSTRUCTED']);assert.throws(()=>semantic.queryInput('x','OTHER'),/QUERY_MODE_INVALID/u);
  // The instruction is a constant: no digit, no template slot, nothing taken from a question.
  assert.doesNotMatch(semantic.QUERY_INSTRUCTION,/\d|\$\{|\bSOLAS\b|\bISM\b|\bMARPOL\b/u);assert.equal(Object.isFrozen(semantic.QUERY_MODES),true);
  for(const file of ['grounded-pipeline.js','index.js','citation-support.js','lexical-retriever.js','query-expansion.js'])assert.equal(fs.readFileSync(path.join(__dirname,'..','pipeline',file),'utf8').includes('semantic-retriever'),false,file);
  assert.equal(Object.isFrozen(semantic),true);
});
