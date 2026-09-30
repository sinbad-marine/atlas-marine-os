#!/usr/bin/env node
'use strict';
// SINBAD Active Participation Gate v0 - command surface and persistence.
//   open       record a WorkOrder (Owner instruction, taken by SINBAD) BEFORE any delegation
//   preflight  observe the repository, decide PASS/FAIL (fail closed)
//   delegate   only after a fresh, bound PASS preflight; prints the bounded assignment
//   ingest     validate and locally verify an AgentReport, label every claim
//   summary    Owner Work Summary, generated from the stored chain only
// No agent is executed, no model or cloud is called, nothing is written to GitHub or to the repository. The ledger
// is the existing ARGOS event shelf (hash-chained, append-only, untouched) plus content-addressed immutable bodies,
// kept OUTSIDE the repository. Logic lives in sinbad-ai-core/participation; this file only does I/O.
//
//   node tools/sinbad-participation.js open      --order order.json
//   node tools/sinbad-participation.js preflight --task TASK-ID
//   node tools/sinbad-participation.js delegate  --task TASK-ID
//   node tools/sinbad-participation.js ingest    --report report.json
//   node tools/sinbad-participation.js summary   [--out file]
// Options: --root <ledger dir>  --repo <repository dir>  --base-ref <ref, default origin/main>
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const cp=require('node:child_process');
const shelfApi=require('../sinbad-ai-core/argos-event-shelf');
const P=require('../sinbad-ai-core/participation');

const REPO_ROOT=path.resolve(__dirname,'..');
const ACTOR='sinbad-participation';
const SHELF_ID='participation';
const MAX_INPUT_BYTES=256*1024;
const fail=code=>new Error(code);

function defaultRoot(){return path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'.local','share'),'Sinbad','participation-ledger');}

// ---------- storage ----------
function realish(p){
  let cur=path.resolve(p);const tail=[];
  while(!fs.existsSync(cur)){const up=path.dirname(cur);if(up===cur)break;tail.unshift(path.basename(cur));cur=up;}
  return path.join(fs.realpathSync(cur),...tail);
}
const fold=s=>process.platform==='win32'?s.toLowerCase():s;
// Runtime storage must live outside the repository, and never on git internals or another runtime's directory.
function assertOutsideRepository(target,repoRoot=REPO_ROOT,code='STORAGE_INSIDE_REPOSITORY'){
  if(typeof target!=='string'||!path.isAbsolute(target))throw fail('STORAGE_PATH_NOT_ABSOLUTE');
  const a=fold(realish(target)),b=fold(realish(repoRoot));
  if(a===b||a.startsWith(b+path.sep))throw fail(code);
  if(b.startsWith(a+path.sep))throw fail('STORAGE_CONTAINS_REPOSITORY');
  if(path.resolve(target).split(/[\\/]/u).some(s=>['.git','.argos-runtime'].includes(s.toLowerCase())))throw fail('STORAGE_PATH_RESERVED');
}
function writeBodyFile(file,content,hash){
  try{fs.writeFileSync(file,content,{encoding:'utf8',flag:'wx'});}
  catch(error){
    if(error.code!=='EEXIST')throw error;
    // content-addressed: an existing file is fine only if it still holds exactly this content
    if(P.bodyHash(JSON.parse(fs.readFileSync(file,'utf8')))!==hash)throw fail(`LEDGER_INVALID:BODY_TAMPERED:${hash.slice(0,12)}`);
  }
}
function openLedger({root=defaultRoot(),repoRoot=REPO_ROOT}={}){
  assertOutsideRepository(root,repoRoot);
  const bodies=path.join(root,'bodies');
  fs.mkdirSync(bodies,{recursive:true});
  const shelf=shelfApi.create({root,shelfId:SHELF_ID,maxEvents:100000});
  // Fail closed on a broken chain, a missing body or a body that no longer hashes to its event.
  function verify(){
    let state;
    try{state=shelf.inspect();}catch(error){throw fail(`LEDGER_INVALID:${String(error.message).slice(0,120)}`);}
    const entries=state.entries.map(entry=>{
      if(entry.actorId!==ACTOR)throw fail(`LEDGER_INVALID:FOREIGN_ACTOR:${entry.sequence}`);
      const file=path.join(bodies,`${entry.evidenceHash}.json`);
      if(!fs.existsSync(file))throw fail(`LEDGER_INVALID:BODY_MISSING:${entry.evidenceHash.slice(0,12)}`);
      let body;try{body=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw fail(`LEDGER_INVALID:BODY_UNREADABLE:${entry.evidenceHash.slice(0,12)}`);}
      if(P.bodyHash(body)!==entry.evidenceHash)throw fail(`LEDGER_INVALID:BODY_TAMPERED:${entry.evidenceHash.slice(0,12)}`);
      return Object.freeze({sequence:entry.sequence,eventHash:entry.eventHash,event:entry,bodyHash:entry.evidenceHash,body});
    });
    return Object.freeze({entries,head:Object.freeze({headHash:state.headHash,eventCount:state.eventCount})});
  }
  function view(){const v=verify();return Object.freeze({...v,reduced:P.reduceLedger(v.entries)});}
  function append({kind,taskId=null,outcome,body,now}){
    if(P.secretFinding(body))throw fail('SECRET_IN_BODY');
    const hash=P.bodyHash(body);
    writeBodyFile(path.join(bodies,`${hash}.json`),`${P.canonical(body)}\n`,hash);
    const stamp=String(now).replace(/[^0-9]/gu,'');
    const event=shelf.append({eventId:`${taskId||'rejected'}.${kind}.${stamp}.${hash.slice(0,8)}`,observedAt:now,actorId:ACTOR,kind,targetRef:taskId?`task/${taskId}`:`rejected/${hash.slice(0,12)}`,outcome,evidenceHash:hash});
    return Object.freeze({eventHash:event.eventHash,bodyHash:hash,sequence:event.sequence});
  }
  return Object.freeze({root,verify,view,append});
}

