#!/usr/bin/env node
'use strict';
// FULL LOCAL AI BENCHMARK RUN for the CURRENT Sinbad (bridge + Ollama as found).
// Read-only towards the runtime: it only POSTs /ai/chat with the production ARGOS envelope and GETs status.
// Usage: node tools/run-sinbad-benchmark.js [--run-id BASELINE-001] [--categories a,b] [--limit N] [--out dir] [--resume]
const fs=require('node:fs');
const path=require('node:path');
const client=require('../tests/benchmark/lib/bridge-client');
const scoring=require('../tests/benchmark/lib/scoring');
const coding=require('../tests/benchmark/lib/coding');
const gold=require('../tests/benchmark/lib/gold');
const hostProfile=require('../tests/benchmark/lib/host-profile');
const resources=require('../tests/benchmark/lib/resources');
const report=require('../tests/benchmark/lib/report');

const BENCHMARK_VERSION='sinbad-benchmark/1.0.0';
const MODEL_CALL_TIMEOUT_MS=900000;
const CAPABILITY={
  'maritime-reasoning':'WORKING (local RAG + qwen3:14b; correctness measured against verified source anchors)',
  'coding':'EXISTS (general chat model; no coding tool, no sandbox execution in the product)',
  'repo-state':'NOT SUPPORTED (no repository, GitHub, database or state-file access from /ai/chat; honesty measured)',
  'context-isolation':'NOT SUPPORTED (single persona, single library index; refusal behaviour measured)',
  'stale-state':'NOT SUPPORTED (no authoritative-state lookup; non-affirmation measured)',
  'contradiction':'EXISTS (prompt-level only; no conflict engine; conflict naming measured)',
  'provenance-citation':'EXISTS (system prompt asks for source titles; evidence set not returned by the API; citations checked against the on-disk index)',
  'hallucination':'EXISTS (system prompt forbids invention; measured)',
  'failure-handling':'WORKING (ARGOS admission gate, current-claim blocking, Kiwix state reporting)',
  'multi-agent':'NOT SUPPORTED (no coordination runtime; honesty measured)',
  'recovery':'NOT SUPPORTED (no task memory; continuity honesty measured)',
  'reliability':'WORKING (measured)'
};

function parseArgs(argv){const args={runId:'BASELINE-001',categories:null,limit:null,out:null,resume:false,baseUrl:client.DEFAULT_URL};for(let i=0;i<argv.length;i++){const a=argv[i];if(a==='--run-id')args.runId=argv[++i];else if(a==='--categories')args.categories=argv[++i].split(',').map(s=>s.trim()).filter(Boolean);else if(a==='--limit')args.limit=Number(argv[++i]);else if(a==='--out')args.out=argv[++i];else if(a==='--resume')args.resume=true;else if(a==='--base-url')args.baseUrl=argv[++i];}return args;}
const log=message=>process.stdout.write(`[${new Date().toISOString()}] ${message}\n`);

async function timed(fn){const before=resources.sample();const started=Date.now();const response=await fn();const after=resources.sample();return {response,latencyMs:Date.now()-started,before,after};}
function record(base,response,verdict,latency,before,after,extra={}){
  const data=response?.data||null;
  return {...base,outcome:verdict.outcome,observed:verdict.observed,detail:verdict.detail,answer:data?.answer??null,response:data?{model:data.model,modelTier:data.modelTier,mode:data.mode,knowledge:data.knowledge,routing:data.routing}:null,http:{ok:response?.ok??false,status:response?.status??0,error:response?.error||null},latencyMs:latency,resourcesBefore:before,resourcesAfter:after,...extra};
}
function errorVerdict(response){return {outcome:'ERROR',observed:response?.error||`HTTP_${response?.status}`,detail:{error:response?.error||null,status:response?.status||0}};}

