#!/usr/bin/env node
'use strict';
// Phase 4.3a / A3: the capture client. The OWNER runs it (it needs the Owner's own access token) to send the fixed gold
// prompt set once each to the cloud function sinbad-answer and store capture records, in the format the A2 evaluator reads,
// outside the repository.
//
//   node tools/capture-sinbad-answer.js --out <dir> --max-calls <n>                       DRY RUN: plan only, no network
//   node tools/capture-sinbad-answer.js --out <dir> --max-calls <n> --execute --confirm-cloud-calls <n>   real calls
//
// Environment (read here, never stored, never printed): SINBAD_SUPABASE_URL (https://<project>.supabase.co),
// SINBAD_SUPABASE_PUBLISHABLE_KEY, SINBAD_ACCESS_TOKEN (a user JWT of an owner or developer member),
// SINBAD_WORKSPACE_ID. Options: --include-maritime (add the 6-item maritime-reasoning slice), --spacing-ms, --timeout-ms,
// --run-id (default: the start time).
// One call per prompt, sequential, no retry, no web search; it stops on an authentication failure, a rate limit, a
// non-privileged caller or repeated errors. NOTHING IN THE REPOSITORY RUNS THIS AGAINST THE CLOUD: a real run is Phase 4.3a
// A5 and needs its own Owner decision (call ceiling, credentials, who runs it).
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const https=require('node:https');
const C=require('../sinbad-ai-core/shadow/capture-client');
const runner=require('./run-grounded-subset');
const evaluate=require('./evaluate-shadow-capture');
const v0=require('./sinbad-participation');
const core=require('../sinbad-core');
const decision=require('../supabase/functions/sinbad-answer/core-decision');

const ROOT=path.resolve(__dirname,'..');
const MAX_BODY=2*1024*1024+1024;
const fail=code=>new Error(code);

