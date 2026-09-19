'use strict';
// Project 2 Phase 4.10 - semantic index builder (EXPERIMENT). Owner directive "EMBEDDING / SEMANTIC RETRIEVAL GO" of 2026-09-19.
//
// Embeds every chunk of the Owner's library with ONE authorised local model (qwen3-embedding:0.6b through loopback Ollama) and
// writes the vectors OUTSIDE the repository. It reads the library index read-only and changes nothing in it: the text that is
// embedded is the exact chunk text - no prefix, no title, no cleaning - because the corpus is authoritative and is not edited
// to make retrieval look better. No cloud, no other model, no network beyond 127.0.0.1.
//
// Identity: row r of shard s is chunk id s*SHARD_ROWS+r in the order lexical-retriever.build() gives (document order, chunk
// order), and every row carries the SHA-256 of the exact chunk text. A reader that finds a different hash refuses the index.
// Resume: a shard is written as <name>.f32.tmp -> .f32, then <name>.json.tmp -> .json; only a shard with a .json is complete,
// so a run can be killed at any moment and started again - finished shards are skipped, an unfinished one is redone.
// Rebuild safety: manifest.json pins the library index (SHA-256, build time, chunk count), the model (name + digest), the
// dimension and the input rule; the tool refuses to continue a directory whose manifest differs, and never deletes anything.
// Host: the Owner's working machine - free-memory floors, a thread cap that leaves half the cores free, a time budget.
// Run: node --max-old-space-size=4096 tools/build-semantic-index.js --out-dir <dir outside the repo> [--limit N] [--budget-seconds S]
const fs=require('node:fs');
const os=require('node:os');
const http=require('node:http');
const path=require('node:path');
const crypto=require('node:crypto');
const retriever=require('../sinbad-ai-core/pipeline/lexical-retriever');

const ROOT=path.resolve(__dirname,'..');
const VERSION='sinbad-semantic-index/0-v1';
const MODEL='qwen3-embedding:0.6b'; // the only model the Owner authorised
const DIMENSION=1024,SHARD_ROWS=128,REQUEST_ROWS=4,NUM_CTX=2048;
const INPUT_RULE='exact chunk text, truncated by the model at NUM_CTX tokens; no prefix, no title, no normalisation';
const DEFAULT_LIBRARY=path.join(os.homedir(),'OneDrive','Belgeler','Sinbad Bridge','Library','.sinbad-index.json');
const START_FLOOR_GB=5,RUN_FLOOR_GB=2.5,YIELD_SECONDS=30;
const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');
const inside=(child,parent)=>{const rel=path.relative(path.resolve(parent),path.resolve(child));return rel===''||(!rel.startsWith('..')&&!path.isAbsolute(rel));};