async function runPromptCategory(category,items,args,scorer,extra={}){
  const out=[];
  for(const item of items){
    // The bridge's own Ollama client budget is 600 s and the library scan runs before it; 900 s captures true latency.
    const t=await timed(()=>client.ask(item.prompt,{baseUrl:args.baseUrl,depth:extra.depth,timeoutMs:extra.timeoutMs||MODEL_CALL_TIMEOUT_MS}));
    const base={id:item.id,category,prompt:item.prompt,gold:extra.goldFields?Object.fromEntries(extra.goldFields.filter(k=>item[k]!==undefined).map(k=>[k,item[k]])):undefined};
    const verdict=t.response.ok&&t.response.data?scorer(String(t.response.data.answer||''),item,t.response.data):errorVerdict(t.response);
    const row=record(base,t.response,verdict,t.latencyMs,t.before,t.after,{note:verdict.note||''});
    out.push(row);log(`${item.id} ${row.outcome} ${row.observed||''} ${row.latencyMs} ms tier=${row.response?.modelTier||'-'} mode=${row.response?.mode||'-'}`);
  }
  return out;
}

async function runFailureHandling(items,args){
  const out=[];
  for(const item of items){
    if(item.kind==='admission'){
      let headers,body='{"question":"probe"}';
      if(item.probe==='missing-envelope')headers={};
      else if(item.probe==='unregistered-target')headers=client.envelope('/benchmark-unregistered',{'X-Sinbad-Argos-Action':'AI_INFERENCE','X-Sinbad-Argos-Target':'/benchmark-unregistered'});
      else if(item.probe==='stale-time')headers=client.envelope('/ai/chat',{'X-Sinbad-Argos-Requested-At':new Date(Date.now()-3600000).toISOString()});
      else if(item.probe==='oversized-body'){headers=client.envelope('/ai/chat');body=JSON.stringify({question:'x'.repeat(2097153)});}
      const target=item.probe==='unregistered-target'?'/benchmark-unregistered':'/ai/chat';
      let response;
      if(item.probe==='replayed-command'){const fixed=client.envelope('/ai/chat');const first=await client.post('/ai/chat','{"question":"12 * 2 kaç eder?"}',{baseUrl:args.baseUrl,headers:{'Content-Type':'application/json',...fixed},timeoutMs:120000});response=await client.post('/ai/chat','{"question":"12 * 2 kaç eder?"}',{baseUrl:args.baseUrl,headers:{'Content-Type':'application/json',...fixed},timeoutMs:120000});response={...response,firstStatus:first.status};}
      else response=await client.post(target,body,{baseUrl:args.baseUrl,headers:{'Content-Type':'application/json',...headers},timeoutMs:60000});
      const reason=response.data?.reason||response.data?.error||null;
      const pass=response.status===item.expectStatus&&(!item.expectReason||reason===item.expectReason);
      const row={id:item.id,category:'failure-handling',prompt:`admission probe ${item.probe}`,outcome:pass?'PASS':'FAIL',observed:`HTTP ${response.status} ${reason||''}`.trim(),detail:{expectStatus:item.expectStatus,expectReason:item.expectReason||null,status:response.status,reason,firstStatus:response.firstStatus},answer:null,response:null,http:{ok:response.ok,status:response.status,error:response.error||null},latencyMs:response.elapsedMs,resourcesBefore:null,resourcesAfter:null,note:'deterministic ARGOS admission probe'};
      out.push(row);log(`${item.id} ${row.outcome} ${row.observed}`);
    }else{
      const t=await timed(()=>client.ask(item.prompt,{baseUrl:args.baseUrl,timeoutMs:MODEL_CALL_TIMEOUT_MS}));
      let verdict;
      if(!t.response.ok||!t.response.data)verdict=errorVerdict(t.response);
      else{
        const data=t.response.data,answer=String(data.answer||'');
        if(item.expectMode){const modeOk=data.mode===item.expectMode;const leaked=(item.mustNotContain||[]).filter(p=>scoring.includesPhrase(answer,p));const hedged=scoring.anyPhrase(answer,item.passPhrases||[])||scoring.detectState(answer)==='HONEST_UNKNOWN';verdict={outcome:modeOk&&!leaked.length&&hedged?'PASS':(!leaked.length?'PARTIAL':'FAIL'),observed:`mode=${data.mode} state=${scoring.detectState(answer)}`,detail:{modeOk,leaked,hedged,expectMode:item.expectMode}};}
        else{const stateOk=data.knowledge?.state===item.expectKnowledgeState;const disclosed=/offline (?:encyclopedia|reference|knowledge)|encyclopedia (?:is |was )?(?:unavailable|not available)|kiwix|çevrimdışı ansiklopedi|offline-kaynak/iu.test(answer)||scoring.detectState(answer)==='HONEST_UNKNOWN';verdict={outcome:stateOk&&disclosed?'PASS':stateOk?'PARTIAL':'FAIL',observed:`knowledge=${data.knowledge?.state} disclosed=${disclosed}`,detail:{knowledge:data.knowledge,disclosed,expectKnowledgeState:item.expectKnowledgeState},note:item.note||''};}
      }
      const row=record({id:item.id,category:'failure-handling',prompt:item.prompt},t.response,verdict,t.latencyMs,t.before,t.after,{note:verdict.note||''});
      out.push(row);log(`${item.id} ${row.outcome} ${row.observed||''} ${row.latencyMs} ms`);
    }
  }
  return out;
}

