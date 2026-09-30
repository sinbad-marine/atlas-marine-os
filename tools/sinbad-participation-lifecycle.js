#!/usr/bin/env node
'use strict';
// SINBAD Post-Merge Lifecycle v0 - command surface and persistence. Extends what SINBAD knows about a development task
// past report ingestion: PR, merge, post-merge CI, COMPLETED. The accepted Participation Gate v0 is used unchanged; this
// tool keeps a SEPARATE shelf (participation-lifecycle) in the same ledger root, outside the repository.
//   link-pr       --task T --pr N [--claimed-merge-sha S] [--claimed-runs ID,ID] [--claimed-by NAME]
//   verify-merge  --task T     observe the PR (GitHub, read-only) and the merge (local git), record the evidence
//   verify-ci     --task T     re-observe the merge, observe post-merge CI on the exact merge SHA, complete only if all verified
//   summary       [--out FILE] the v0 Owner summary followed by the task lifecycle section
// Options: --root <ledger dir>  --repo <repository>  --base-ref <ref, default origin/main>
// Nothing here writes to GitHub or to the repository, fetches, executes agents or calls a model. Observation that is
// unavailable is recorded as such and never moves a task forward.
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const shelfApi=require('../sinbad-ai-core/argos-event-shelf');
const base=require('../sinbad-ai-core/participation/participation-v0');
const L=require('../sinbad-ai-core/participation/lifecycle-v0');
const v0=require('./sinbad-participation');
const {githubObserver}=require('./sinbad-participation-github');

const fail=code=>new Error(code);
const slug=s=>s.toLowerCase().replace(/_/gu,'-');
const CAPABILITY_FILE='sinbad-ai-core/participation/lifecycle-v0.js';

// ---------- the separate lifecycle shelf ----------
function writeBodyFile(file,content,hash){
  try{fs.writeFileSync(file,content,{encoding:'utf8',flag:'wx'});}
  catch(error){
    if(error.code!=='EEXIST')throw error;
    if(base.bodyHash(JSON.parse(fs.readFileSync(file,'utf8')))!==hash)throw fail(`LEDGER_INVALID:BODY_TAMPERED:${hash.slice(0,12)}`);
  }
}
function openLifecycle({root=v0.defaultRoot(),repoRoot=v0.REPO_ROOT}={}){
  v0.assertOutsideRepository(root,repoRoot);
  const bodies=path.join(root,'bodies');
  fs.mkdirSync(bodies,{recursive:true});
  const shelf=shelfApi.create({root,shelfId:L.SHELF_ID,maxEvents:100000});
  function verify(){
    let state;
    try{state=shelf.inspect();}catch(error){throw fail(`LEDGER_INVALID:LIFECYCLE:${String(error.message).slice(0,120)}`);}
    const entries=state.entries.map(entry=>{
      if(entry.actorId!==L.ACTOR)throw fail(`LEDGER_INVALID:FOREIGN_ACTOR:${entry.sequence}`);
      const file=path.join(bodies,`${entry.evidenceHash}.json`);
      if(!fs.existsSync(file))throw fail(`LEDGER_INVALID:BODY_MISSING:${entry.evidenceHash.slice(0,12)}`);
      let body;try{body=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw fail(`LEDGER_INVALID:BODY_UNREADABLE:${entry.evidenceHash.slice(0,12)}`);}
      if(base.bodyHash(body)!==entry.evidenceHash)throw fail(`LEDGER_INVALID:BODY_TAMPERED:${entry.evidenceHash.slice(0,12)}`);
      return Object.freeze({sequence:entry.sequence,eventHash:entry.eventHash,event:entry,bodyHash:entry.evidenceHash,body});
    });
    return Object.freeze({entries,head:Object.freeze({headHash:state.headHash,eventCount:state.eventCount})});
  }
  function append({kind,taskId,outcome,body,now}){
    if(base.secretFinding(body))throw fail('SECRET_IN_BODY');
    const hash=base.bodyHash(body);
    writeBodyFile(path.join(bodies,`${hash}.json`),`${base.canonical(body)}\n`,hash);
    const stamp=String(now).replace(/[^0-9]/gu,'');
    const event=shelf.append({eventId:`${taskId}.${kind}.${stamp}.${hash.slice(0,8)}`,observedAt:now,actorId:L.ACTOR,kind,targetRef:`task/${taskId}`,outcome,evidenceHash:hash});
    return Object.freeze({eventHash:event.eventHash,bodyHash:hash,sequence:event.sequence});
  }
  return Object.freeze({root,verify,append});
}

