'use strict';
// Project 2 Phase 4.9 - generates query expansions for retrieval probes with a small LOCAL model. Owner directive of 2026-09-19.
//
// The only tool of this phase that calls a model: loopback Ollama, nothing else. It looks at no retrieval result; it writes
// the raw model output and the verdict of the deterministic check (sinbad-ai-core/pipeline/query-expansion.js) to one file,
// so that every fusion experiment afterwards runs without a model and is repeatable. The host is the Owner's working
// machine: it refuses to start below a free-memory floor, stops mid-run below a lower one, never touches a model it did
// not load, and unloads its own model when it ends. The blind set is only processed with --final and a preregistration.
// Run: node tools/generate-query-expansions.js --split DEV --out tests/benchmark/results/<RUN>/expansions.json
const fs=require('node:fs');
const os=require('node:os');
const http=require('node:http');
const path=require('node:path');
const expansion=require('../sinbad-ai-core/pipeline/query-expansion');

const ROOT=path.resolve(__dirname,'..');
const PROBES=path.join(ROOT,'tests/benchmark/retrieval/probes-v1.json');
const PROBES_TEST2=path.join(ROOT,'tests/benchmark/retrieval/probes-test2-v1.json');
const START_FLOOR_GB=6,RUN_FLOOR_GB=2.5;

function parseArgs(argv){
  const args={split:null,out:null,model:'qwen3:4b',ollama:'http://127.0.0.1:11434',final:false,preregistration:null,think:false,predict:120,resume:false,budgetSeconds:520,startFloorGb:START_FLOOR_GB};
  for(let i=0;i<argv.length;i+=1){const a=argv[i],v=argv[i+1];
    if(a==='--split'){args.split=v;i+=1;}else if(a==='--out'){args.out=v;i+=1;}else if(a==='--model'){args.model=v;i+=1;}else if(a==='--ollama'){args.ollama=v;i+=1;}else if(a==='--preregistration'){args.preregistration=v;i+=1;}else if(a==='--predict'){args.predict=Number(v);i+=1;}else if(a==='--budget-seconds'){args.budgetSeconds=Number(v);i+=1;}else if(a==='--start-floor-gb'){args.startFloorGb=Number(v);i+=1;}else if(a==='--final')args.final=true;else if(a==='--think')args.think=true;else if(a==='--resume')args.resume=true;}
  if(!Number.isInteger(args.predict)||args.predict<40||args.predict>4000)throw new Error('PREDICT_INVALID');
  if(!Number.isFinite(args.budgetSeconds)||args.budgetSeconds<30)throw new Error('BUDGET_INVALID');
  if(!['DEV','TEST2'].includes(args.split))throw new Error('SPLIT_MUST_BE_DEV_OR_TEST2');
  if(typeof args.out!=='string'||!args.out.endsWith('.json'))throw new Error('OUT_REQUIRED');
  if(!['127.0.0.1','localhost','[::1]'].includes(new URL(args.ollama).hostname))throw new Error('OLLAMA_MUST_BE_LOOPBACK');
  if(args.split==='TEST2'&&(!args.final||typeof args.preregistration!=='string'))throw new Error('BLIND_SET_NEEDS_FINAL_AND_PREREGISTRATION');
  return args;
}
const post=(base,pathname,body,timeout)=>new Promise((resolve,reject)=>{const target=new URL(pathname,base);const text=JSON.stringify(body);
  const req=http.request({host:target.hostname,port:target.port||80,path:target.pathname,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(text)},timeout},res=>{let d='';res.setEncoding('utf8');res.on('data',c=>{d+=c;});res.on('end',()=>{try{resolve(JSON.parse(d));}catch(e){reject(e);}});});
  req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('TIMEOUT')));req.end(text);});