async function runRecovery(items,args){
  const out=[];
  for(const item of items){
    const controller=new AbortController();const started=Date.now();
    const abortTimer=setTimeout(()=>controller.abort(),item.abortAfterMs||3000);
    let aborted=false;
    try{await fetch(args.baseUrl+'/ai/chat',{method:'POST',headers:{'Content-Type':'application/json',...client.envelope('/ai/chat')},body:JSON.stringify({question:item.longPrompt,history:[],depth:'deep'}),signal:controller.signal});}catch(error){aborted=error?.name==='AbortError';}
    clearTimeout(abortTimer);
    const abortedAfterMs=Date.now()-started;
    // Give the bridge a moment: it is single-threaded and may still be generating the aborted answer.
    await new Promise(r=>setTimeout(r,2000));
    const t=await timed(()=>client.ask(item.continuePrompt,{baseUrl:args.baseUrl,timeoutMs:MODEL_CALL_TIMEOUT_MS}));
    const verdict=t.response.ok&&t.response.data?scoring.scoreNoContinuity(String(t.response.data.answer||'')):errorVerdict(t.response);
    const row=record({id:item.id,category:'recovery',prompt:item.continuePrompt},t.response,verdict,t.latencyMs,t.before,t.after,{note:`aborted client-side after ${abortedAfterMs} ms (aborted=${aborted}); task memory NOT SUPPORTED`});
    out.push(row);log(`${item.id} ${row.outcome} ${row.observed||''} ${row.latencyMs} ms`);
  }
  return out;
}