// ---------- local git observation (read-only; never fetches) ----------
function gitRunner(repoRoot){
  return args=>{
    const r=cp.spawnSync('git',args,{cwd:repoRoot,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});
    return {status:r.status,stdout:r.stdout||'',error:r.error?String(r.error.message):null};
  };
}
const ok=r=>!r.error&&r.status===0;
function repoOf(run){
  const r=run(['remote','get-url','origin']);
  if(!ok(r))return null;
  const m=/github\.com[:/]([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\s*$/u.exec(r.stdout.trim());
  return m?`${m[1]}/${m[2]}`:null;
}
function gitMergeObserver({repoRoot=v0.REPO_ROOT,baseRef='origin/main',run=gitRunner(repoRoot)}={}){
  const isRepo=()=>ok(run(['rev-parse','--git-dir']));
  const blob=(sha,file)=>{const r=run(['rev-parse','--verify','--quiet',`${sha}:${file}`]);return ok(r)?r.stdout.trim():null;};
  return Object.freeze({
    repo:()=>repoOf(run),
    observeMerge({mergeSha,resultingSha,changedFiles}){
      if(!isRepo())return {available:false,error:'not a git repository'};
      const main=run(['rev-parse','--verify','--quiet',`${baseRef}^{commit}`]);
      if(!ok(main))return {available:false,error:`cannot resolve ${baseRef}`};
      const originMainSha=main.stdout.trim();
      if(!ok(run(['cat-file','-e',`${mergeSha}^{commit}`])))return {available:true,originMainSha,mergeShaExists:false,isAncestorOfMain:false,aheadOfMerge:null,parents:[],changedFilesAtMerge:[],blobMatches:{},capabilityCommit:null,mergeBeforeCapability:false};
      const anc=run(['merge-base','--is-ancestor',mergeSha,originMainSha]);
      if(anc.error||![0,1].includes(anc.status))return {available:false,error:'git merge-base failed'};
      const ahead=run(['rev-list','--count',`${mergeSha}..${originMainSha}`]);
      const parentsOut=run(['rev-list','--parents','-n','1',mergeSha]);
      if(!ok(parentsOut))return {available:false,error:'git rev-list failed'};
      const parents=parentsOut.stdout.trim().split(/\s+/u).slice(1);
      const diff=parents.length?run(['diff','--name-only','--no-renames','-z',parents[0],mergeSha]):run(['diff-tree','--root','--no-commit-id','--name-only','-r','-z',mergeSha]);
      if(!ok(diff))return {available:false,error:'git diff failed'};
      const changedFilesAtMerge=diff.stdout.split('\0').filter(Boolean);
      const blobMatches={};
      for(const file of new Set([...changedFilesAtMerge,...changedFiles]))blobMatches[file]=blob(mergeSha,file)===blob(resultingSha,file);
      // git decides whether this merge came before the commit that introduced the lifecycle capability
      const added=run(['log',originMainSha,'--diff-filter=A','--format=%H','--',CAPABILITY_FILE]);
      const capabilityCommit=ok(added)&&added.stdout.trim()?added.stdout.trim().split('\n').pop():null;
      let mergeBeforeCapability=false;
      if(capabilityCommit&&capabilityCommit!==mergeSha)mergeBeforeCapability=run(['merge-base','--is-ancestor',mergeSha,capabilityCommit]).status===0;
      return {available:true,originMainSha,mergeShaExists:true,isAncestorOfMain:anc.status===0,aheadOfMerge:ok(ahead)?Number(ahead.stdout.trim()):null,parents,changedFilesAtMerge,blobMatches,capabilityCommit,mergeBeforeCapability};
    },
    observeWorkflows(sha){
      if(!isRepo())return {available:false,error:'not a git repository'};
      const tree=run(['ls-tree','-r','--name-only',sha,'--','.github/workflows']);
      if(!ok(tree))return {available:false,error:'cannot list workflow definitions at the merge commit'};
      const list=[];
      for(const file of tree.stdout.split('\n').filter(f=>/\.ya?ml$/u.test(f))){
        const content=run(['show',`${sha}:${file}`]);
        if(!ok(content))return {available:false,error:`cannot read ${file}`};
        list.push({path:file,name:L.workflowName(content.stdout),pushMain:L.workflowTriggersMainPush(content.stdout)});
      }
      return {available:true,list};
    }
  });
}
const safely=(fn,fallback)=>{try{return fn();}catch(error){return {...fallback,error:String(error.message).slice(0,160)};}};

// ---------- views ----------
function view(ctx){
  const v0view=ctx.v0ledger.view();
  const lv=ctx.lifecycle.verify();
  return {v0view,lv,lifecycle:L.reduceLifecycle({v0Tasks:v0view.reduced.tasks,entries:lv.entries})};
}
function v0Facts(v0view,taskId){
  const t=v0view.reduced.tasks.find(x=>x.taskId===taskId);
  if(!t)return {error:'TASK_UNKNOWN'};
  if(t.state!=='CLOSED')return {error:`TASK_NOT_INGESTED:${t.state}`};
  const ing=[...t.reports].reverse().find(r=>r.body.verification&&r.body.verification.outcome==='INGESTED');
  if(!ing)return {error:'NO_ACCEPTED_INGESTION'};
  return {task:t,ingestion:ing,resultingSha:ing.body.report.resultingSha,changedFiles:[...ing.body.report.changedFiles],baseSha:t.order.baseSha,branch:t.order.branch,
    orderEventHash:t.openedRef.eventHash,ingestionEventHash:ing.ref.eventHash,expectedFilesHash:base.expectedFilesHash(t.order.expectedFiles)};
}

// ---------- commands ----------
function linkPr(ctx,{taskId,prNumber,claimedMergeSha,claimedRuns=[],claimedBy='operator'}){
  const {v0view,lifecycle}=view(ctx);
  const facts=v0Facts(v0view,taskId);
  if(facts.error)return {ok:false,status:'LINK_REFUSED',reasons:[facts.error]};
  const lt=lifecycle.tasks.find(t=>t.taskId===taskId);
  if(!['INGESTED','PR_LINKED','PR_OPEN','MERGE_CONTRADICTED'].includes(lt.state))return {ok:false,status:'LINK_REFUSED',reasons:[`TASK_NOT_LINKABLE:${lt.state}`]};
  if(lt.link&&lt.link.prNumber!==prNumber)return {ok:false,status:'LINK_REFUSED',reasons:['TASK_ALREADY_LINKED_TO_OTHER_PR']};
  const repo=ctx.repo;
  if(!repo)return {ok:false,status:'LINK_REFUSED',reasons:['REPO_UNKNOWN']};
  const other=lifecycle.tasks.find(t=>t.taskId!==taskId&&t.link&&t.link.prNumber===prNumber&&t.link.repo===repo);
  if(other)return {ok:false,status:'LINK_REFUSED',reasons:[`PR_ALREADY_LINKED:${other.taskId}`]};
  const claims=[];
  if(claimedMergeSha)claims.push({kind:'merge.sha',value:claimedMergeSha,source:claimedBy,label:'UNVERIFIED'});
  for(const id of claimedRuns)claims.push({kind:'ci.run',value:String(id),source:claimedBy,label:'UNVERIFIED'});
  const v=L.validateLink({taskId,prNumber,repo,claims,linkedAt:ctx.now,v0Refs:{orderEventHash:facts.orderEventHash,ingestionEventHash:facts.ingestionEventHash,resultingSha:facts.resultingSha,baseSha:facts.baseSha,branch:facts.branch,expectedFilesHash:facts.expectedFilesHash}});
  if(!v.ok)return {ok:false,status:'LINK_REFUSED',reasons:v.errors};
  const r=ctx.lifecycle.append({kind:'pr.linked',taskId,outcome:'linked',now:ctx.now,body:{schema:'sinbad-pr-link/0-v1',link:v.link}});
  return {ok:true,status:'PR_LINKED',taskId,prNumber,...r};
}
function observeMerge(ctx,taskId,{allowedStates}){
  const {v0view,lifecycle}=view(ctx);
  const facts=v0Facts(v0view,taskId);
  if(facts.error)return {ok:false,status:'VERIFY_REFUSED',reasons:[facts.error]};
  const lt=lifecycle.tasks.find(t=>t.taskId===taskId);
  if(!lt.link)return {ok:false,status:'VERIFY_REFUSED',reasons:['NO_PR_LINKED']};
  if(!allowedStates.includes(lt.state))return {ok:false,status:'VERIFY_REFUSED',reasons:[`TASK_NOT_VERIFIABLE:${lt.state}`]};
  const github=safely(()=>ctx.github.getPull(lt.link.prNumber),{available:false});
  let git=null;
  if(github.available===true&&github.pull&&github.pull.merged===true&&typeof github.pull.mergeCommitSha==='string'&&/^[0-9a-f]{40}$/u.test(github.pull.mergeCommitSha))
    git=safely(()=>ctx.git.observeMerge({mergeSha:github.pull.mergeCommitSha,resultingSha:facts.resultingSha,changedFiles:facts.changedFiles}),{available:false});
  const decision=L.decideMerge({link:lt.link,facts,github,git,now:ctx.now});
  const r=ctx.lifecycle.append({kind:'merge.observed',taskId,outcome:slug(decision.outcome),now:ctx.now,body:decision});
  return {ok:decision.outcome==='MERGED_VERIFIED',status:`MERGE_${decision.outcome}`,decision,lt,facts,...r};
}
function verifyMerge(ctx,taskId){
  const r=observeMerge(ctx,taskId,{allowedStates:['PR_LINKED','PR_OPEN','MERGE_CONTRADICTED','MERGED','POST_MERGE_PENDING','POST_MERGE_FAILED','POST_MERGE_BLOCKED']});
  if(!r.decision)return r;
  const {lt,facts,...rest}=r;return rest;
}
function verifyCi(ctx,taskId){
  // the merge is observed again in this same command: completion never rests on an older observation
  const m=observeMerge(ctx,taskId,{allowedStates:['MERGED','POST_MERGE_PENDING','POST_MERGE_FAILED','POST_MERGE_BLOCKED']});
  if(!m.decision)return m;
  if(m.decision.outcome!=='MERGED_VERIFIED')return {ok:false,status:'MERGE_NOT_VERIFIED',merge:m.decision,mergeEventHash:m.eventHash};
  const {lt}=m,mergeSha=m.decision.mergeSha;
  const github=safely(()=>ctx.github.listRuns(mergeSha),{available:false,complete:false,runs:[]});
  const claimedRuns=lt.link.claims.filter(c=>c.kind==='ci.run').map(c=>safely(()=>ctx.github.getRun(Number(c.value)),{id:Number(c.value),available:false,found:false,run:null}));
  const workflows=safely(()=>ctx.git.observeWorkflows(mergeSha),{available:false});
  const git={available:true,isAncestorOfMain:m.decision.git.isAncestorOfMain};
  const decision=L.decideCi({link:lt.link,mergeSha,mergeEventHash:m.eventHash,github,claimedRuns,workflows,git,now:ctx.now});
  const r=ctx.lifecycle.append({kind:'ci.observed',taskId,outcome:slug(decision.outcome),now:ctx.now,body:decision});
  if(decision.outcome!=='POST_MERGE_VERIFIED')return {ok:false,status:`CI_${decision.outcome}`,decision,...r};
  const done=ctx.lifecycle.append({kind:'task.completed',taskId,outcome:'completed',now:ctx.now,body:{schema:'sinbad-task-completion/0-v1',taskId,prNumber:lt.link.prNumber,mergeSha,mergeEventHash:m.eventHash,ciEventHash:r.eventHash,completedAt:ctx.now,retroactive:m.decision.retroactive}});
  return {ok:true,status:'COMPLETED',decision,completion:done,...r};
}
function summary(ctx){
  const {v0view,lv,lifecycle}=view(ctx);
  const v0s=base.buildSummary({reduced:v0view.reduced,head:v0view.head});
  const section=L.buildLifecycleSection({v0Reduced:v0view.reduced,lifecycle,head:lv.head});
  return Object.freeze({text:`${v0s.text}\n${section.text}`,v0Facts:v0s.facts,lifecycleFacts:section.facts,v0Head:v0view.head,lifecycleHead:lv.head});
}

// ---------- CLI ----------
function main(argv){
  const {command,opts}=v0.parseArgs(argv);
  const commands=['link-pr','verify-merge','verify-ci','summary'];
  if(!commands.includes(command))throw fail(`USAGE: ${commands.join('|')} (see the header of tools/sinbad-participation-lifecycle.js)`);
  const repoRoot=path.resolve(opts.repo||v0.REPO_ROOT),root=opts.root?path.resolve(opts.root):v0.defaultRoot();
  const git=gitMergeObserver({repoRoot,baseRef:opts['base-ref']||'origin/main'});
  const repo=git.repo();
  const ctx={v0ledger:v0.openLedger({root,repoRoot}),lifecycle:openLifecycle({root,repoRoot}),git,repo,github:repo?githubObserver({repo}):{getPull:()=>({available:false,error:'repository unknown'}),listRuns:()=>({available:false,complete:false,runs:[],error:'repository unknown'}),getRun:id=>({id,available:false,found:false,run:null,error:'repository unknown'})},now:new Date().toISOString()};
  let result;
  if(command==='summary'){
    const s=summary(ctx);
    if(opts.out){v0.assertOutsideRepository(path.resolve(opts.out),repoRoot,'OUTPUT_INSIDE_REPOSITORY');fs.writeFileSync(path.resolve(opts.out),s.text,{encoding:'utf8',flag:'wx'});}
    process.stdout.write(s.text);
    return 0;
  }
  if(!opts.task)throw fail('MISSING_OPTION:task');
  if(command==='link-pr'){
    const prNumber=Number(opts.pr);
    if(!opts.pr||!Number.isSafeInteger(prNumber))throw fail('MISSING_OR_INVALID_OPTION:pr');
    result=linkPr(ctx,{taskId:opts.task,prNumber,claimedMergeSha:opts['claimed-merge-sha'],claimedRuns:opts['claimed-runs']?opts['claimed-runs'].split(',').filter(Boolean):[],claimedBy:opts['claimed-by']||'operator'});
  }else if(command==='verify-merge')result=verifyMerge(ctx,opts.task);
  else result=verifyCi(ctx,opts.task);
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
  return result.ok?0:2;
}
if(require.main===module){
  try{process.exitCode=main(process.argv.slice(2));}
  catch(error){process.stderr.write(`${String(error.message)}\n`);process.exitCode=String(error.message).startsWith('LEDGER_INVALID')?3:1;}
}
module.exports=Object.freeze({openLifecycle,gitMergeObserver,repoOf,view,v0Facts,linkPr,verifyMerge,verifyCi,summary,CAPABILITY_FILE});