// ---------- observation (read-only git, no network) ----------
function gitRunner(repoRoot){
  return args=>{
    const r=cp.spawnSync('git',args,{cwd:repoRoot,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});
    return {status:r.status,stdout:r.stdout||'',error:r.error?String(r.error.message):null};
  };
}
const ok=r=>!r.error&&r.status===0;
function parseDirty(porcelain){
  const records=porcelain.split('\0').filter(Boolean),out=[];
  for(let i=0;i<records.length;i+=1){
    const r=records[i];out.push(r.slice(3));
    if('RC'.includes(r[0])||'RC'.includes(r[1])){i+=1;if(records[i])out.push(records[i]);}
  }
  return out;
}
function gitObserver({repoRoot=REPO_ROOT,baseRef='origin/main',run=gitRunner(repoRoot)}={}){
  const isRepo=()=>ok(run(['rev-parse','--git-dir']));
  return Object.freeze({
    observeHead(order){
      if(!isRepo())return {available:false,error:'not a git repository'};
      const head=run(['rev-parse','--verify','--quiet',`${baseRef}^{commit}`]);
      if(!ok(head))return {available:false,error:`cannot resolve ${baseRef}`};
      const status=run(['status','--porcelain','-z','--untracked-files=all']);
      if(!ok(status))return {available:false,error:'git status failed'};
      return {available:true,headSha:head.stdout.trim(),baseShaExists:ok(run(['cat-file','-e',`${order.baseSha}^{commit}`])),dirtyPaths:parseDirty(status.stdout)};
    },
    observeResult(order,report){
      if(!isRepo())return {available:false,error:'not a git repository'};
      const resultingShaExists=ok(run(['cat-file','-e',`${report.resultingSha}^{commit}`]));
      if(!resultingShaExists)return {available:true,resultingShaExists:false};
      const anc=run(['merge-base','--is-ancestor',order.baseSha,report.resultingSha]);
      if(anc.error||![0,1].includes(anc.status))return {available:false,error:'git merge-base failed'};
      const diff=run(['diff','--name-only','--no-renames','-z',order.baseSha,report.resultingSha]);
      let branchTip=null;
      for(const ref of [`refs/heads/${order.branch}`,`refs/remotes/origin/${order.branch}`]){
        const tip=run(['rev-parse','--verify','--quiet',`${ref}^{commit}`]);
        if(ok(tip)){branchTip=tip.stdout.trim();break;}
      }
      return {available:true,resultingShaExists:true,baseIsAncestor:anc.status===0,observedChangedFiles:ok(diff)?diff.stdout.split('\0').filter(Boolean):null,branchTip};
    }
  });
}
function safely(fn,fallback){try{return fn();}catch(error){return {...fallback,error:String(error.message).slice(0,160)};}}