async function main(){
  const args=parseArgs(process.argv.slice(2));const freeGb=()=>os.freemem()/2**30;
  if(args.split==='TEST2'&&!fs.existsSync(path.resolve(ROOT,args.preregistration)))throw new Error('PREREGISTRATION_NOT_FOUND');
  // The floor can only be raised (a 14B model needs about 10.5 GB while it answers), never lowered below the default.
  const startFloor=Math.max(START_FLOOR_GB,Number.isFinite(args.startFloorGb)?args.startFloorGb:START_FLOOR_GB);
  if(freeGb()<startFloor){process.stdout.write(`HOST_MEMORY_LOW: ${freeGb().toFixed(1)} GB free, ${startFloor} needed to start. Nothing was run.\n`);process.exit(2);}
  const set=JSON.parse(fs.readFileSync(args.split==='TEST2'?PROBES_TEST2:PROBES,'utf8'));const probes=set.probes.filter(p=>p.split===args.split);
  const file=path.resolve(ROOT,args.out);const options={temperature:0,seed:7,num_ctx:4096,num_predict:args.predict,think:args.think};
  // A thinking-only model cannot be told not to think: with --think its reasoning is kept apart by Ollama (message.thinking)
  // and only message.content is read. The reasoning is never stored, never searched with and never shown.
  let out={version:expansion.VERSION,model:args.model,split:args.split,options,system:expansion.SYSTEM,expansions:{}};let stopped=null;const began=Date.now();
  if(args.resume&&fs.existsSync(file)){const prior=JSON.parse(fs.readFileSync(file,'utf8'));if(prior.model!==args.model||prior.split!==args.split||JSON.stringify(prior.options)!==JSON.stringify(options))throw new Error('RESUME_FILE_DOES_NOT_MATCH');out=prior;}
  for(const p of probes){
    if(out.expansions[p.id]&&out.expansions[p.id].error===null)continue;
    if((Date.now()-began)/1000>args.budgetSeconds){stopped=`TIME_BUDGET at ${p.id} - rerun with --resume`;break;}
    if(freeGb()<RUN_FLOOR_GB){stopped=`HOST_MEMORY_LOW at ${p.id}`;break;}
    let raw=null,error=null;const started=Date.now();
    try{const j=await post(args.ollama,'/api/chat',{model:args.model,stream:false,think:args.think,keep_alive:'5m',options:{temperature:0,seed:7,num_ctx:4096,num_predict:args.predict,use_mmap:false},messages:expansion.messages(p.question)},600000);raw=String(j.message&&j.message.content||'');if(j.done_reason==='length'&&!raw.trim())error='TOKEN_BUDGET_EXHAUSTED_WHILE_THINKING';}
    catch(e){error=String(e&&e.message||e);}
    const verdict=raw===null?{valid:false,queries:[],reason:'MODEL_ERROR'}:error?{valid:false,queries:[],reason:error}:expansion.check(p.question,raw);if(error==='TOKEN_BUDGET_EXHAUSTED_WHILE_THINKING')error=null;
    out.expansions[p.id]={raw,error,valid:verdict.valid,reason:verdict.reason,queries:verdict.queries,ms:Date.now()-started};
    process.stdout.write(`${p.id} ${verdict.valid?'VALID  ':'INVALID'} ${verdict.reason||''} | ${String(raw||error).replace(/\s+/gu,' ').slice(0,150)}\n`);
  }
  await post(args.ollama,'/api/generate',{model:args.model,keep_alive:0},60000).catch(()=>{});
  const rows=Object.values(out.expansions);out.summary={probes:probes.length,generated:rows.length,valid:rows.filter(r=>r.valid).length,invalidReasons:rows.filter(r=>!r.valid).reduce((m,r)=>{m[r.reason]=(m[r.reason]||0)+1;return m;},{}),stopped};
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,`${JSON.stringify(out,null,2)}\n`);
  process.stdout.write(`${args.split}: ${out.summary.valid}/${out.summary.generated} valid of ${probes.length}${stopped?` - STOPPED: ${stopped}`:''}; free ${freeGb().toFixed(1)} GB\n`);
  if(stopped)process.exit(stopped.startsWith('TIME_BUDGET')?3:2);
}
if(require.main===module)main().catch(e=>{process.stderr.write(`${e.message}\n`);process.exit(1);});
module.exports={parseArgs,START_FLOOR_GB,RUN_FLOOR_GB};
