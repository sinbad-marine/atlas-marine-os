'use strict';
// Project 2 Phase 4.6 - lexical retriever (pure, deterministic BM25 over documents held in memory).
// Owner delegation of 2026-09-19.
//
// The running bridge searches the same library but hands out no identity for what it found, so
// nothing downstream can check a citation. This retriever returns every passage WITH its identity:
// a stable evidence id, a locator, the SHA-256 of the exact chunk text, and the [S#] marker under
// which it is shown to the model. It performs no I/O (the caller loads the index and passes the
// documents in), reads no clock, keeps no state outside the index object it returns.
const {sha256}=require('../sentinel/sentinel-v0');

const VERSION='sinbad-lexical-retriever/0-v1';
const K1=1.2,B=0.75,MAX_PASSAGES=8,MAX_PER_DOCUMENT=2,MAX_QUERY_TERMS=48;
const STOP=new Set(['the','and','for','are','with','that','this','from','was','were','has','have','had','not','but','you','your','its','can','will','shall','may','what','which','who','how','why','when','where','does','did','into','than','then','them','they','their','there','here','about','also','any','all','our','out','per','via','bir','ve','ile','icin','için','bu','da','de','mi','mı','mu','mü','ne','nedir','nasıl','olan','olarak','veya','ya','ki','en','çok','gibi','daha','her','hangi']);
const tokenize=text=>(String(text||'').toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]{2,}/gu)||[]).filter(t=>!STOP.has(t));

// build(documents) with documents = [{title, chunks:[string]}] -> frozen index.
function build(documents){
  if(!Array.isArray(documents))throw new TypeError('RETRIEVER_DOCUMENTS_REQUIRED');
  const chunks=[];const postings=new Map();let totalLength=0;
  for(const [docIndex,doc] of documents.entries()){
    if(!doc||typeof doc.title!=='string'||!Array.isArray(doc.chunks))continue;
    for(const [chunkIndex,text] of doc.chunks.entries()){
      if(typeof text!=='string'||!text.trim())continue;
      const terms=tokenize(text);if(!terms.length)continue;
      const id=chunks.length;chunks.push({docIndex,chunkIndex,title:doc.title,text,length:terms.length});totalLength+=terms.length;
      const tf=new Map();for(const t of terms)tf.set(t,(tf.get(t)||0)+1);
      for(const [t,n] of tf){let list=postings.get(t);if(!list){list=[];postings.set(t,list);}list.push(id,n);}
    }
  }
  return Object.freeze({version:VERSION,chunks,postings,averageLength:chunks.length?totalLength/chunks.length:0,documentCount:documents.length});
}
const slug=text=>String(text).normalize('NFKD').replace(/[^A-Za-z0-9]+/gu,'-').replace(/^-+|-+$/gu,'').slice(0,40)||'doc';

// search(index, query, limit) -> [{marker, evidenceId, locatorRef, contentHash, title, chunkIndex, score, text}]
function search(index,query,limit=6){
  if(!index||index.version!==VERSION)throw new TypeError('RETRIEVER_INDEX_INVALID');
  const terms=[...new Set(tokenize(query))].slice(0,MAX_QUERY_TERMS);const wanted=Math.max(1,Math.min(MAX_PASSAGES,Number.isInteger(limit)?limit:6));
  const scores=new Map();const N=index.chunks.length;
  for(const term of terms){
    const list=index.postings.get(term);if(!list)continue;
    const df=list.length/2,idf=Math.log(1+(N-df+0.5)/(df+0.5));
    for(let i=0;i<list.length;i+=2){const id=list[i],tf=list[i+1],len=index.chunks[id].length;
      scores.set(id,(scores.get(id)||0)+idf*(tf*(K1+1))/(tf+K1*(1-B+B*len/index.averageLength)));}
  }
  // Deterministic order: score, then document and chunk position.
  const ranked=[...scores.entries()].sort((a,b)=>b[1]-a[1]||a[0]-b[0]);
  const perDocument=new Map();const picked=[];
  for(const [id,score] of ranked){const c=index.chunks[id];const used=perDocument.get(c.docIndex)||0;if(used>=MAX_PER_DOCUMENT)continue;perDocument.set(c.docIndex,used+1);picked.push({c,score});if(picked.length===wanted)break;}
  return picked.map(({c,score},i)=>{
    const contentHash=sha256(c.text);
    return Object.freeze({marker:`S${i+1}`,evidenceId:`lib.${slug(c.title)}.${contentHash.slice(0,12)}.c${c.chunkIndex}`,locatorRef:`library:${slug(c.title)}:chunk-${c.chunkIndex}`,contentHash,title:c.title,chunkIndex:c.chunkIndex,score:Number(score.toFixed(4)),text:c.text});
  });
}
module.exports=Object.freeze({VERSION,MAX_PASSAGES,MAX_PER_DOCUMENT,tokenize,build,search});