// The only function in the repository that can send the request. It returns plain facts and never an error text that could
// carry a header: failures are reduced to fixed codes.
function realTransport(request,{timeoutMs}){
  return new Promise(resolve=>{
    const started=process.hrtime.bigint();
    const done=extra=>resolve({status:0,text:'',ms:Number(process.hrtime.bigint()-started)/1e6,error:null,...extra});
    let target;try{target=new URL(request.endpoint);}catch{return done({error:'BAD_ENDPOINT'});}
    const client=target.protocol==='https:'?https:http;
    const req=client.request({protocol:target.protocol,hostname:target.hostname,port:target.port||undefined,path:target.pathname,method:'POST',timeout:timeoutMs,
      headers:{...request.headers,'Content-Length':Buffer.byteLength(request.body)}},res=>{
      let text='',size=0,oversized=false;res.setEncoding('utf8');
      res.on('data',d=>{size+=d.length;if(size>MAX_BODY){oversized=true;res.destroy();}else text+=d;});
      res.on('end',()=>done(oversized?{status:res.statusCode,error:'RESPONSE_TOO_LARGE'}:{status:res.statusCode,text}));
      res.on('error',()=>done({status:res.statusCode||0,error:'RESPONSE_STREAM_FAILED'}));
    });
    req.on('timeout',()=>{req.destroy();done({error:'TIMEOUT'});});
    req.on('error',()=>done({error:'CONNECTION_FAILED'}));
    req.end(request.body);
  });
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const stamp=d=>d.toISOString().replace(/[-:]/gu,'').replace(/\.\d+Z$/u,'');

function plannedItems(includeMaritime){
  const g=evaluate.loadGold();
  return runner.plan().filter(p=>p.gating||includeMaritime).map(p=>({id:p.id,category:p.category,prompt:g.byId.get(p.id).prompt}));
}
function parseArgs(argv){
  const flags=new Set(['execute','include-maritime']),out={};
  for(let i=0;i<argv.length;i+=1){
    const a=argv[i];
    if(!a.startsWith('--'))throw fail(`BAD_ARGUMENT:${a}`);
    const key=a.slice(2);
    if(flags.has(key)){out[key]=true;continue;}
    if(i+1>=argv.length||argv[i+1].startsWith('--'))throw fail(`MISSING_VALUE:${key}`);
    out[key]=argv[i+1];i+=1;
  }
  return out;
}
const intOpt=(v,name)=>{if(v===undefined)return undefined;if(!/^\d{1,9}$/u.test(String(v)))throw fail(`BAD_NUMBER:${name}`);return Number(v);};

// main(argv, env, deps) is exported for tests; deps lets a test replace transport, clock and sleep.
async function main(argv,env,deps={}){
  const opts=parseArgs(argv);
  if(!opts.out)throw fail('USAGE: --out <dir outside the repository> --max-calls <n> [--execute --confirm-cloud-calls <n>]');
  const outDir=path.resolve(opts.out);
  v0.assertOutsideRepository(outDir,ROOT,'OUTPUT_INSIDE_REPOSITORY');
  const clock=deps.clock||(()=>new Date());
  const execute=opts.execute===true;
  const checked=C.validateConfig({
    url:env.SINBAD_SUPABASE_URL,publishableKey:execute?env.SINBAD_SUPABASE_PUBLISHABLE_KEY:(env.SINBAD_SUPABASE_PUBLISHABLE_KEY||'unused-in-dry-run'),accessToken:execute?env.SINBAD_ACCESS_TOKEN:(env.SINBAD_ACCESS_TOKEN||'unused-in-dry-run-unused'),
    workspaceId:env.SINBAD_WORKSPACE_ID,runId:opts['run-id']||stamp(clock()).replace('T',''),maxCalls:intOpt(opts['max-calls'],'max-calls'),execute,confirmCalls:intOpt(opts['confirm-cloud-calls'],'confirm-cloud-calls'),
    spacingMs:intOpt(opts['spacing-ms'],'spacing-ms'),timeoutMs:intOpt(opts['timeout-ms'],'timeout-ms')});
  if(!checked.ok)throw fail(`CONFIG_REFUSED:${checked.errors.join(',')}`);
  const items=plannedItems(opts['include-maritime']===true);
  let written=0;
  const writer=record=>{
    if(!fs.existsSync(outDir))fs.mkdirSync(outDir,{recursive:true});
    fs.writeFileSync(path.join(outDir,`${record.captureId}.json`),`${JSON.stringify(record,null,2)}\n`,{encoding:'utf8',flag:'wx'});written+=1;
  };
  const result=await C.runCapture({config:checked.config,items,deps:{
    transport:deps.transport||realTransport,now:()=>clock().getTime(),sleep:deps.sleep||sleep,write:writer,
    detectLanguage:q=>core.detectLanguage(q),makeEnvelope:(q,h)=>core.aiEnvelope(q,h),validateEnvelope:(e,q)=>decision.validateCoreEnvelope(e,q),serverDecision:q=>decision.serverCoreDecision(q)}});
  return result;
}
function report(result){
  const lines=[];
  lines.push(`${result.version}: ${result.mode}; target ${result.endpointHost}; items ${result.items}; ceiling ${result.ceiling}; run ${result.runId}`);
  if(result.refused)lines.push(`REFUSED: ${result.refused}`);
  else if(result.mode==='DRY_RUN'){
    lines.push('DRY RUN: no network call was made and nothing was written.');
    const early=result.plan.filter(p=>p.predictedEarlyExit).length,bad=result.plan.filter(p=>p.envelope!=='VALID').length;
    lines.push(`plan: ${result.plan.length} calls would be made; predicted core-safety early exits ${early}; invalid envelopes ${bad}; languages ${JSON.stringify(result.plan.reduce((a,p)=>({...a,[p.language]:(a[p.language]||0)+1}),{}))}`);
    lines.push(`items: ${result.plan.map(p=>p.itemId).join(' ')}`);
    lines.push('To run for real (Phase 4.3a A5, needs an explicit Owner decision): add --execute --confirm-cloud-calls <same number as --max-calls>.');
  }else{
    lines.push(`calls ${result.calls}; records written ${result.written}; by HTTP status ${JSON.stringify(result.byStatus)}`);
    if(result.aborted)lines.push(`ABORTED: ${result.aborted.reason} at ${result.aborted.itemId}`);
    else lines.push('COMPLETED: every prompt was sent once.');
  }
  return `${lines.join('\n')}\n`;
}
if(require.main===module){
  main(process.argv.slice(2),process.env).then(result=>{
    process.stdout.write(report(result));
    process.exitCode=result.refused?1:result.aborted?2:0;
  }).catch(error=>{process.stderr.write(`${String(error.message)}\n`);process.exitCode=1;});
}
module.exports=Object.freeze({main,report,parseArgs,plannedItems,realTransport});
