'use strict';
// Project 2 Phase 4.10 - semantic ranking and lexical + semantic fusion (pure; EXPERIMENT). Owner directive of 2026-09-19.
//
// Pure arithmetic over vectors somebody else loaded: no model call, no I/O, no clock. The vectors come from
// tools/build-semantic-index.js and live outside the repository. NOT wired into the grounded pipeline: a semantic component
// enters only after a preregistered blind run and a separate Owner GO. The lexical retriever is not replaced; the candidate
// that is measured is a HYBRID whose rule fits in one sentence. No learned or opaque re-ranker.
const VERSION='sinbad-semantic-retriever/0-v1';
// Owner clarification of 2026-09-19. DOCUMENTS: the authoritative chunk text is embedded as it is - no prefix, no title, no
// instruction. QUERIES: the embedding model's documented retrieval format, with ONE fixed instruction. The instruction is a
// constant: it is never adapted to a question and it contains no answer and no fact. Both query modes are measured on DEV
// (RAW and INSTRUCTED) and the one to be used is frozen before the blind run is preregistered.
const QUERY_INSTRUCTION='Given a maritime regulatory or operational question, retrieve relevant passages that contain the evidence needed to answer the query.';
const QUERY_MODES=Object.freeze(['RAW','INSTRUCTED']);
const clean=question=>String(question||'').trim().slice(0,2000);
const queryInput=(question,mode='INSTRUCTED')=>{if(!QUERY_MODES.includes(mode))throw new TypeError('QUERY_MODE_INVALID');return mode==='RAW'?clean(question):`Instruct: ${QUERY_INSTRUCTION}\nQuery: ${clean(question)}`;};

// rank(matrix, dimension, query, limit) -> [[chunkId, cosine]] best first; ties by chunk id. matrix = Float32Array of
// rows*dimension L2-normalised vectors, row r = chunk id r. The query is normalised here, so the score is the cosine.
function rank(matrix,dimension,query,limit=200){
  if(!(matrix instanceof Float32Array)||!Number.isInteger(dimension)||dimension<1||matrix.length%dimension!==0)throw new TypeError('SEMANTIC_MATRIX_INVALID');
  if(!query||query.length!==dimension)throw new TypeError('SEMANTIC_QUERY_INVALID');
  let norm=0;for(let i=0;i<dimension;i+=1){if(!Number.isFinite(query[i]))throw new TypeError('SEMANTIC_QUERY_INVALID');norm+=query[i]*query[i];}
  norm=Math.sqrt(norm);if(!(norm>0))throw new TypeError('SEMANTIC_QUERY_INVALID');
  const rows=matrix.length/dimension;const scores=new Float64Array(rows);
  for(let r=0,o=0;r<rows;r+=1,o+=dimension){let s=0;for(let i=0;i<dimension;i+=1)s+=matrix[o+i]*query[i];scores[r]=s/norm;}
  const ids=Array.from({length:rows},(_,r)=>r).sort((a,b)=>scores[b]-scores[a]||a-b);
  return ids.slice(0,Math.max(1,Math.min(rows,limit))).map(id=>[id,Number(scores[id].toFixed(6))]);
}
// Reciprocal rank fusion: score(chunk) = sum over rankings of weight / (k + rank). One sentence, no training, no scores mixed.
function fuseRrf(rankings,options={}){
  const k=Number.isFinite(options.k)?options.k:60;const weights=Array.isArray(options.weights)?options.weights:rankings.map(()=>1);const depth=Number.isInteger(options.depth)?options.depth:200;
  const score=new Map();
  rankings.forEach((list,li)=>{list.slice(0,depth).forEach(([id],pos)=>{score.set(id,(score.get(id)||0)+weights[li]/(k+pos+1));});});
  return [...score.entries()].sort((a,b)=>b[1]-a[1]||a[0]-b[0]).map(([id,s])=>[id,Number(s.toFixed(8))]);
}
// SLOTS: the first `keep` places are the first ranking untouched; the rest come from the second, skipping what is shown.
function fuseSlots(primary,secondary,keep){
  const out=[];const seen=new Set();for(const [id,s] of primary){if(out.length>=keep)break;out.push([id,s]);seen.add(id);}
  const rest=[];for(const [id,s] of secondary)if(!seen.has(id)){rest.push([id,s]);seen.add(id);}
  for(const [id,s] of primary)if(!seen.has(id)){rest.push([id,s]);seen.add(id);}
  return [...out,...rest];
}
// The passages that would be shown: best first, at most `cap` per document (the same rule the lexical retriever applies).
function shown(index,ranked,passages,cap){
  const per=new Map();const out=[];for(const [id] of ranked){if(out.length>=passages)break;const d=index.chunks[id].docIndex;const used=per.get(d)||0;if(used>=cap)continue;per.set(d,used+1);out.push(id);}return out;
}
module.exports=Object.freeze({VERSION,QUERY_INSTRUCTION,QUERY_MODES,queryInput,rank,fuseRrf,fuseSlots,shown});
