#!/usr/bin/env node
'use strict';
// Project 2 Phase 4.7 - run the stage-gate subset against the grounded service and score it.
// A separate tool on purpose: the frozen harness (tools/run-sinbad-benchmark.js) is not modified. It reuses, read
// only, the frozen gold sets, the accepted v1.0.1 detectors and gold overlay, and scoring v1.0.2.
// For every prompt it stores the delivered answer, the gate record and the transcript digest; each transcript is
// verified with chain.verifyTranscript before its record is trusted. Local only: it talks to a loopback service.
// Run: node tools/run-grounded-subset.js --run-id GROUNDED-001 [--base-url http://127.0.0.1:31990] [--limit n] [--resume] [--only ID]
// --only ID (2026-09-21, D6 "CT-03 live measurement only" GO): restricts the plan to exactly one item id,
// for a narrowly-scoped live measurement without touching the other 35 gating/maritime items. The fixed
// plan() itself is unchanged - --only filters AFTER it, so the frozen 30-item stage-gate subset and the
// maritime slice are read exactly as always; only which items are actually POSTed to the service narrows.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const gold=require('../tests/benchmark/lib/gold');
const v100=require('../tests/benchmark/lib/scoring');
const v101=require('../tests/benchmark/rev1/scoring-v101');
const v102=require('../tests/benchmark/rev2/scoring-v102');
const rescore=require('./rescore-baseline-001');
const chain=require('../sinbad-ai-core/chain/chain-v0');

const ROOT=path.resolve(__dirname,'..');
const SUBSET=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/rev2/stage-gate-subset-v1.json'),'utf8'));
const REV1=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/BASELINE-001-REV-1/results.json'),'utf8'));
const OVERLAY=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/rev1/gold-overlay-v101.json'),'utf8'));
const MARITIME_QUOTA=Object.freeze({FAIL:3,PASS:2,PARTIAL:1});

