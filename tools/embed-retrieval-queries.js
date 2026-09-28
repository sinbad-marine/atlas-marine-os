'use strict';
// Project 2 Phase 4.10 part 2 - embeds the DEV probe QUESTIONS for the semantic retrieval experiment. Owner directive of 2026-09-19.
//
// DEV only: this tool cannot read a blind set (TEST-3 is not authorised) and refuses the used holdouts. Each question is
// embedded twice with the one authorised local model through loopback Ollama: RAW (the question as it is) and INSTRUCTED
// (the model's documented query format with the ONE fixed instruction of semantic-retriever.js). Nothing of a question goes
// into a document embedding and nothing of a document goes into a query. Vectors are written OUTSIDE the repository, next
// to the index they belong to. Every query is embedded COLD: a constant filler is embedded before it, because Ollama's
// prefix cache changes the last digits of a vector whose prompt shares a prefix with the previous one (measured in part 1),
// and the instructed queries all share their first line.
// Run: node tools/embed-retrieval-queries.js --index-dir <semantic index dir outside the repo>
const fs=require('node:fs');
const os=require('node:os');
const http=require('node:http');
const path=require('node:path');
const semantic=require('../sinbad-ai-core/pipeline/semantic-retriever');
const builder=require('./build-semantic-index');
const ROOT=path.resolve(__dirname,'..');
const PROBES=path.join(ROOT,'tests/benchmark/retrieval/probes-v1.json');
const FILLER='.';
const inside=(child,parent)=>{const rel=path.relative(path.resolve(parent),path.resolve(child));return rel===''||(!rel.startsWith('..')&&!path.isAbsolute(rel));};
function parseArgs(argv){
  const args={indexDir:null,ollama:'http://127.0.0.1:11434',split:'DEV'};
  for(let i=0;i<argv.length;i+=1){const a=argv[i],v=argv[i+1];if(a==='--index-dir'){args.indexDir=v;i+=1;}else if(a==='--ollama'){args.ollama=v;i+=1;}else if(a==='--split'){args.split=v;i+=1;}}
  if(args.split!=='DEV')throw new Error('DEV_ONLY: blind and used-holdout sets are not embedded by this tool');
  if(typeof args.indexDir!=='string'||!path.isAbsolute(args.indexDir)||inside(args.indexDir,ROOT))throw new Error('INDEX_DIR_MUST_BE_ABSOLUTE_AND_OUTSIDE_THE_REPOSITORY');
  if(!['127.0.0.1','localhost','[::1]'].includes(new URL(args.ollama).hostname))throw new Error('OLLAMA_MUST_BE_LOOPBACK');
  return args;
}
const post=(base,pathname,body)=>new Promise((resolve,reject)=>{const target=new URL(pathname,base);const text=JSON.stringify(body);
  const req=http.request({host:target.hostname,port:target.port||80,path:target.pathname,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(text)},timeout:300000},res=>{let d='';res.setEncoding('utf8');res.on('data',c=>{d+=c;});res.on('end',()=>{try{resolve(JSON.parse(d));}catch{reject(new Error('OLLAMA_RESPONSE_INVALID'));}});});
  req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('OLLAMA_TIMEOUT')));req.end(text);});
async function main(){
  const args=parseArgs(process.argv.slice(2));if(os.freemem()/2**30<4){process.stdout.write('HOST_MEMORY_LOW. Nothing was run.\n');process.exit(2);}
  const manifest=JSON.parse(fs.readFileSync(path.join(args.indexDir,'manifest.json'),'utf8'));if(manifest.model!==builder.MODEL||manifest.dimension!==builder.DIMENSION)throw new Error('INDEX_MANIFEST_MISMATCH');
  const probes=JSON.parse(fs.readFileSync(PROBES,'utf8')).probes.filter(p=>p.split==='DEV');
  const embed=async input=>{const j=await post(args.ollama,'/api/embed',{model:builder.MODEL,input:[input],truncate:true,keep_alive:'5m',options:{num_ctx:manifest.numCtx}});if(!Array.isArray(j.embeddings)||j.embeddings[0].length!==builder.DIMENSION)throw new Error('EMBED_FAILED');return j.embeddings[0];};
  const out={version:semantic.VERSION,model:builder.MODEL,modelDigest:manifest.modelDigest,split:'DEV',instruction:semantic.QUERY_INSTRUCTION,cold:`a constant filler (${JSON.stringify(FILLER)}) is embedded before every query`,queries:{}};
  for(const p of probes){out.queries[p.id]={};for(const mode of semantic.QUERY_MODES){await embed(FILLER);out.queries[p.id][mode]=await embed(semantic.queryInput(p.question,mode));}process.stdout.write(`${p.id} embedded (RAW, INSTRUCTED)\n`);}
  await post(args.ollama,'/api/generate',{model:builder.MODEL,keep_alive:0}).catch(()=>{});
  const file=path.join(args.indexDir,'queries-dev.json');const tmp=`${file}.tmp`;fs.writeFileSync(tmp,JSON.stringify(out));fs.renameSync(tmp,file);
  process.stdout.write(`${probes.length} DEV questions x ${semantic.QUERY_MODES.length} modes -> ${file}\n`);
}
if(require.main===module)main().catch(e=>{process.stderr.write(`${e.message}\n`);process.exit(1);});
module.exports={parseArgs,FILLER};