// ---------- commands (plain functions so the tests can drive them) ----------
const findTask=(view,taskId)=>view.reduced.tasks.find(t=>t.taskId===taskId)||null;
const slug=s=>s.toLowerCase().replace(/_/gu,'-');

function open(ctx,input){
  const v=P.validateOrder(input);
  if(!v.ok)return {ok:false,status:'ORDER_REJECTED',errors:v.errors};
  if(findTask(ctx.ledger.view(),v.order.taskId))return {ok:false,status:'TASK_EXISTS',errors:['TASK_EXISTS']};
  const r=ctx.ledger.append({kind:'task.opened',taskId:v.order.taskId,outcome:'opened',now:ctx.now,body:{schema:'sinbad-work-order/0-v1',order:v.order}});
  return {ok:true,status:'OPENED',taskId:v.order.taskId,...r};
}
function preflight(ctx,taskId){
  const view=ctx.ledger.view(),task=findTask(view,taskId);
  if(!task)return {ok:false,status:'TASK_UNKNOWN'};
  if(!['OPEN','PREFLIGHT_PASSED','PREFLIGHT_FAILED','HOLD'].includes(task.state))return {ok:false,status:'TASK_NOT_PREFLIGHTABLE',state:task.state};
  const observation=safely(()=>ctx.observer.observeHead(task.order),{available:false});
  const decision=P.decidePreflight({order:task.order,now:ctx.now,observation,others:P.claimingOthers(view.reduced.tasks,task)});
  const r=ctx.ledger.append({kind:'preflight.decided',taskId,outcome:slug(decision.decision),now:ctx.now,body:decision});
  return {ok:decision.decision==='PASS',status:`PREFLIGHT_${decision.decision}`,decision,...r};
}
function delegate(ctx,taskId){
  const view=ctx.ledger.view(),task=findTask(view,taskId);
  if(!task)return {ok:false,status:'TASK_UNKNOWN'};
  const latest=task.preflights.length?task.preflights[task.preflights.length-1]:null;
  const observation=safely(()=>ctx.observer.observeHead(task.order),{available:false});
  const verdict=P.evaluateDelegation({order:task.order,state:task.state,latestPreflight:latest?latest.body:null,now:ctx.now,observation,others:P.claimingOthers(view.reduced.tasks,task)});
  if(!verdict.ok){
    const r=ctx.ledger.append({kind:'delegation.refused',taskId,outcome:'refused',now:ctx.now,body:{schema:'sinbad-delegation-refusal/0-v1',taskId,at:ctx.now,reasons:verdict.reasons}});
    return {ok:false,status:'DELEGATION_REFUSED',reasons:verdict.reasons,...r};
  }
  const o=task.order;
  const assignment={taskId,agentId:o.agentId,branch:o.branch,baseSha:o.baseSha,expectedFiles:o.expectedFiles,
    rules:['work only on the branch above, starting from baseSha','change only the expected files; anything else is a SCOPE_BREACH','do not create WorkOrders or tasks','return an AgentReport with exactly these keys: '+P.REPORT_KEYS.join(', '),'test results you report are recorded as agent claims, not as verified facts']};
  const r=ctx.ledger.append({kind:'task.delegated',taskId,outcome:'delegated',now:ctx.now,body:{schema:'sinbad-delegation/0-v1',taskId,agentId:o.agentId,preflightEventHash:latest.ref.eventHash,observedHeadSha:latest.body.observedHeadSha,expectedFilesHash:latest.body.expectedFilesHash,delegatedAt:ctx.now,assignment}});
  return {ok:true,status:'DELEGATED',assignment,...r};
}
function reject(ctx,errors,rawText,taskId){
  const reportSha256=P.sha256(rawText);
  const r=ctx.ledger.append({kind:'report.rejected',outcome:'rejected',now:ctx.now,body:{schema:'sinbad-report-rejection/0-v1',taskId:taskId||null,errors,reportSha256,at:ctx.now}});
  return {ok:false,status:'REPORT_REJECTED',errors,...r};
}
function ingest(ctx,rawText){
  let parsed;
  try{parsed=JSON.parse(String(rawText).replace(/^﻿/u,''));}catch{return reject(ctx,['REPORT_NOT_JSON'],String(rawText),null);}
  const v=P.validateReport(parsed);
  if(!v.ok)return reject(ctx,v.errors,String(rawText),null);
  const report=v.report;
  const view=ctx.ledger.view(),task=findTask(view,report.taskId);
  if(!task)return reject(ctx,['TASK_UNKNOWN'],String(rawText),report.taskId);
  const retro=task.order.origin==='RETROACTIVE_BOOTSTRAP'&&task.state==='OPEN';
  if(!retro&&!['DELEGATED','BREACHED','REPORT_CONTRADICTED'].includes(task.state))return reject(ctx,[`TASK_NOT_DELEGATED:${task.state}`],String(rawText),report.taskId);
  const observation=safely(()=>ctx.observer.observeResult(task.order,report),{available:false});
  const verification=P.verifyReport({order:task.order,report,observation,independentTestEvidence:ctx.independentTestEvidence||[]});
  const r=ctx.ledger.append({kind:'report.ingested',taskId:report.taskId,outcome:slug(verification.outcome),now:ctx.now,body:{schema:'sinbad-report-ingestion/0-v1',taskId:report.taskId,ingestedAt:ctx.now,report,verification}});
  return {ok:verification.outcome==='INGESTED',status:`REPORT_${verification.outcome}`,verification,...r};
}
function summary(ctx){
  const view=ctx.ledger.view();
  return P.buildSummary({reduced:view.reduced,head:view.head});
}

