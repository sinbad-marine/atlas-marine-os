'use strict';
// Project 2 Phase 4.10 - the semantic index builder keeps the Owner's boundaries: one authorised local model, loopback only,
// vectors outside the repository, the chunk text embedded exactly as it is, resumable and refusing a foreign directory.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const builder=require('../tools/build-semantic-index');
const ROOT=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(ROOT,'tools/build-semantic-index.js'),'utf8');
const OUT=path.join(os.tmpdir(),'sinbad-semantic-index-test');

test('vectors never land in the repository or in the library; the model endpoint is loopback; half the cores stay free',()=>{
  assert.throws(()=>builder.parseArgs([]),/OUT_DIR_MUST_BE_ABSOLUTE/u);assert.throws(()=>builder.parseArgs(['--out-dir','relative/dir']),/OUT_DIR_MUST_BE_ABSOLUTE/u);
  for(const inside of [ROOT,path.join(ROOT,'tests','benchmark','results','X'),path.join(ROOT,'..',path.basename(ROOT),'tmp')])assert.throws(()=>builder.parseArgs(['--out-dir',inside]),/OUT_DIR_MUST_BE_OUTSIDE_THE_REPOSITORY/u,inside);
  const library=path.join(os.tmpdir(),'lib','index.json');assert.throws(()=>builder.parseArgs(['--out-dir',path.join(os.tmpdir(),'lib','vectors'),'--library',library]),/OUT_DIR_MUST_NOT_BE_INSIDE_THE_LIBRARY/u);
  assert.throws(()=>builder.parseArgs(['--out-dir',OUT,'--ollama','http://10.0.0.5:11434']),/OLLAMA_MUST_BE_LOOPBACK/u);assert.throws(()=>builder.parseArgs(['--out-dir',OUT,'--ollama','https://api.example.com']),/OLLAMA_MUST_BE_LOOPBACK/u);
  // On any host: the default is accepted by the tool's own rule, never exceeds half the cores or 8, and one more than half is refused.
  const half=Math.max(1,Math.floor(os.cpus().length/2));
  assert.throws(()=>builder.parseArgs(['--out-dir',OUT,'--threads',String(half+1)]),/THREADS_MUST_LEAVE_HALF_THE_CORES_FREE/u);assert.throws(()=>builder.parseArgs(['--out-dir',OUT,'--threads','0']),/THREADS_MUST_LEAVE_HALF_THE_CORES_FREE/u);
  assert.throws(()=>builder.parseArgs(['--out-dir',OUT,'--limit','0']),/LIMIT_INVALID/u);
  const ok=builder.parseArgs(['--out-dir',OUT,'--limit','256']);assert.equal(ok.limit,256);assert.equal(ok.threads,Math.min(8,half));assert.equal(builder.parseArgs(['--out-dir',OUT,'--threads','1']).threads,1);
});