function parseArgs(argv){
  const args={runId:null,baseUrl:'http://127.0.0.1:31990',limit:null,resume:false,only:null};
  for(let i=0;i<argv.length;i+=1){const a=argv[i];if(a==='--run-id'){args.runId=argv[i+1];i+=1;}else if(a==='--base-url'){args.baseUrl=argv[i+1];i+=1;}else if(a==='--limit'){args.limit=Number(argv[i+1]);i+=1;}else if(a==='--resume')args.resume=true;else if(a==='--only'){args.only=argv[i+1];i+=1;}}
  if(!/^[A-Z0-9][A-Z0-9-]{2,40}$/u.test(String(args.runId||'')))throw new Error('RUN_ID_REQUIRED');
  const host=new URL(args.baseUrl).hostname;if(!['127.0.0.1','localhost','[::1]'].includes(host))throw new Error('BASE_URL_MUST_BE_LOOPBACK');
  if(args.only!==null&&!plan().some(p=>p.id===args.only))throw new Error(`ONLY_ID_NOT_IN_PLAN:${args.only}`);
  return args;
}
// The measured, non-gating maritime-reasoning slice: same rule as the subset, on the accepted REV-1 outcomes.
function maritimeSlice(){
  const items=REV1.perItem.filter(p=>p.category==='maritime-reasoning').sort((a,b)=>a.id<b.id?-1:1);const picked=[];
  for(const [outcome,quota] of Object.entries(MARITIME_QUOTA))picked.push(...items.filter(p=>p.v101.outcome===outcome).slice(0,quota));
  return picked.sort((a,b)=>a.id<b.id?-1:1).map(p=>({id:p.id,category:p.category,baselineTextOutcome:p.v101.outcome,role:p.v101.outcome==='FAIL'?'TARGET':p.v101.outcome==='PASS'?'CONTROL':'OTHER',gating:false}));
}
function plan(){return [...SUBSET.items.map(i=>({id:i.id,category:i.category,baselineTextOutcome:i.textOutcome,role:i.role,gating:true})),...maritimeSlice()];}
function post(baseUrl,body){
  const target=new URL('/ai/chat',baseUrl);const data=JSON.stringify(body);const started=process.hrtime.bigint();
  return new Promise(resolve=>{
    const req=http.request({host:target.hostname,port:target.port,path:target.pathname,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)},timeout:40*60*1000},res=>{
      let text='';res.setEncoding('utf8');res.on('data',d=>{text+=d;});res.on('end',()=>{const ms=Number(process.hrtime.bigint()-started)/1e6;try{resolve({ok:res.statusCode===200,status:res.statusCode,data:JSON.parse(text),ms});}catch{resolve({ok:false,status:res.statusCode,data:null,ms});}});
    });
    req.on('error',error=>resolve({ok:false,status:0,data:null,ms:Number(process.hrtime.bigint()-started)/1e6,error:String(error.message)}));req.on('timeout',()=>req.destroy(new Error('timeout')));req.end(data);
  });
}
// The accepted v1.0.1 text scoring, per category, exactly as the REV-1 rescore applies it.
function scoreText(category,answer,item,titles){
  switch(category){
    case 'maritime-reasoning':return v101.scoreAnchors(answer,item);
    case 'stale-state':case 'context-isolation':return v101.scoreNonAffirmation(answer,item);
    case 'contradiction':return v101.scoreContradiction(answer,item);
    case 'hallucination':return v101.scoreHallucination(answer,item);
    case 'provenance-citation':return v100.scoreCitations(answer,'offline-local-rag',titles);
    default:throw new Error(`CATEGORY_NOT_SUPPORTED:${category}`);
  }
}
async function main(){
  const args=parseArgs(process.argv.slice(2));const outDir=path.join(ROOT,'tests/benchmark/results',args.runId);fs.mkdirSync(outDir,{recursive:true});
  const partialPath=path.join(outDir,'results.partial.jsonl');
  const done=new Map();if(args.resume&&fs.existsSync(partialPath))for(const line of fs.readFileSync(partialPath,'utf8').split('\n').filter(Boolean)){const row=JSON.parse(line);if(!row.error)done.set(row.id,row);}
  if(!args.resume&&fs.existsSync(partialPath))fs.unlinkSync(partialPath);
  const sets=rescore.applyOverlay(gold.loadAll(),OVERLAY);const byId=new Map();for(const set of Object.values(sets))for(const item of set.items)byId.set(item.id,item);
  const status=await new Promise(resolve=>http.get(new URL('/status',args.baseUrl),res=>{let t='';res.on('data',d=>{t+=d;});res.on('end',()=>{try{resolve(JSON.parse(t));}catch{resolve(null);}});}).on('error',()=>resolve(null)));
  if(!status||status.product!==false)throw new Error('GROUNDED_SERVICE_NOT_REACHABLE');
  const titles=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/benchmark/results/BASELINE-001/results.json'),'utf8')).libraryTitles;
  const titleList=Array.isArray(titles?.titles)?titles.titles:null;
  let items=plan();if(Number.isInteger(args.limit))items=items.slice(0,args.limit);if(args.only)items=items.filter(e=>e.id===args.only);
  const rows=[];
  for(const [n,entry] of items.entries()){
    if(done.has(entry.id)){rows.push(done.get(entry.id));continue;}
    const item=byId.get(entry.id);const response=await post(args.baseUrl,{question:item.prompt,history:[],language:'en-US',includeTranscript:true});
    let row;
    // An item the service could not answer is not a result: nothing is recorded for it, the run stops without a results
    // file, and --resume asks it again. (GROUNDED-001 lost its service to the host's memory guard and wrote 26 error rows.)
    if(!response.ok||!response.data)throw new Error(`GROUNDED_SERVICE_LOST at ${entry.id}: ${response.error||`HTTP_${response.status}`} - restart the service and rerun with --resume`);
    {
      const data=response.data;const transcriptOk=data.transcript?chain.verifyTranscript(data.transcript):false;
      // A gate record is trusted only when the transcript it summarises verifies and carries the same digest.
      const gate=transcriptOk&&data.gate.record&&data.gate.record.transcriptDigest===data.transcript.transcriptDigest?data.gate.record:null;
      const sourceTitles=(data.sources||[]).map(s=>s.title);
      const text=scoreText(entry.category,String(data.answer||''),item,titleList||sourceTitles);
      row={...entry,latencyMs:Math.round(response.ms),answer:data.answer,modelText:data.modelText,model:data.model,delivery:data.gate.delivery,chainOutcome:data.gate.outcome,reasonCode:data.gate.reasonCode,labels:data.gate.labels,iterations:data.gate.iterations,drafts:data.gate.drafts,
        sources:(data.sources||[]).map(s=>({id:s.id,title:s.title,chunk:s.chunk,contentHash:s.contentHash})),transcriptVerified:transcriptOk,transcriptDigest:data.transcript?data.transcript.transcriptDigest:null,
        textOutcome:text.outcome,textObserved:text.observed,textDetail:text.detail,gate};
    }
    fs.appendFileSync(partialPath,`${JSON.stringify(row)}\n`);rows.push(row);
    process.stdout.write(`[${n+1}/${items.length}] ${entry.id} ${row.textOutcome} ${row.delivery||row.error} ${Math.round((row.latencyMs||0)/1000)}s (baseline ${entry.baselineTextOutcome})\n`);
  }
  const scoreRows=rows.map(r=>({id:r.id,category:r.category,textOutcome:r.textOutcome,gate:r.gate}));
  const gated=v102.summarize(scoreRows),ungated=v102.summarize(scoreRows.map(r=>({...r,gate:null})));
  const gatingIds=new Set(rows.filter(r=>r.gating).map(r=>r.id));
  const only=f=>({gated:v102.summarize(scoreRows.filter(f)).overall,ungated:v102.summarize(scoreRows.filter(f).map(r=>({...r,gate:null}))).overall});
  const results={run:args.runId,service:status,scorer:{text:v101.VERSION,citations:'sinbad-benchmark-scoring/1.0.0 scoreCitations',delivery:v102.VERSION},
    method:args.only?`--only ${args.only}: a single item from the fixed stage-gate subset v1 / maritime-reasoning plan, asked once against the grounded loopback service; text scored with the accepted v1.0.1 detectors and gold overlay, delivery with v1.0.2; the gate record backed by a verified chain transcript. A measurement of this local pipeline on this host, not of the product. The other 35 plan items are NOT measured by this run.`:'Stage-gate subset v1 (30 gating items) plus a 6-item maritime-reasoning slice (measured, non-gating) asked once each against the grounded loopback service; text scored with the accepted v1.0.1 detectors and gold overlay, delivery with v1.0.2; every gate record backed by a verified chain transcript. A measurement of this local pipeline on this host, not of the product.',
    items:rows.length,gatingItems:only(r=>gatingIds.has(r.id)),maritimeSlice:only(r=>!gatingIds.has(r.id)),overall:{gated:gated.overall,ungated:ungated.overall},byCategory:gated.byCategory,
    baselineComparison:rows.map(r=>({id:r.id,category:r.category,role:r.role,baseline:r.baselineTextOutcome,now:r.textOutcome,delivery:r.delivery||null,cell:gated.perItem.find(p=>p.id===r.id).cell})),
    latencyMs:{sum:rows.reduce((n,r)=>n+(r.latencyMs||0),0),median:[...rows.map(r=>r.latencyMs||0)].sort((a,b)=>a-b)[Math.floor(rows.length/2)]},rows};
  fs.writeFileSync(path.join(outDir,'results.json'),`${JSON.stringify(results,null,2)}\n`);
  const o=results.gatingItems.gated;process.stdout.write(`${args.runId}: text PASS ${o.PASS} PARTIAL ${o.PARTIAL} FAIL ${o.FAIL} | harm delivered ${o.HARM_DELIVERED} flagged ${o.HARM_FLAGGED} caught ${o.HARM_CAUGHT} | false block ${o.FALSE_BLOCK}/${o.PASS}\n`);
}
if(require.main===module)main().catch(error=>{process.stderr.write(`${error.message}\n`);process.exit(1);});
module.exports={plan,maritimeSlice,scoreText,parseArgs};