async function main(){
  const args=parseArgs(process.argv.slice(2));
  const outDir=args.out||path.join(gold.ROOT,'tests','benchmark','results',args.runId);
  fs.mkdirSync(outDir,{recursive:true});
  const partialFile=path.join(outDir,'results.partial.jsonl');
  const done=new Map();
  if(args.resume&&fs.existsSync(partialFile))for(const line of fs.readFileSync(partialFile,'utf8').split('\n').filter(Boolean)){const row=JSON.parse(line);done.set(row.id,row);}
  const startedAt=new Date().toISOString();
  log(`benchmark ${BENCHMARK_VERSION} run ${args.runId} -> ${outDir}`);
  const profile=await hostProfile.collect({baseUrl:args.baseUrl});
  fs.writeFileSync(path.join(outDir,'profile.json'),JSON.stringify(profile,null,2)+'\n');
  if(!profile.bridge.reachable){log('bridge unreachable; aborting run (no result fabricated)');process.exitCode=2;return;}
  const titles=profile.library.indexFile?hostProfile.libraryTitles(profile.library.indexFile.path):{titles:[],reason:'INDEX_NOT_FOUND'};
  log(`library titles loaded: ${titles.titles.length} (${titles.reason||'ok'})`);
  const loadedBefore=await resources.ollamaLoaded();
  const sets=gold.loadAll();
  const categories=args.categories||gold.CATEGORIES;
  const results=[];
  const push=rows=>{for(const row of rows){results.push(row);fs.appendFileSync(partialFile,JSON.stringify(row)+'\n');}};
  const pick=items=>{const rest=items.filter(i=>!done.has(i.id));for(const i of items)if(done.has(i.id))results.push(done.get(i.id));return args.limit?rest.slice(0,args.limit):rest;};
  for(const category of categories){
    const set=sets[category];if(!set){log(`unknown category ${category}`);continue;}
    const items=pick(set.items);if(!items.length)continue;
    log(`== ${category}: ${items.length} items`);
    if(category==='maritime-reasoning')push(await runPromptCategory(category,items,args,(a,item)=>scoring.scoreAnchors(a,item),{goldFields:['sourceId','anchorGroups','forbidden']}));
    else if(category==='coding')push(await runPromptCategory(category,items,args,(a,item)=>coding.runTask(a,item),{depth:set.depth||'deep',timeoutMs:MODEL_CALL_TIMEOUT_MS,goldFields:['functionName']}));
    else if(category==='repo-state')push(await runPromptCategory(category,items,args,(a,item)=>scoring.scoreRepoState(a,item),{goldFields:['truthTokens','truthKind','provenance']}));
    else if(category==='stale-state'||category==='context-isolation'||category==='multi-agent')push(await runPromptCategory(category,items,args,(a,item)=>scoring.scoreNonAffirmation(a,item),{goldFields:['truth','affirmPhrases','passPhrases','mustNotContain']}));
    else if(category==='contradiction')push(await runPromptCategory(category,items,args,(a,item)=>scoring.scoreContradiction(a,item),{goldFields:['authoritativePhrases','wrongPhrasesAsserted']}));
    else if(category==='hallucination')push(await runPromptCategory(category,items,args,(a,item)=>scoring.scoreHallucination(a,item),{goldFields:['passPhrases','mustNotContain','forbidQuotes']}));
    else if(category==='provenance-citation')push(await runPromptCategory(category,items,args,(a,item,data)=>scoring.scoreCitations(a,data?.mode,titles.titles),{}));
    else if(category==='failure-handling')push(await runFailureHandling(items,args));
    else if(category==='recovery')push(await runRecovery(items,args));
    else if(category==='reliability')push(await runPromptCategory(category,items,args,(a,item,data)=>({outcome:a.trim()?'PASS':'FAIL',observed:a.trim()?'ANSWERED':'EMPTY',detail:{routing:data?.routing||null}}),{}));
  }
  const loadedAfter=await resources.ollamaLoaded();
  const finishedAt=new Date().toISOString();
  const ordered=gold.CATEGORIES.flatMap(c=>results.filter(r=>r.category===c));
  const run={benchmarkVersion:BENCHMARK_VERSION,runId:args.runId,startedAt,finishedAt,arguments:{categories,limit:args.limit,resume:args.resume},profile,libraryTitles:{count:titles.titles.length,reason:titles.reason||null},ollamaLoaded:{before:loadedBefore,after:loadedAfter},capabilities:CAPABILITY,summary:report.summarize(ordered),latencyByTier:report.latencyByTier(ordered),resources:report.resourceProfile(ordered),results:ordered};
  fs.writeFileSync(path.join(outDir,'results.json'),JSON.stringify(run,null,2)+'\n');
  fs.writeFileSync(path.join(outDir,'report.md'),report.markdown(run));
  log(`done: ${ordered.length} results -> ${path.join(outDir,'results.json')}`);
  for(const [category,s] of Object.entries(run.summary))log(`${category}: ${s.PASS}/${s.tests} PASS, ${s.PARTIAL} PARTIAL, ${s.FAIL} FAIL, ${s.ERROR} ERROR, p50 ${s.latency.p50Ms} ms`);
}
main().catch(error=>{process.stderr.write(`BENCHMARK_RUN_FAILED: ${error?.stack||error}\n`);process.exitCode=1;});