// ---------- CLI ----------
function parseArgs(argv){
  const out={command:argv[0]||null,opts:{}};
  for(let i=1;i<argv.length;i+=1){
    const a=argv[i];
    if(!a.startsWith('--'))throw fail(`UNKNOWN_ARGUMENT:${a}`);
    const key=a.slice(2);if(i+1>=argv.length||argv[i+1].startsWith('--'))throw fail(`MISSING_VALUE:${key}`);
    out.opts[key]=argv[i+1];i+=1;
  }
  return out;
}
function readInput(file){
  const full=path.resolve(String(file));
  if(fs.statSync(full).size>MAX_INPUT_BYTES)throw fail('INPUT_TOO_LARGE');
  return fs.readFileSync(full,'utf8');
}
function main(argv){
  const {command,opts}=parseArgs(argv);
  const commands=['open','preflight','delegate','ingest','summary'];
  if(!commands.includes(command))throw fail(`USAGE: ${commands.join('|')} (see the header of tools/sinbad-participation.js)`);
  const repoRoot=path.resolve(opts.repo||REPO_ROOT);
  const ctx={ledger:openLedger({root:opts.root?path.resolve(opts.root):defaultRoot(),repoRoot}),observer:gitObserver({repoRoot,baseRef:opts['base-ref']||'origin/main'}),now:new Date().toISOString()};
  let result;
  if(command==='open'){if(!opts.order)throw fail('MISSING_OPTION:order');let input;try{input=JSON.parse(readInput(opts.order).replace(/^﻿/u,''));}catch(error){if(String(error.message).startsWith('INPUT_'))throw error;input=null;}result=open(ctx,input);}
  else if(command==='preflight'){if(!opts.task)throw fail('MISSING_OPTION:task');result=preflight(ctx,opts.task);}
  else if(command==='delegate'){if(!opts.task)throw fail('MISSING_OPTION:task');result=delegate(ctx,opts.task);}
  else if(command==='ingest'){if(!opts.report)throw fail('MISSING_OPTION:report');result=ingest(ctx,readInput(opts.report));}
  else{
    const s=summary(ctx);
    if(opts.out){assertOutsideRepository(path.resolve(opts.out),repoRoot,'OUTPUT_INSIDE_REPOSITORY');fs.writeFileSync(path.resolve(opts.out),s.text,{encoding:'utf8',flag:'wx'});}
    process.stdout.write(s.text);
    return 0;
  }
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
  return result.ok?0:2;
}
if(require.main===module){
  try{process.exitCode=main(process.argv.slice(2));}
  catch(error){process.stderr.write(`${String(error.message)}\n`);process.exitCode=String(error.message).startsWith('LEDGER_INVALID')?3:1;}
}
module.exports=Object.freeze({REPO_ROOT,ACTOR,defaultRoot,assertOutsideRepository,openLedger,gitObserver,parseDirty,open,preflight,delegate,ingest,summary,parseArgs});