// Half the cores of THIS host, at most 8 (more threads did not embed faster on the pilot host). A fixed default of 8 was
// refused by the tool's own rule on a 4-core CI runner.
const maxThreads=()=>Math.max(1,Math.floor(os.cpus().length/2));
const defaultThreads=()=>Math.min(8,maxThreads());
function parseArgs(argv){
  const args={outDir:null,library:process.env.SINBAD_LIBRARY_INDEX||DEFAULT_LIBRARY,ollama:'http://127.0.0.1:11434',limit:null,budgetSeconds:null,threads:defaultThreads(),verifySample:0,corpus:null,fullBuildOwnerGo:false};
  for(let i=0;i<argv.length;i+=1){const a=argv[i],v=argv[i+1];
    if(a==='--out-dir'){args.outDir=v;i+=1;}else if(a==='--library'){args.library=v;i+=1;}else if(a==='--ollama'){args.ollama=v;i+=1;}else if(a==='--limit'){args.limit=Number(v);i+=1;}
    else if(a==='--budget-seconds'){args.budgetSeconds=Number(v);i+=1;}else if(a==='--threads'){args.threads=Number(v);i+=1;}else if(a==='--verify-sample'){args.verifySample=Number(v);i+=1;}else if(a==='--corpus'){args.corpus=v;i+=1;}else if(a==='--full-build-owner-go')args.fullBuildOwnerGo=true;}
  if(typeof args.outDir!=='string'||!path.isAbsolute(args.outDir))throw new Error('OUT_DIR_MUST_BE_ABSOLUTE');
  if(inside(args.outDir,ROOT))throw new Error('OUT_DIR_MUST_BE_OUTSIDE_THE_REPOSITORY');
  if(inside(args.outDir,path.dirname(args.library)))throw new Error('OUT_DIR_MUST_NOT_BE_INSIDE_THE_LIBRARY');
  if(!['127.0.0.1','localhost','[::1]'].includes(new URL(args.ollama).hostname))throw new Error('OLLAMA_MUST_BE_LOOPBACK');
  if(args.limit!==null&&(!Number.isInteger(args.limit)||args.limit<1))throw new Error('LIMIT_INVALID');
  // The full library costs days of CPU on the Owner's machine and is ON HOLD (Owner directive of 2026-09-19, Phase 4.10 part 2).
  // A run without --limit and without --corpus is the full build: it is refused unless --full-build-owner-go is given.
  // THE FLAG IS A TECHNICAL INTERLOCK, NOT AN AUTHORISATION. It exists so that the full build cannot start by accident or by a
  // convenient default. It grants nothing by itself: the full build may be started only when the Owner has separately and
  // explicitly given a GO for it, and whoever types the flag without that GO acts without authority.
  if(args.limit===null&&args.corpus===null&&!args.fullBuildOwnerGo)throw new Error('FULL_BUILD_IS_ON_HOLD');
  if(args.corpus!==null&&args.limit!==null)throw new Error('CORPUS_AND_LIMIT_EXCLUDE_EACH_OTHER');
  if(args.budgetSeconds!==null&&(!Number.isFinite(args.budgetSeconds)||args.budgetSeconds<30))throw new Error('BUDGET_INVALID');
  if(!Number.isInteger(args.threads)||args.threads<1||args.threads>maxThreads())throw new Error('THREADS_MUST_LEAVE_HALF_THE_CORES_FREE');
  if(!Number.isInteger(args.verifySample)||args.verifySample<0||args.verifySample>64)throw new Error('VERIFY_SAMPLE_INVALID');
  return args;
}
const request=(base,method,pathname,body,timeout)=>new Promise((resolve,reject)=>{const target=new URL(pathname,base);const text=body?JSON.stringify(body):null;
  const req=http.request({host:target.hostname,port:target.port||80,path:target.pathname,method,headers:text?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(text)}:{},timeout},res=>{let d='';res.setEncoding('utf8');res.on('data',c=>{d+=c;});res.on('end',()=>{try{resolve(JSON.parse(d));}catch{reject(new Error(`OLLAMA_RESPONSE_INVALID ${d.slice(0,120)}`));}});});
  req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('OLLAMA_TIMEOUT')));req.end(text||undefined);});
const shardName=n=>`shard-${String(n).padStart(5,'0')}`;
const atomicWrite=(file,data)=>{const tmp=`${file}.tmp`;fs.writeFileSync(tmp,data);fs.renameSync(tmp,file);};
const toBuffer=vectors=>{const out=Buffer.alloc(vectors.length*DIMENSION*4);vectors.forEach((v,r)=>{if(!Array.isArray(v)||v.length!==DIMENSION)throw new Error('EMBEDDING_DIMENSION_MISMATCH');for(let i=0;i<DIMENSION;i+=1){if(!Number.isFinite(v[i]))throw new Error('EMBEDDING_NOT_FINITE');out.writeFloatLE(v[i],(r*DIMENSION+i)*4);}});return out;};
// A shard is complete when its .json exists, names the same rows and hashes, and its .f32 has the right size.
function shardComplete(dir,n,hashes){
  const j=path.join(dir,`${shardName(n)}.json`),f=path.join(dir,`${shardName(n)}.f32`);if(!fs.existsSync(j)||!fs.existsSync(f))return false;
  let meta;try{meta=JSON.parse(fs.readFileSync(j,'utf8'));}catch{return false;}
  return meta.shard===n&&meta.rows===hashes.length&&fs.statSync(f).size===hashes.length*DIMENSION*4&&Array.isArray(meta.contentHashes)&&meta.contentHashes.length===hashes.length&&meta.contentHashes.every((h,i)=>h===hashes[i]);
}
// Throughput is rows actually embedded over the time actually spent embedding them. (It was the number of finished shards
// times the shard size over the whole run: a short final shard counted as a full one, and index loading and skipped shards
// counted as embedding time.)
function throughput({rowsBuilt,tokens,embedSeconds}){
  if(!(rowsBuilt>0)||!(embedSeconds>0))return {chunksPerSecond:null,tokensPerSecond:null};
  return {chunksPerSecond:Number((rowsBuilt/embedSeconds).toFixed(3)),tokensPerSecond:Math.round(tokens/embedSeconds)};
}
// A bounded corpus is a list of WHOLE library documents named by title, each pinned by its chunk count and by the SHA-256 over
// its chunk hashes. Nothing is copied: the text still comes from the library, and a library that changed is refused.
function documentSha256(doc){return sha256((doc.chunks||[]).filter(c=>typeof c==='string'&&c.trim()).map(c=>sha256(c)).join('\n'));}
function loadCorpus(file,documents,librarySha256){
  const text=fs.readFileSync(path.resolve(ROOT,file),'utf8');const corpus=JSON.parse(text);
  if(corpus.version!=='sinbad-retrieval-corpus/1'||!Array.isArray(corpus.documents)||!corpus.documents.length)throw new Error('CORPUS_INVALID');
  if(corpus.librarySha256!==librarySha256)throw new Error('CORPUS_MISMATCH: the corpus was defined on another library index');
  // The library holds some titles twice. A corpus entry is the FIRST document with that title whose content matches the pinned
  // hash, so identity is title + content, never position alone.
  const byTitle=new Map();for(const d of documents){if(!byTitle.has(d.title))byTitle.set(d.title,[]);byTitle.get(d.title).push(d);}
  const picked=corpus.documents.map(entry=>{const d=(byTitle.get(entry.title)||[]).find(x=>documentSha256(x)===entry.documentSha256);
    if(!d)throw new Error(`CORPUS_MISMATCH: ${entry.title} is missing or changed`);return d;});
  if(new Set(picked).size!==picked.length)throw new Error('CORPUS_INVALID: a document is listed twice');
  return {name:String(corpus.name),sha256:sha256(text.replace(/\r\n/g,'\n')).slice(0,16),documents:picked};
}
function cosine(a,b){let s=0,na=0,nb=0;for(let i=0;i<a.length;i+=1){s+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i];}return s/Math.sqrt(na*nb);}