test('one authorised model, no cloud, and the chunk text is embedded exactly as it is',()=>{
  assert.equal(builder.MODEL,'qwen3-embedding:0.6b');assert.equal(builder.DIMENSION,1024);assert.match(builder.INPUT_RULE,/^exact chunk text.*no prefix, no title, no normalisation$/u);
  assert.equal([...source.matchAll(/model:MODEL/gu)].length,[...source.matchAll(/model:/gu)].length);assert.doesNotMatch(source,/args\.model|--model/u);
  assert.doesNotMatch(source,/node:https|\bfetch\(|child_process|api\.openai|supabase|huggingface|cohere|voyage/iu);
  // What goes to the model is c.text and nothing else: no template, no title, no instruction on the document side.
  assert.match(source,/\.map\(c=>c\.text\)/u);assert.match(source,/input:\[index\.chunks\[id\]\.text\]/u);assert.doesNotMatch(source,/Instruct:|queryInput|\$\{c\.title\}|c\.title\s*\+/u);
  // It reads the library and writes only under --out-dir, atomically; it deletes nothing.
  assert.doesNotMatch(source,/unlinkSync|rmSync|rmdirSync|truncateSync/u);assert.equal([...source.matchAll(/writeFileSync\(/gu)].length,1);assert.match(source,/const atomicWrite=\(file,data\)=>\{const tmp=`\$\{file\}\.tmp`;fs\.writeFileSync\(tmp,data\);fs\.renameSync\(tmp,file\);\};/u);
  assert.equal([...source.matchAll(/atomicWrite\(/gu)].length,3);for(const m of source.matchAll(/atomicWrite\(([^,]+),/gu))assert.match(m[1],/^(?:manifestPath|path\.join\(args\.outDir)$/u,m[1]);
  // It yields to any other model resident in Ollama (the bridge answering, a grounded run) instead of competing with it.
  assert.match(source,/const others=\(ps\.models\|\|\[\]\)\.filter\(m=>m\.name!==MODEL\)/u);assert.match(source,/if\(!others\.length\)break;/u);
  assert.match(source,/MANIFEST_MISMATCH/u);assert.equal([...source.matchAll(/keep_alive:0/gu)].length,1);assert.match(source,/\{model:MODEL,keep_alive:0\}/u);
});

test('a shard counts as complete only with its json, the right size and the same chunk hashes in the same order',()=>{
  fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
  const hashes=['a','b','c'].map(t=>crypto.createHash('sha256').update(t).digest('hex'));const vectors=hashes.map((_,r)=>Array.from({length:builder.DIMENSION},(__,i)=>(r+1)*(i%7)/10));
  const buffer=builder.toBuffer(vectors);assert.equal(buffer.length,3*builder.DIMENSION*4);assert.equal(new Float32Array(buffer.buffer,buffer.byteOffset,builder.DIMENSION*3)[builder.DIMENSION+1],Math.fround(0.2));
  const f=path.join(OUT,`${builder.shardName(0)}.f32`),j=path.join(OUT,`${builder.shardName(0)}.json`);assert.equal(builder.shardName(7),'shard-00007');
  assert.equal(builder.shardComplete(OUT,0,hashes),false);
  fs.writeFileSync(f,buffer);assert.equal(builder.shardComplete(OUT,0,hashes),false,'vectors without a json are not a shard');
  fs.writeFileSync(j,JSON.stringify({shard:0,firstChunkId:0,rows:3,contentHashes:hashes}));assert.equal(builder.shardComplete(OUT,0,hashes),true);
  assert.equal(builder.shardComplete(OUT,0,[hashes[1],hashes[0],hashes[2]]),false,'same chunks in another order are another shard');assert.equal(builder.shardComplete(OUT,0,hashes.slice(0,2)),false);
  fs.writeFileSync(f,buffer.subarray(0,100));assert.equal(builder.shardComplete(OUT,0,hashes),false,'a truncated vector file is not a shard');
  fs.writeFileSync(f,buffer);fs.writeFileSync(j,'{not json');assert.equal(builder.shardComplete(OUT,0,hashes),false);
  assert.throws(()=>builder.toBuffer([[1,2,3]]),/EMBEDDING_DIMENSION_MISMATCH/u);assert.throws(()=>builder.toBuffer([Array.from({length:builder.DIMENSION},()=>NaN)]),/EMBEDDING_NOT_FINITE/u);
  assert.equal(Number(builder.cosine([1,0],[2,0]).toFixed(6)),1);assert.equal(Number(builder.cosine([1,0],[0,3]).toFixed(6)),0);
  fs.rmSync(OUT,{recursive:true,force:true});
});

test('no semantic component is wired: the pipeline, the service and the runner do not know the builder or the semantic module',()=>{
  for(const file of ['sinbad-ai-core/pipeline/grounded-pipeline.js','sinbad-ai-core/pipeline/index.js','tools/sinbad-grounded-service.js','tools/run-grounded-subset.js'])
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT,file),'utf8'),/semantic-retriever|build-semantic-index|qwen3-embedding|api\/embed/u,file);
});