async function main(){
  const args=parseArgs(process.argv.slice(2));const freeGb=()=>os.freemem()/2**30;const began=Date.now();
  if(freeGb()<START_FLOOR_GB){process.stdout.write(`HOST_MEMORY_LOW: ${freeGb().toFixed(1)} GB free, ${START_FLOOR_GB} needed to start. Nothing was run.\n`);process.exit(2);}
  const tags=await request(args.ollama,'GET','/api/tags',null,30000);const tag=(tags.models||[]).find(m=>m.name===MODEL);if(!tag)throw new Error('AUTHORISED_MODEL_NOT_INSTALLED');
  const text=fs.readFileSync(args.library,'utf8');const librarySha256=sha256(text);const raw=JSON.parse(text.replace(/^﻿/u,''));
  const corpus=args.corpus===null?null:loadCorpus(args.corpus,raw.documents||[],librarySha256);
  const index=retriever.build(corpus?corpus.documents:raw.documents||[]);
  const total=args.limit===null?index.chunks.length:Math.min(args.limit,index.chunks.length);
  const manifest={version:VERSION,model:MODEL,modelDigest:tag.digest,dimension:DIMENSION,shardRows:SHARD_ROWS,inputRule:INPUT_RULE,numCtx:NUM_CTX,chunkOrder:retriever.VERSION,
    library:{sha256:librarySha256,builtAt:raw.builtAt||null,chunks:index.chunks.length,documents:index.documentCount},scope:corpus?`CORPUS ${corpus.name} ${corpus.sha256}`:args.limit===null?'FULL':`PILOT first ${total} chunks`};
  fs.mkdirSync(args.outDir,{recursive:true});const manifestPath=path.join(args.outDir,'manifest.json');
  if(fs.existsSync(manifestPath)){const prior=JSON.parse(fs.readFileSync(manifestPath,'utf8'));const same=k=>JSON.stringify(prior[k])===JSON.stringify(manifest[k]);
    if(!['version','model','modelDigest','dimension','shardRows','inputRule','numCtx','chunkOrder','library','scope'].every(same))throw new Error('MANIFEST_MISMATCH: this directory holds an index of another library, model or scope. Nothing was changed. Use a new --out-dir.');}
  else atomicWrite(manifestPath,`${JSON.stringify({...manifest,createdAt:new Date().toISOString()},null,2)}\n`);
  const shards=Math.ceil(total/SHARD_ROWS);let built=0,skipped=0,tokens=0,stopped=null,rowsBuilt=0,embedSeconds=0;let peakRssGb=0;let yieldedSeconds=0;
  for(let n=0;n<shards;n+=1){
    const first=n*SHARD_ROWS,rows=Math.min(SHARD_ROWS,total-first);const hashes=[];for(let r=0;r<rows;r+=1)hashes.push(sha256(index.chunks[first+r].text));
    if(shardComplete(args.outDir,n,hashes)){skipped+=1;continue;}
    if(args.budgetSeconds!==null&&(Date.now()-began)/1000>args.budgetSeconds){stopped='TIME_BUDGET';break;}
    if(freeGb()<RUN_FLOOR_GB){stopped='HOST_MEMORY_LOW';break;}
    const vectors=[];const t0=Date.now();
    for(let r=0;r<rows;r+=REQUEST_ROWS){
      // Yield: while any OTHER model is resident in Ollama (the bridge answering, a grounded run), this job waits. A build
      // of several days must not slow the Owner's own use of the machine or distort somebody else's latency measurement.
      for(;;){const ps=await request(args.ollama,'GET','/api/ps',null,30000).catch(()=>({models:[]}));const others=(ps.models||[]).filter(m=>m.name!==MODEL).map(m=>m.name);if(!others.length)break;
        yieldedSeconds+=YIELD_SECONDS;process.stdout.write(`yielding to ${others.join(', ')}\n`);await new Promise(resolve=>setTimeout(resolve,YIELD_SECONDS*1000));}
      const input=index.chunks.slice(first+r,first+Math.min(rows,r+REQUEST_ROWS)).map(c=>c.text);
      const j=await request(args.ollama,'POST','/api/embed',{model:MODEL,input,truncate:true,keep_alive:'10m',options:{num_ctx:NUM_CTX,num_thread:args.threads}},600000);
      if(!Array.isArray(j.embeddings)||j.embeddings.length!==input.length)throw new Error(`EMBED_FAILED ${JSON.stringify(j).slice(0,160)}`);
      vectors.push(...j.embeddings);tokens+=j.prompt_eval_count||0;
    }
    const buffer=toBuffer(vectors);atomicWrite(path.join(args.outDir,`${shardName(n)}.f32`),buffer);
    atomicWrite(path.join(args.outDir,`${shardName(n)}.json`),`${JSON.stringify({shard:n,firstChunkId:first,rows,vectorsSha256:sha256(buffer),contentHashes:hashes})}\n`);
    built+=1;rowsBuilt+=rows;embedSeconds+=(Date.now()-t0)/1000;peakRssGb=Math.max(peakRssGb,process.memoryUsage().rss/2**30);
    process.stdout.write(`${shardName(n)} rows ${rows} in ${((Date.now()-t0)/1000).toFixed(0)} s | done ${Math.min(total,first+rows)}/${total} | free ${freeGb().toFixed(1)} GB\n`);
  }
  // Rebuild check: embed a few stored chunks again and compare. A prefix-cache hit changes the last digits, so the test is a cosine.
  let verify=null;
  if(args.verifySample>0&&!stopped){const ids=[];for(let k=0;k<args.verifySample;k+=1)ids.push(Math.floor((k+0.5)*total/args.verifySample));let min=1;
    for(const id of ids){const n=Math.floor(id/SHARD_ROWS),r=id%SHARD_ROWS;const buf=fs.readFileSync(path.join(args.outDir,`${shardName(n)}.f32`));const stored=new Float32Array(buf.buffer,buf.byteOffset+r*DIMENSION*4,DIMENSION);
      const j=await request(args.ollama,'POST','/api/embed',{model:MODEL,input:[index.chunks[id].text],truncate:true,keep_alive:'10m',options:{num_ctx:NUM_CTX,num_thread:args.threads}},600000);min=Math.min(min,cosine(stored,j.embeddings[0]));}
    verify={sampled:ids.length,minCosine:Number(min.toFixed(6)),ok:min>=0.999};}
  await request(args.ollama,'POST','/api/generate',{model:MODEL,keep_alive:0},60000).catch(()=>{});
  const seconds=(Date.now()-began)/1000;const rate=throughput({rowsBuilt,tokens,embedSeconds});
  const summary={outDir:args.outDir,scope:manifest.scope,shards,built,skipped,complete:built+skipped===shards&&!stopped,stopped,seconds:Math.round(seconds),tokens,rowsBuilt,embedSeconds:Math.round(embedSeconds),tokensPerSecond:rate.tokensPerSecond,chunksPerSecond:rate.chunksPerSecond,
    bytesPerChunk:DIMENSION*4,projectedFullIndexMb:Math.round(index.chunks.length*DIMENSION*4/2**20),peakRssGb:Number(peakRssGb.toFixed(2)),yieldedSeconds,freeGbAtEnd:Number(freeGb().toFixed(1)),verify};
  process.stdout.write(`${JSON.stringify(summary,null,1)}\n`);
  process.exit(stopped==='TIME_BUDGET'?3:stopped?2:verify&&!verify.ok?4:0);
}
if(require.main===module)main().catch(e=>{process.stderr.write(`${e.message}\n`);process.exit(1);});
module.exports={VERSION,MODEL,DIMENSION,SHARD_ROWS,INPUT_RULE,parseArgs,shardComplete,shardName,toBuffer,cosine,throughput,documentSha256,loadCorpus};
