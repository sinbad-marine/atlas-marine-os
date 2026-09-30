'use strict';
// SINBAD Post-Merge Lifecycle v0. Offline: injected GitHub and git observers, temporary directories and, for the git
// observer only, a throw-away local repository. No network, no model, nothing written inside the repository.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const base=require('../sinbad-ai-core/participation/participation-v0');
const L=require('../sinbad-ai-core/participation/lifecycle-v0');
const v0=require('../tools/sinbad-participation');
const T=require('../tools/sinbad-participation-lifecycle');
const G=require('../tools/sinbad-participation-github');

const ROOT=path.resolve(__dirname,'..');
const H='1'.repeat(40),RESULT='a'.repeat(40),MERGE='b'.repeat(40),MAIN='c'.repeat(40),CAP='d'.repeat(40),OTHER='e'.repeat(40);
const REPO='sinbad-marine/atlas-marine-os';
const T0=Date.parse('2026-10-01T10:00:00.000Z');
const at=min=>new Date(T0+min*60000).toISOString();
const FILES=['src/widget.js','tests/widget.test.js'];

const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'sinbad-life-'));
const order=(over={})=>({taskId:'T-A',kind:'task',title:'Add the widget',origin:'OWNER_DIRECTED',originNote:'',ownerStatement:'Owner: build the widget.',agentId:'claude',baseSha:H,branch:'codex/widget',expectedFiles:FILES,
  context:'The widget is missing.',plan:'Write it.',decisions:[],rejectedAlternatives:[],hold:false,sinbadCapabilityBefore:'SINBAD had no record of this work.',sinbadCapabilityAfter:'SINBAD records this work.',...over});
const report=(over={})=>({taskId:'T-A',agentId:'claude',baseSha:H,resultingSha:RESULT,branch:'codex/widget',changedFiles:FILES,actions:['wrote it'],failures:[],evidence:['commit'],
  tests:[{name:'suite',command:'node --test',reportedOutcome:'PASS'}],result:'Done.',lessons:[],decisions:[],rejectedAlternatives:[],capabilityGained:'SINBAD verified this report against git.',reportedAt:at(30),...over});
const v0Observer=()=>({observeHead:()=>({available:true,headSha:H,baseShaExists:true,dirtyPaths:[]}),observeResult:(o,r)=>({available:true,resultingShaExists:true,baseIsAncestor:true,observedChangedFiles:r.changedFiles,branchTip:r.resultingSha})});
const runs=(over={})=>['Release quality','Controlled Pages release'].map((name,i)=>({id:1000+i,name,event:'push',headSha:MERGE,status:'completed',conclusion:'success',runAttempt:1,createdAt:at(40),...over}));
const WORKFLOWS=()=>[{path:'.github/workflows/argos-assurance.yml',name:'ARGOS scheduled assurance',pushMain:false},{path:'.github/workflows/pages-release.yml',name:'Controlled Pages release',pushMain:true},{path:'.github/workflows/release-quality.yml',name:'Release quality',pushMain:true}];
function fakes(state){
  return {
    github:{
      getPull:()=>state.pullUnavailable?{available:false,error:'fake: unavailable'}:state.pullNotFound?{available:true,notFound:true}:{available:true,notFound:false,pull:state.pull},
      listRuns:()=>state.runsUnavailable?{available:false,complete:false,runs:[],error:'fake: unavailable'}:{available:true,complete:state.runsComplete!==false,runs:state.runs},
      getRun:id=>{if(state.runLookups&&state.runLookups[id])return state.runLookups[id];const run=state.runs.find(r=>r.id===id)||null;return {id,available:true,found:Boolean(run),run};}
    },
    git:{
      repo:()=>REPO,
      observeMerge:()=>state.gitUnavailable?{available:false,error:'fake: unavailable'}:state.merge,
      observeWorkflows:()=>state.workflowsUnavailable?{available:false,error:'fake: unavailable'}:{available:true,list:state.workflows}
    }
  };
}
function mk(){
  const dir=tmp(),repoRoot=path.join(dir,'repo');fs.mkdirSync(repoRoot);
  const root=path.join(dir,'ledger');
  const state={pull:{number:311,state:'closed',merged:true,mergedAt:at(35),mergeCommitSha:MERGE,headSha:RESULT,baseRef:'main'},
    merge:{available:true,originMainSha:MAIN,mergeShaExists:true,isAncestorOfMain:true,aheadOfMerge:3,parents:[H],changedFilesAtMerge:FILES,blobMatches:{'src/widget.js':true,'tests/widget.test.js':true},capabilityCommit:CAP,mergeBeforeCapability:false},
    runs:runs(),workflows:WORKFLOWS()};
  const v0ledger=v0.openLedger({root,repoRoot}),lifecycle=T.openLifecycle({root,repoRoot});
  const f=fakes(state);
  const ctx={v0ledger,lifecycle,git:f.git,github:f.github,repo:REPO,now:at(50)};
  return {dir,repoRoot,root,state,v0ledger,lifecycle,ctx,reopen:()=>({v0ledger:v0.openLedger({root,repoRoot}),lifecycle:T.openLifecycle({root,repoRoot})})};
}
// drive a task through the accepted v0 gate up to an accepted report (v0 state CLOSED = IMPLEMENTATION INGESTED)
function ingested(m,taskId='T-A',over={},reportOver={}){
  const c={ledger:m.v0ledger,observer:v0Observer(),now:at(0)};
  assert.equal(v0.open(c,order({taskId,...over})).ok,true);
  c.now=at(1);assert.equal(v0.preflight(c,taskId).ok,true);
  c.now=at(2);assert.equal(v0.delegate(c,taskId).ok,true);
  c.now=at(30);assert.equal(v0.ingest(c,JSON.stringify(report({taskId,...reportOver}))).status,'REPORT_INGESTED');
}
const link=(m,over)=>T.linkPr(m.ctx,{taskId:'T-A',prNumber:311,...over});
const stateOf=(m,id='T-A')=>T.view(m.ctx).lifecycle.tasks.find(t=>t.taskId===id).state;
function ready(m,over){ingested(m);assert.equal(link(m,over).ok,true);}
const bodiesDir=m=>path.join(m.root,'bodies');
const lifeDir=m=>path.join(m.root,L.SHELF_ID);
const ev=(m)=>T.view(m.ctx);

test('link-pr: only an ingested task can be linked; one PR per task; claims stay UNVERIFIED',()=>{
  const m=mk();
  assert.deepEqual(link(m).reasons,['TASK_UNKNOWN']);
  // a task that is only delegated is not linkable
  const c={ledger:m.v0ledger,observer:v0Observer(),now:at(0)};
  v0.open(c,order());c.now=at(1);v0.preflight(c,'T-A');c.now=at(2);v0.delegate(c,'T-A');
  assert.match(link(m).reasons[0],/TASK_NOT_INGESTED:DELEGATED/u);
  c.now=at(30);v0.ingest(c,JSON.stringify(report()));
  const r=link(m,{claimedMergeSha:MERGE,claimedRuns:[1000,1001],claimedBy:'claude'});
  assert.equal(r.ok,true);assert.equal(r.status,'PR_LINKED');
  const t=ev(m).lifecycle.tasks[0];
  assert.equal(t.state,'PR_LINKED');assert.deepEqual(t.link.claims.map(x=>[x.kind,x.label,x.source]),[['merge.sha','UNVERIFIED','claude'],['ci.run','UNVERIFIED','claude'],['ci.run','UNVERIFIED','claude']]);
  assert.equal(t.link.v0Refs.resultingSha,RESULT);
  // relinking the same PR (for example to correct claims) is allowed, another PR is not
  assert.equal(link(m,{claimedMergeSha:MERGE}).ok,true);
  assert.deepEqual(T.linkPr(m.ctx,{taskId:'T-A',prNumber:312}).reasons,['TASK_ALREADY_LINKED_TO_OTHER_PR']);
  // one PR cannot belong to two tasks
  ingested(m,'T-B',{branch:'codex/b',expectedFiles:['other/file.js']},{branch:'codex/b',changedFiles:['other/file.js']});
  assert.deepEqual(T.linkPr(m.ctx,{taskId:'T-B',prNumber:311}).reasons,['PR_ALREADY_LINKED:T-A']);
  // invalid or secret-looking claims and an unknown repository are refused
  assert.ok(T.linkPr(m.ctx,{taskId:'T-B',prNumber:313,claimedMergeSha:'nope'}).reasons.includes('CLAIM_INVALID'));
  assert.ok(T.linkPr(m.ctx,{taskId:'T-B',prNumber:313,claimedMergeSha:MERGE,claimedBy:'password: abcdefghijkl1234'}).reasons.some(x=>x.startsWith('SECRET_PATTERN')));
  assert.deepEqual(T.linkPr({...m.ctx,repo:null},{taskId:'T-B',prNumber:313}).reasons,['REPO_UNKNOWN']);
  assert.ok(T.linkPr(m.ctx,{taskId:'T-B',prNumber:0}).reasons.includes('PR_NUMBER_INVALID'));
});

test('a wrong PR head, number or base is CONTRADICTED and blocks the merge',()=>{
  const m=mk();ready(m);
  m.state.pull={...m.state.pull,headSha:OTHER};m.ctx.now=at(51);
  let r=T.verifyMerge(m.ctx,'T-A');
  assert.equal(r.ok,false);assert.equal(r.decision.outcome,'MERGE_CONTRADICTED');
  const head=r.decision.checks.find(c=>c.id==='PR_HEAD_MATCHES_INGESTED_RESULT');assert.equal(head.label,'CONTRADICTED');assert.match(head.detail,/PR_HEAD_DIFFERS/u);
  assert.equal(stateOf(m),'MERGE_CONTRADICTED');
  m.state.pull={...m.state.pull,headSha:RESULT,number:999};m.ctx.now=at(52);assert.equal(T.verifyMerge(m.ctx,'T-A').decision.outcome,'MERGE_CONTRADICTED');
  m.state.pull={...m.state.pull,number:311,baseRef:'develop'};m.ctx.now=at(53);assert.equal(T.verifyMerge(m.ctx,'T-A').decision.outcome,'MERGE_CONTRADICTED');
  m.state.pullNotFound=true;m.ctx.now=at(54);assert.equal(T.verifyMerge(m.ctx,'T-A').decision.outcome,'MERGE_CONTRADICTED');
});

test('an open or closed-unmerged PR is observed without completing; closed-unmerged is terminal',()=>{
  const m=mk();ready(m);
  m.state.pull={...m.state.pull,state:'open',merged:false,mergedAt:null,mergeCommitSha:null};m.ctx.now=at(51);
  let r=T.verifyMerge(m.ctx,'T-A');assert.equal(r.decision.outcome,'PR_OPEN');assert.equal(r.ok,false);assert.equal(stateOf(m),'PR_OPEN');
  assert.equal(r.decision.checks.find(c=>c.id==='PR_HEAD_MATCHES_INGESTED_RESULT').label,'VERIFIED');
  m.state.pull={...m.state.pull,state:'closed'};m.ctx.now=at(52);
  r=T.verifyMerge(m.ctx,'T-A');assert.equal(r.decision.outcome,'PR_CLOSED_UNMERGED');assert.equal(stateOf(m),'PR_CLOSED_UNMERGED');
  assert.match(T.verifyMerge(m.ctx,'T-A').reasons[0],/TASK_NOT_VERIFIABLE:PR_CLOSED_UNMERGED/u);
  assert.match(T.verifyCi(m.ctx,'T-A').reasons[0],/TASK_NOT_VERIFIABLE/u);
});

test('an absent merge SHA, a merge not in main, or a changed-file or blob mismatch is CONTRADICTED',()=>{
  const cases=[
    ['no merge commit reported',s=>{s.pull={...s.pull,mergeCommitSha:null};},'MERGE_SHA_PRESENT'],
    ['merge commit not present locally',s=>{s.merge={...s.merge,mergeShaExists:false,isAncestorOfMain:false};},'MERGE_SHA_EXISTS_LOCALLY'],
    ['merge not contained in main',s=>{s.merge={...s.merge,isAncestorOfMain:false};},'MERGE_CONTAINED_IN_MAIN'],
    ['extra file in the merge',s=>{s.merge={...s.merge,changedFilesAtMerge:[...FILES,'config/extra.json'],blobMatches:{...s.merge.blobMatches,'config/extra.json':true}};},'CHANGED_FILES_MATCH_INGESTED'],
    ['file missing from the merge',s=>{s.merge={...s.merge,changedFilesAtMerge:[FILES[0]]};},'CHANGED_FILES_MATCH_INGESTED'],
    ['blob differs from the ingested result',s=>{s.merge={...s.merge,blobMatches:{...s.merge.blobMatches,'src/widget.js':false}};},'BLOBS_MATCH_INGESTED_RESULT']
  ];
  for(const [name,mutate,checkId] of cases){
    const m=mk();ready(m);mutate(m.state);m.ctx.now=at(51);
    const r=T.verifyMerge(m.ctx,'T-A');
    assert.equal(r.ok,false,name);assert.equal(r.decision.outcome,'MERGE_CONTRADICTED',name);
    assert.equal(r.decision.checks.find(c=>c.id===checkId).pass,false,name);
    assert.equal(stateOf(m),'MERGE_CONTRADICTED',name);
    // a contradicted merge can never be completed
    m.ctx.now=at(52);assert.equal(T.verifyCi(m.ctx,'T-A').ok,false,name);
    assert.notEqual(stateOf(m),'COMPLETED',name);
  }
});

test('a verified merge records GitHub and local git evidence; claims are never elevated and a wrong claim contradicts',()=>{
  const m=mk();ready(m,{claimedMergeSha:MERGE,claimedBy:'claude'});m.ctx.now=at(51);
  const r=T.verifyMerge(m.ctx,'T-A');
  assert.equal(r.ok,true);assert.equal(r.decision.outcome,'MERGED_VERIFIED');assert.equal(r.decision.mergeSha,MERGE);assert.equal(stateOf(m),'MERGED');
  assert.equal(r.decision.git.aheadOfMerge,3);assert.ok(r.decision.checks.every(c=>c.label==='VERIFIED'));
  assert.deepEqual(r.decision.claims.map(c=>[c.kind,c.label]),[['merge.sha','UNVERIFIED']]);
  assert.match(r.decision.claims[0].basis,/not elevated/u);
  const bad=mk();ready(bad,{claimedMergeSha:OTHER});bad.ctx.now=at(51);
  const b=T.verifyMerge(bad.ctx,'T-A');
  assert.equal(b.decision.outcome,'MERGE_CONTRADICTED');assert.equal(b.decision.claims[0].label,'CONTRADICTED');
  // corrected claims by relinking allow a fresh observation
  assert.equal(T.linkPr(bad.ctx,{taskId:'T-A',prNumber:311,claimedMergeSha:MERGE}).ok,true);
  bad.ctx.now=at(52);assert.equal(T.verifyMerge(bad.ctx,'T-A').decision.outcome,'MERGED_VERIFIED');
});

test('unavailable GitHub or local git observation fails closed: recorded, state unchanged, nothing completes',()=>{
  const m=mk();ready(m);
  m.state.pullUnavailable=true;m.ctx.now=at(51);
  let r=T.verifyMerge(m.ctx,'T-A');
  assert.equal(r.ok,false);assert.equal(r.decision.outcome,'OBSERVATION_UNAVAILABLE');assert.match(r.decision.unavailableReason,/github/u);assert.equal(stateOf(m),'PR_LINKED');
  m.state.pullUnavailable=false;m.state.gitUnavailable=true;m.ctx.now=at(52);
  r=T.verifyMerge(m.ctx,'T-A');assert.equal(r.decision.outcome,'OBSERVATION_UNAVAILABLE');assert.match(r.decision.unavailableReason,/git/u);assert.equal(stateOf(m),'PR_LINKED');
  assert.equal(r.decision.mergeSha,MERGE);
  // a thrown observer is treated as unavailable too
  m.ctx.github={getPull(){throw new Error('boom');}};m.ctx.now=at(53);
  assert.equal(T.verifyMerge(m.ctx,'T-A').decision.outcome,'OBSERVATION_UNAVAILABLE');
  // the merge is observed again inside verify-ci; if that is unavailable there is no CI evidence and no completion
  const n=mk();ready(n);n.ctx.now=at(51);T.verifyMerge(n.ctx,'T-A');
  n.state.gitUnavailable=true;n.ctx.now=at(52);
  const c=T.verifyCi(n.ctx,'T-A');assert.equal(c.ok,false);assert.equal(c.status,'MERGE_NOT_VERIFIED');assert.equal(stateOf(n),'MERGED');
  assert.equal(ev(n).lifecycle.tasks[0].cis.length,0);
});

test('COMPLETED: every required workflow succeeded on the exact merge SHA, merge re-observed, nothing contradicts',()=>{
  const m=mk();ready(m,{claimedMergeSha:MERGE,claimedRuns:[1000,1001],claimedBy:'claude'});
  m.ctx.now=at(51);assert.equal(T.verifyMerge(m.ctx,'T-A').ok,true);
  m.ctx.now=at(52);
  const r=T.verifyCi(m.ctx,'T-A');
  assert.equal(r.ok,true);assert.equal(r.status,'COMPLETED');assert.equal(r.decision.outcome,'POST_MERGE_VERIFIED');
  assert.deepEqual(r.decision.perWorkflow.map(w=>[w.workflow,w.verdict]),[['Controlled Pages release','VERIFIED'],['Release quality','VERIFIED']]);
  const row=r.decision.runs[0];assert.deepEqual(Object.keys(row).sort(),['conclusion','createdAt','event','headSha','runAttempt','runId','status','workflow']);
  assert.equal(stateOf(m),'COMPLETED');
  const t=ev(m).lifecycle.tasks[0];
  assert.equal(t.completed.body.mergeSha,MERGE);assert.equal(t.completed.body.ciEventHash,t.cis[0].ref.eventHash);
  assert.equal(t.completed.body.retroactive.state,'FORWARD');
  assert.deepEqual(r.decision.claims.map(c=>c.label),['UNVERIFIED','UNVERIFIED']);
  // terminal: nothing more is accepted
  m.ctx.now=at(60);assert.match(T.verifyCi(m.ctx,'T-A').reasons[0],/TASK_NOT_VERIFIABLE:COMPLETED/u);assert.match(T.verifyMerge(m.ctx,'T-A').reasons[0],/TASK_NOT_VERIFIABLE:COMPLETED/u);
  assert.equal(T.linkPr(m.ctx,{taskId:'T-A',prNumber:311}).ok,false);
});

test('incomplete, missing, failed, cancelled or wrong-SHA CI does not complete the task',()=>{
  const mustNotComplete=(name,mutate,outcome,state)=>{
    const m=mk();ready(m);m.ctx.now=at(51);T.verifyMerge(m.ctx,'T-A');mutate(m.state);m.ctx.now=at(52);
    const r=T.verifyCi(m.ctx,'T-A');
    assert.equal(r.ok,false,name);assert.equal(r.decision.outcome,outcome,name);assert.equal(stateOf(m),state,name);assert.equal(ev(m).lifecycle.tasks[0].completed,null,name);
    return r;
  };
  let r=mustNotComplete('one workflow missing',s=>{s.runs=[s.runs[0]];},'POST_MERGE_PENDING','POST_MERGE_PENDING');
  assert.ok(r.decision.perWorkflow.some(w=>w.verdict==='MISSING'));
  mustNotComplete('no runs at all',s=>{s.runs=[];},'POST_MERGE_PENDING','POST_MERGE_PENDING');
  r=mustNotComplete('in progress',s=>{s.runs=runs().map((x,i)=>i?x:{...x,status:'in_progress',conclusion:null});},'POST_MERGE_PENDING','POST_MERGE_PENDING');
  assert.ok(r.decision.perWorkflow.some(w=>w.verdict==='INCOMPLETE'));
  mustNotComplete('queued',s=>{s.runs=runs().map((x,i)=>i?x:{...x,status:'queued',conclusion:null});},'POST_MERGE_PENDING','POST_MERGE_PENDING');
  for(const conclusion of ['failure','cancelled','timed_out','skipped','neutral','action_required'])mustNotComplete(conclusion,s=>{s.runs=runs().map((x,i)=>i?x:{...x,conclusion});},'POST_MERGE_FAILED','POST_MERGE_FAILED');
  // runs of another SHA never count: a run list that leaks one is a contradiction
  r=mustNotComplete('run of another sha in the list',s=>{s.runs=[...runs(),{...runs()[0],id:2000,headSha:OTHER}];},'CONTRADICTED','POST_MERGE_BLOCKED');
  assert.ok(r.decision.reasons.some(x=>x.startsWith('GITHUB_RETURNED_RUNS_OF_OTHER_SHA')));
  // only push events on the merge SHA count
  r=mustNotComplete('only a manual run exists',s=>{s.runs=runs({event:'workflow_dispatch'});},'POST_MERGE_PENDING','POST_MERGE_PENDING');
  assert.equal(r.decision.nonRequired.length,2);
  mustNotComplete('pull_request run does not count',s=>{s.runs=runs({event:'pull_request'});},'POST_MERGE_PENDING','POST_MERGE_PENDING');
  // the merge leaving main between merge and CI observation is a contradiction
  const m=mk();ready(m);m.ctx.now=at(51);T.verifyMerge(m.ctx,'T-A');m.state.merge={...m.state.merge,isAncestorOfMain:false};m.ctx.now=at(52);
  const x=T.verifyCi(m.ctx,'T-A');assert.equal(x.status,'MERGE_NOT_VERIFIED');assert.equal(stateOf(m),'MERGE_CONTRADICTED');
});

test('claimed CI runs: a run of another SHA or an unknown run contradicts; matching runs stay UNVERIFIED claims',()=>{
  const wrong=mk();ready(wrong,{claimedRuns:[5555],claimedBy:'claude'});
  wrong.state.runLookups={5555:{id:5555,available:true,found:true,run:{id:5555,name:'Release quality',event:'push',headSha:OTHER,status:'completed',conclusion:'success'}}};
  wrong.ctx.now=at(51);T.verifyMerge(wrong.ctx,'T-A');wrong.ctx.now=at(52);
  let r=T.verifyCi(wrong.ctx,'T-A');
  assert.equal(r.ok,false);assert.equal(r.decision.outcome,'CONTRADICTED');assert.ok(r.decision.reasons.includes('CI_RUN_BELONGS_TO_OTHER_SHA:5555'));assert.equal(r.decision.claims[0].label,'CONTRADICTED');assert.equal(stateOf(wrong),'POST_MERGE_BLOCKED');
  const unknown=mk();ready(unknown,{claimedRuns:[7777]});unknown.state.runLookups={7777:{id:7777,available:true,found:false,run:null}};
  unknown.ctx.now=at(51);T.verifyMerge(unknown.ctx,'T-A');unknown.ctx.now=at(52);
  r=T.verifyCi(unknown.ctx,'T-A');assert.equal(r.decision.outcome,'CONTRADICTED');assert.ok(r.decision.reasons.includes('CLAIMED_RUN_NOT_FOUND:7777'));
  const gone=mk();ready(gone,{claimedRuns:[1000]});gone.state.runLookups={1000:{id:1000,available:false,found:false,run:null}};
  gone.ctx.now=at(51);T.verifyMerge(gone.ctx,'T-A');gone.ctx.now=at(52);
  assert.equal(T.verifyCi(gone.ctx,'T-A').decision.outcome,'OBSERVATION_UNAVAILABLE');
  // corrected claims after a contradiction: relink, observe again, then complete
  assert.equal(T.linkPr(wrong.ctx,{taskId:'T-A',prNumber:311}).ok,false);
  const ok=mk();ready(ok,{claimedRuns:[1000,1001]});ok.ctx.now=at(51);T.verifyMerge(ok.ctx,'T-A');ok.ctx.now=at(52);
  r=T.verifyCi(ok.ctx,'T-A');assert.equal(r.ok,true);assert.ok(r.decision.claims.every(c=>c.label==='UNVERIFIED'));
});

test('duplicate runs and non-required workflows: every required run must succeed; other workflows never block',()=>{
  const dup=mk();ready(dup);dup.ctx.now=at(51);T.verifyMerge(dup.ctx,'T-A');
  dup.state.runs=[...runs(),{...runs()[0],id:3000,createdAt:at(45)},{...runs()[1],id:3001,createdAt:at(46)}];dup.ctx.now=at(52);
  let r=T.verifyCi(dup.ctx,'T-A');
  assert.equal(r.ok,true);assert.deepEqual(r.decision.perWorkflow.map(w=>w.runs),[2,2]);
  const dupFail=mk();ready(dupFail);dupFail.ctx.now=at(51);T.verifyMerge(dupFail.ctx,'T-A');
  dupFail.state.runs=[...runs(),{...runs()[0],id:3000,conclusion:'failure'}];dupFail.ctx.now=at(52);
  assert.equal(T.verifyCi(dupFail.ctx,'T-A').decision.outcome,'POST_MERGE_FAILED');
  const other=mk();ready(other);other.ctx.now=at(51);T.verifyMerge(other.ctx,'T-A');
  other.state.runs=[...runs(),{id:4000,name:'ARGOS scheduled assurance',event:'schedule',headSha:MERGE,status:'completed',conclusion:'failure',runAttempt:1,createdAt:at(41)},{id:4001,name:'Release quality',event:'workflow_dispatch',headSha:MERGE,status:'completed',conclusion:'failure',runAttempt:1,createdAt:at(42)}];
  other.ctx.now=at(52);r=T.verifyCi(other.ctx,'T-A');
  assert.equal(r.ok,true);assert.deepEqual(r.decision.nonRequired.map(x=>x.runId).sort(),[4000,4001]);
  assert.match(T.summary(other.ctx).text,/non-required run \(does not block completion\): workflow ARGOS scheduled assurance; run 4000/u);
});

test('unavailable or incomplete CI observation fails closed',()=>{
  const cases=[['github runs unavailable',s=>{s.runsUnavailable=true;}],['run list incomplete (pagination)',s=>{s.runsComplete=false;}],['workflow definitions unavailable',s=>{s.workflowsUnavailable=true;}]];
  for(const [name,mutate] of cases){
    const m=mk();ready(m);m.ctx.now=at(51);T.verifyMerge(m.ctx,'T-A');mutate(m.state);m.ctx.now=at(52);
    const r=T.verifyCi(m.ctx,'T-A');
    assert.equal(r.ok,false,name);assert.equal(r.decision.outcome,'OBSERVATION_UNAVAILABLE',name);assert.ok(r.decision.unavailableReason,name);assert.equal(stateOf(m),'MERGED',name);
  }
});

test('workflow-set drift fails closed: a changed, undecidable or missing trigger set blocks completion',()=>{
  const cases=[
    ['a third workflow now runs on push to main',s=>{s.workflows=[...WORKFLOWS(),{path:'x.yml',name:'New gate',pushMain:true}];}],
    ['a required workflow no longer runs on push to main',s=>{s.workflows=WORKFLOWS().map(w=>w.name==='Release quality'?{...w,pushMain:false}:w);}],
    ['a required workflow was renamed',s=>{s.workflows=WORKFLOWS().map(w=>w.name==='Release quality'?{...w,name:'Release quality v2'}:w);}],
    ['a trigger cannot be decided',s=>{s.workflows=WORKFLOWS().map(w=>w.name==='Release quality'?{...w,pushMain:null}:w);}],
    ['no workflow definitions',s=>{s.workflows=[];}]
  ];
  for(const [name,mutate] of cases){
    const m=mk();ready(m);m.ctx.now=at(51);T.verifyMerge(m.ctx,'T-A');mutate(m.state);m.ctx.now=at(52);
    const r=T.verifyCi(m.ctx,'T-A');
    assert.equal(r.ok,false,name);assert.equal(r.decision.outcome,'WORKFLOW_SET_DRIFT',name);assert.equal(stateOf(m),'POST_MERGE_BLOCKED',name);
  }
  assert.deepEqual(L.REQUIRED_WORKFLOWS,['Controlled Pages release','Release quality']);
  assert.equal(L.checkWorkflowSet(null).ok,false);
});

test('the required workflow constant matches the repository workflow definitions (drift test)',()=>{
  const dir=path.join(ROOT,'.github','workflows');
  const list=fs.readdirSync(dir).filter(f=>/\.ya?ml$/u.test(f)).map(f=>{const text=fs.readFileSync(path.join(dir,f),'utf8');return {path:f,name:L.workflowName(text),pushMain:L.workflowTriggersMainPush(text)};});
  assert.ok(list.length>=4);
  for(const w of list){assert.equal(typeof w.name,'string',w.path);assert.notEqual(w.pushMain,null,`${w.path} trigger is undecidable`);}
  const check=L.checkWorkflowSet(list);
  assert.equal(check.ok,true,`workflow drift: ${JSON.stringify(check)} - update REQUIRED_WORKFLOWS only with an Owner decision`);
  assert.deepEqual(check.computed,[...L.REQUIRED_WORKFLOWS].sort());
  assert.equal(list.find(w=>w.name==='ARGOS scheduled assurance').pushMain,false);
});

test('the workflow trigger reader handles the forms it must and gives up (null) on the rest',()=>{
  const f=L.workflowTriggersMainPush;
  assert.equal(f('name: a\non:\n  push:\n    branches: [main]\n  workflow_dispatch:\n'),true);
  assert.equal(f('name: a\non:\n  push:\n    branches:\n      - main\n      - release\n'),true);
  assert.equal(f('name: a\non:\n  push:\n    branches: [develop, "feature/*"]\n'),null);
  assert.equal(f('name: a\non:\n  push:\n    branches: [develop]\n'),false);
  assert.equal(f('name: a\non:\n  push:\n    branches: ["**"]\n'),true);
  assert.equal(f('name: a\non:\n  push:\n'),true);
  assert.equal(f('name: a\non: push\n'),true);
  assert.equal(f('name: a\non: [push, pull_request]\n'),true);
  assert.equal(f('name: a\non: [pull_request]\n'),false);
  assert.equal(f('name: a\non:\n  schedule:\n    - cron: "1 1 * * *"\n  workflow_dispatch:\n'),false);
  assert.equal(f('name: a\non:\n  push:\n    tags: [v*]\n'),false);
  assert.equal(f('name: a\non:\n  push:\n    branches-ignore: [main]\n'),false);
  assert.equal(f('name: a\non:\n  push:\n    branches-ignore: [wip]\n'),true);
  assert.equal(f('name: a\non:\n  push:\n    paths: ["src/**"]\n'),null);
  assert.equal(f('name: a\non:\n  push: {branches: [main]}\n'),null);
  assert.equal(f('name: a\njobs: {}\n'),null);
  assert.equal(f('name: a\non: {push: {}}\n'),null);
  assert.equal(L.workflowName('name: "Release quality"\non: push\n'),'Release quality');assert.equal(L.workflowName('on: push\n'),null);
});

test('retroactive status comes from git ancestry, never from a flag',()=>{
  assert.equal(L.retroactiveOf({available:true,capabilityCommit:CAP,mergeBeforeCapability:true}).state,'RETROACTIVE');
  assert.match(L.retroactiveOf({available:true,capabilityCommit:CAP,mergeBeforeCapability:true}).statement,/did not exist when this task was merged/u);
  assert.equal(L.retroactiveOf({available:true,capabilityCommit:CAP,mergeBeforeCapability:false}).state,'FORWARD');
  assert.equal(L.retroactiveOf({available:true,capabilityCommit:null}).state,'UNKNOWN');
  assert.equal(L.retroactiveOf(null).state,'UNKNOWN');
  const m=mk();ready(m);m.state.merge={...m.state.merge,mergeBeforeCapability:true};
  m.ctx.now=at(51);T.verifyMerge(m.ctx,'T-A');m.ctx.now=at(52);assert.equal(T.verifyCi(m.ctx,'T-A').ok,true);
  const s=T.summary(m.ctx);
  assert.equal(ev(m).lifecycle.tasks[0].completed.body.retroactive.state,'RETROACTIVE');
  assert.match(s.text,/RETROACTIVE: the lifecycle capability did not exist when this task was merged/u);
  assert.match(s.text,/COMPLETED \(POST_MERGE_VERIFIED\)/u);
});

test('the lifecycle reducer rejects completion without evidence, forged order, terminal extensions and double links',()=>{
  const forge=(mutateEntries)=>{
    const m=mk();ready(m);m.ctx.now=at(51);T.verifyMerge(m.ctx,'T-A');
    mutateEntries(m);return m;
  };
  // COMPLETED without any CI observation
  let m=forge(x=>x.lifecycle.append({kind:'task.completed',taskId:'T-A',outcome:'completed',now:at(60),body:{schema:'sinbad-task-completion/0-v1',taskId:'T-A',prNumber:311,mergeSha:MERGE,mergeEventHash:'0'.repeat(64),ciEventHash:'1'.repeat(64),completedAt:at(60),retroactive:{}}}));
  assert.throws(()=>T.view(m.ctx),/LEDGER_INVALID:COMPLETED_WITHOUT_EVIDENCE/u);
  assert.throws(()=>T.summary(m.ctx),/LEDGER_INVALID/u);
  // CI observation that does not reference the latest merge observation
  m=forge(x=>x.lifecycle.append({kind:'ci.observed',taskId:'T-A',outcome:'post-merge-verified',now:at(60),body:{schema:'sinbad-ci-observation/0-v1',taskId:'T-A',prNumber:311,mergeSha:MERGE,mergeEventHash:'0'.repeat(64),outcome:'POST_MERGE_VERIFIED'}}));
  assert.throws(()=>T.view(m.ctx),/LEDGER_INVALID:CI_OBSERVATION_BODY/u);
  // events after the terminal state
  m=mk();ready(m);m.ctx.now=at(51);T.verifyMerge(m.ctx,'T-A');m.ctx.now=at(52);T.verifyCi(m.ctx,'T-A');
  m.lifecycle.append({kind:'merge.observed',taskId:'T-A',outcome:'pr-open',now:at(70),body:{schema:'sinbad-merge-observation/0-v1',taskId:'T-A',prNumber:311,outcome:'PR_OPEN'}});
  assert.throws(()=>T.view(m.ctx),/LEDGER_INVALID:EVENT_AFTER_TERMINAL/u);
  // lifecycle events for a task that was never ingested
  m=mk();const c={ledger:m.v0ledger,observer:v0Observer(),now:at(0)};v0.open(c,order());
  m.lifecycle.append({kind:'pr.linked',taskId:'T-A',outcome:'linked',now:at(5),body:{schema:'sinbad-pr-link/0-v1',link:{}}});
  assert.throws(()=>T.view(m.ctx),/LEDGER_INVALID:LIFECYCLE_FOR_NON_INGESTED_TASK/u);
  // unknown kind
  m=mk();ingested(m);m.lifecycle.append({kind:'task.deleted',taskId:'T-A',outcome:'x',now:at(5),body:{schema:'x'}});
  assert.throws(()=>T.view(m.ctx),/LEDGER_INVALID:UNKNOWN_KIND/u);
  // a completion must name the exact merge and CI observations it rests on
  const crafted=bad=>{
    const x=mk();ready(x);x.ctx.now=at(51);T.verifyMerge(x.ctx,'T-A');
    const t=ev(x).lifecycle.tasks[0],mergeRef=t.merges[t.merges.length-1].ref;
    const ciBody=L.decideCi({link:t.link,mergeSha:MERGE,mergeEventHash:mergeRef.eventHash,github:{available:true,complete:true,runs:x.state.runs},claimedRuns:[],workflows:{available:true,list:x.state.workflows},git:{available:true,isAncestorOfMain:true},now:at(52)});
    const ci=x.lifecycle.append({kind:'ci.observed',taskId:'T-A',outcome:'post-merge-verified',now:at(52),body:ciBody});
    x.lifecycle.append({kind:'task.completed',taskId:'T-A',outcome:'completed',now:at(53),body:{schema:'sinbad-task-completion/0-v1',taskId:'T-A',prNumber:311,mergeSha:MERGE,mergeEventHash:mergeRef.eventHash,ciEventHash:ci.eventHash,completedAt:at(53),retroactive:{},...bad}});
    return x;
  };
  assert.equal(stateOf(crafted({})),'COMPLETED');
  for(const bad of [{ciEventHash:'f'.repeat(64)},{mergeEventHash:'f'.repeat(64)},{mergeSha:OTHER},{taskId:'T-Z'}])assert.throws(()=>T.view(crafted(bad).ctx),/LEDGER_INVALID:(COMPLETED_WITHOUT_EVIDENCE|LIFECYCLE_FOR_NON_INGESTED_TASK)/u,JSON.stringify(bad));
  // the same PR linked to two tasks, forged directly
  m=mk();ingested(m);ingested(m,'T-B',{branch:'codex/b',expectedFiles:['other/file.js']},{branch:'codex/b',changedFiles:['other/file.js']});
  assert.equal(link(m).ok,true);
  const v0view=m.v0ledger.view(),b=v0view.reduced.tasks.find(t=>t.taskId==='T-B');
  const ing=b.reports[b.reports.length-1];
  const forged=L.validateLink({taskId:'T-B',prNumber:311,repo:REPO,claims:[],linkedAt:at(9),v0Refs:{orderEventHash:b.openedRef.eventHash,ingestionEventHash:ing.ref.eventHash,resultingSha:RESULT,baseSha:H,branch:'codex/b',expectedFilesHash:base.expectedFilesHash(['other/file.js'])}});
  m.lifecycle.append({kind:'pr.linked',taskId:'T-B',outcome:'linked',now:at(9),body:{schema:'sinbad-pr-link/0-v1',link:forged.link}});
  assert.throws(()=>T.view(m.ctx),/LEDGER_INVALID:PR_LINKED_TWICE/u);
});

test('a tampered lifecycle shelf or body fails closed, and the accepted v0 ledger is unaffected',()=>{
  const m=mk();ready(m);m.ctx.now=at(51);T.verifyMerge(m.ctx,'T-A');m.ctx.now=at(52);T.verifyCi(m.ctx,'T-A');
  const v0Before=v0.summary({ledger:m.v0ledger}).text;
  assert.doesNotThrow(()=>T.view(m.ctx));
  const files=fs.readdirSync(lifeDir(m)).sort();
  const victim=path.join(lifeDir(m),files[1]);const original=fs.readFileSync(victim,'utf8');
  const rec=JSON.parse(original);rec.outcome='forged';fs.writeFileSync(victim,`${JSON.stringify(rec)}\n`);
  assert.throws(()=>T.view(m.ctx),/LEDGER_INVALID/u);
  assert.throws(()=>T.summary(m.ctx),/LEDGER_INVALID/u);
  assert.throws(()=>T.linkPr(m.ctx,{taskId:'T-A',prNumber:311}),/LEDGER_INVALID/u);
  // the v0 gate does not read the lifecycle shelf and keeps working
  assert.equal(v0.summary({ledger:m.v0ledger}).text,v0Before);
  fs.writeFileSync(victim,original);assert.doesNotThrow(()=>T.view(m.ctx));
  // missing and tampered bodies
  const bodyFile=path.join(bodiesDir(m),`${rec.evidenceHash}.json`);const body=fs.readFileSync(bodyFile,'utf8');
  fs.writeFileSync(bodyFile,body.replace('"','"x'));assert.throws(()=>T.view(m.ctx),/LEDGER_INVALID:(BODY_TAMPERED|BODY_UNREADABLE)/u);
  fs.writeFileSync(bodyFile,body);fs.unlinkSync(bodyFile);assert.throws(()=>T.view(m.ctx),/LEDGER_INVALID:BODY_MISSING/u);
  fs.writeFileSync(bodyFile,body);assert.doesNotThrow(()=>T.view(m.ctx));
  // deleting an event in the middle breaks the chain
  fs.unlinkSync(path.join(lifeDir(m),files[0]));assert.throws(()=>T.view(m.ctx),/LEDGER_INVALID/u);
  // exclusive creation and duplicate appends
  const args={kind:'merge.observed',taskId:'T-A',outcome:'pr-open',now:at(80),body:{schema:'x',n:1}};
  const n=mk();ingested(n);n.lifecycle.append(args);assert.throws(()=>n.lifecycle.append(args),/ARGOS_SHELF_DUPLICATE_EVENT/u);
  assert.throws(()=>n.lifecycle.append({...args,now:at(81),body:{schema:'x',note:'password: abcdefghijkl1234'}}),/SECRET_IN_BODY/u);
});

function pointerOf(body,ptr){return ptr.split('/').slice(1).reduce((v,k)=>v[k],body);}
test('the summary is deterministic, evidence-linked, separates claims from observations and shows NOT RECORDED',()=>{
  const m=mk();ingested(m);
  // before any lifecycle evidence
  let s=T.summary(m.ctx);
  for(const x of ['### LIFECYCLE STATE','### IMPLEMENTATION INGESTED','### PR','### MERGED','### POST-MERGE CI VERIFIED','### COMPLETED','### RETROACTIVE LABEL','### UNVERIFIED CLAIMS'])assert.ok(s.text.includes(x),x);
  assert.match(s.text,/\[T-A\] lifecycle: INGESTED/u);assert.match(s.text,/\[T-A\] PR: NOT RECORDED/u);assert.match(s.text,/\[T-A\] merge: NOT RECORDED/u);assert.match(s.text,/\[T-A\] post-merge CI: NOT RECORDED/u);assert.match(s.text,/\[T-A\] completed: NOT RECORDED \(lifecycle INGESTED\)/u);
  assert.match(s.text,/state CLOSED means "agent report accepted"/u);assert.match(s.text,/KNOWN LIMITATION \(Owner decision D1\)/u);
  // full lifecycle
  link(m,{claimedMergeSha:MERGE,claimedRuns:[1000],claimedBy:'claude'});m.ctx.now=at(51);T.verifyMerge(m.ctx,'T-A');m.ctx.now=at(52);T.verifyCi(m.ctx,'T-A');
  s=T.summary(m.ctx);
  assert.equal(T.summary(m.ctx).text,s.text);assert.equal(T.summary({...m.ctx,...m.reopen()}).text,s.text);
  assert.match(s.text,/\[T-A\] lifecycle: COMPLETED/u);
  assert.match(s.text,/CI run: workflow Release quality; run 1000; event push; head b{40}; status completed; conclusion success/u);
  assert.match(s.text,/claimed ci\.run \[UNVERIFIED\]: 1000 \(source claude\)/u);assert.match(s.text,/claimed merge\.sha \[UNVERIFIED\]: b{40}/u);
  // the v0 summary is printed unchanged, first
  assert.ok(s.text.startsWith(v0.summary({ledger:m.v0ledger}).text));
  // every fact resolves to a stored event in either shelf, with the body hash the event carries
  const hashes=new Map();
  for(const e of m.v0ledger.view().entries)hashes.set(e.eventHash,e.bodyHash);
  for(const e of m.lifecycle.verify().entries)hashes.set(e.eventHash,e.bodyHash);
  assert.ok(s.lifecycleFacts.length>15);
  for(const f of s.lifecycleFacts){assert.equal(hashes.get(f.eventHash),f.bodyHash,f.label);assert.equal(f.derived,true);}
  const bullets=s.text.slice(s.text.indexOf('# TASK LIFECYCLE')).split('\n').filter(l=>l.startsWith('- ['));
  assert.equal(bullets.length,s.lifecycleFacts.length);for(const b of bullets)assert.match(b,/\{ev [0-9a-f]{12}\}$/u);
  // a task with no lifecycle evidence and a bootstrap task show their own honest lines
  const o=mk();const c={ledger:o.v0ledger,observer:v0Observer(),now:at(0)};
  v0.open(c,order({taskId:'BOOT',origin:'RETROACTIVE_BOOTSTRAP',originNote:'Claude implemented the mechanism before it existed; recorded afterwards.'}));
  c.now=at(3);v0.ingest(c,JSON.stringify(report({taskId:'BOOT'})));
  assert.match(T.summary(o.ctx).text,/\[BOOT\] origin: RETROACTIVE_BOOTSTRAP; no lifecycle evidence is recorded for it \(Owner decision D4\)/u);
  assert.equal(pointerOf({a:{b:[1]}},'/a/b/0'),1);
});

test('the accepted Participation Gate v0 is unchanged and keeps working beside a lifecycle shelf',()=>{
  const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8').replace(/\r\n/gu,'\n');
  const pin=f=>crypto.createHash('sha256').update(read(f)).digest('hex');
  // pinned: change only with an Owner-accepted version bump of the Participation Gate
  const PINNED={
    'sinbad-ai-core/participation/participation-v0.js':'daa7c2c27330fe2a82a5a9d2fd235c71448e5eeff08dff5ea917e8d1349ebb08',
    'sinbad-ai-core/participation/index.js':'440aa991df7649c7fc0403c6188995f905d7284a35ba264114b203d6e40fc574',
    'tools/sinbad-participation.js':'59fe432b301bbb23029f514347b0be3875310a4c3904226568d6ce29e47e1c33',
    'tests/sinbad-participation-v0.test.js':'d916f4451d2e9ed50add776a5e93e8068b90d7549334b50d1ee14bbd1e2d9c91',
    'docs/participation/PARTICIPATION_GATE_V0_STATE.json':'9a3f2ba31fb61adcd2ea97179202a8d814707245bb77671cfeb62eceef1de651',
    'docs/participation/PARTICIPATION_GATE_V0.md':'20cb0c82b454c38de9e17659353d7bc098fb8019fcb71e3784bbbcf3e0296920'
  };
  for(const [file,hash] of Object.entries(PINNED))assert.equal(pin(file),hash,`${file} changed`);
  // the v0 gate still opens, preflights, delegates and ingests in a root that also holds lifecycle events
  const m=mk();ready(m);m.ctx.now=at(51);T.verifyMerge(m.ctx,'T-A');
  const c={ledger:m.v0ledger,observer:v0Observer(),now:at(60)};
  assert.equal(v0.open(c,order({taskId:'T-C',branch:'codex/c',expectedFiles:['c/file.js']})).ok,true);
  assert.equal(m.v0ledger.verify().head.eventCount,5);
});

test('the GitHub observer is read-only: GET, three allowlisted endpoints, no mutation, no credential handling',()=>{
  const seen=[];
  const fake=(answers)=>args=>{seen.push(args);const a=answers(args[3]);return a||{status:1,stdout:'',stderr:'HTTP 404',error:null};};
  const pull={number:311,state:'closed',merged:true,merged_at:'2026-10-01T10:00:00Z',merge_commit_sha:MERGE,head:{sha:RESULT},base:{ref:'main'},extra:'ignored'};
  const gh=G.githubObserver({repo:REPO,run:fake(ep=>/\/pulls\/311$/u.test(ep)?{status:0,stdout:JSON.stringify(pull),stderr:'',error:null}:null)});
  assert.deepEqual(gh.getPull(311).pull,{number:311,state:'closed',merged:true,mergedAt:'2026-10-01T10:00:00Z',mergeCommitSha:MERGE,headSha:RESULT,baseRef:'main'});
  assert.deepEqual(seen[0],['api','--method','GET',`repos/${REPO}/pulls/311`]);
  assert.equal(gh.getPull(404).notFound,true);
  // allowlist
  for(const bad of ['repos/a/b/pulls/311/merge','repos/a/b/issues/1/comments','repos/a/b/actions/runs/1/rerun','repos/a/b/actions/workflows/x.yml/dispatches','repos/a/b/git/refs','user','repos/a/b/pulls','repos/a/b/pulls/x','repos/a/b/actions/runs?head_sha=zz&per_page=100&page=1','../x','repos/a/b/pulls/1?x=1','repos/a b/c/pulls/1',''])assert.throws(()=>G.buildArgs(bad),/GITHUB_ENDPOINT_NOT_ALLOWED/u,bad);
  assert.deepEqual(G.buildArgs(`repos/${REPO}/actions/runs/123`),['api','--method','GET',`repos/${REPO}/actions/runs/123`]);
  assert.throws(()=>G.githubObserver({repo:'bad repo'}),/GITHUB_REPO_INVALID/u);assert.throws(()=>gh.getPull(0),/PR_NUMBER_INVALID/u);assert.throws(()=>gh.listRuns('x'),/SHA_INVALID/u);
  // every call that was made is GET against an allowlisted endpoint
  for(const a of seen){assert.equal(a.length,4);assert.deepEqual(a.slice(0,3),['api','--method','GET']);assert.ok(G.ALLOWED_ENDPOINTS.some(re=>re.test(a[3])));}
  // unavailable, non-JSON and malformed answers are "unavailable", never a guess
  assert.equal(G.githubObserver({repo:REPO,run:()=>({status:null,stdout:'',stderr:'',error:'ENOENT'})}).getPull(1).available,false);
  assert.equal(G.githubObserver({repo:REPO,run:()=>({status:1,stdout:'',stderr:'HTTP 500',error:null})}).getPull(1).available,false);
  assert.equal(G.githubObserver({repo:REPO,run:()=>({status:0,stdout:'not json',stderr:'',error:null})}).getPull(1).available,false);
  assert.equal(G.githubObserver({repo:REPO,run:()=>({status:0,stdout:'{"number":1}',stderr:'',error:null})}).getPull(1).available,false);
  // runs: pagination and completeness
  const mkRun=i=>({id:i,name:'Release quality',event:'push',head_sha:MERGE,status:'completed',conclusion:'success',run_attempt:1,created_at:'2026-10-01T10:00:00Z'});
  const two=G.githubObserver({repo:REPO,run:args=>{const page=Number(/page=(\d+)$/u.exec(args[3])[1]);const all=Array.from({length:130},(_,i)=>mkRun(i+1));return {status:0,stdout:JSON.stringify({total_count:130,workflow_runs:all.slice((page-1)*100,page*100)}),stderr:'',error:null};}});
  const l=two.listRuns(MERGE);assert.equal(l.complete,true);assert.equal(l.runs.length,130);
  const endless=G.githubObserver({repo:REPO,run:()=>({status:0,stdout:JSON.stringify({total_count:5000,workflow_runs:Array.from({length:100},(_,i)=>mkRun(i+1))}),stderr:'',error:null})});
  assert.equal(endless.listRuns(MERGE).complete,false);
  assert.equal(G.githubObserver({repo:REPO,run:()=>({status:0,stdout:JSON.stringify({total_count:1,workflow_runs:[{id:1}]}),stderr:'',error:null})}).listRuns(MERGE).available,false);
  assert.equal(G.githubObserver({repo:REPO,run:()=>({status:1,stdout:'',stderr:'HTTP 404',error:null})}).getRun(5).found,false);
  assert.equal(G.githubObserver({repo:REPO,run:()=>({status:0,stdout:JSON.stringify(mkRun(5)),stderr:'',error:null})}).getRun(5).run.headSha,MERGE);
  // no token ever reaches the ledger: the observer never sees or returns environment values
  const prior=process.env.GH_TOKEN;process.env.GH_TOKEN='ghp_'+'t'.repeat(36);
  try{
    const m=mk();ready(m);m.ctx.now=at(51);T.verifyMerge(m.ctx,'T-A');m.ctx.now=at(52);T.verifyCi(m.ctx,'T-A');
    const stored=fs.readdirSync(bodiesDir(m)).map(f=>fs.readFileSync(path.join(bodiesDir(m),f),'utf8')).join('\n');
    assert.ok(!stored.includes(process.env.GH_TOKEN));
  }finally{if(prior===undefined)delete process.env.GH_TOKEN;else process.env.GH_TOKEN=prior;}
});

function git(cwd,args){const r=cp.spawnSync('git',['-c','user.name=t','-c','user.email=t@example.invalid','-c','commit.gpgsign=false',...args],{cwd,encoding:'utf8'});assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);return r.stdout.trim();}
test('the local git merge observer verifies containment, changed files, blobs, workflows and the capability anchor',()=>{
  const dir=tmp(),repo=path.join(dir,'r');fs.mkdirSync(repo);
  git(repo,['init','-q']);
  const write=(f,c)=>{fs.mkdirSync(path.dirname(path.join(repo,f)),{recursive:true});fs.writeFileSync(path.join(repo,f),c);};
  write('README.md','r');git(repo,['add','.']);git(repo,['commit','-q','-m','base']);const baseSha=git(repo,['rev-parse','HEAD']);
  git(repo,['remote','add','origin','https://github.com/sinbad-marine/atlas-marine-os.git']);
  // the delegated result on a branch
  git(repo,['checkout','-q','-b','work']);write('src/widget.js','w');write('tests/widget.test.js','t');git(repo,['add','.']);git(repo,['commit','-q','-m','result']);const result=git(repo,['rev-parse','HEAD']);
  // main moved on, then the squash merge reproduces the result on top of it
  git(repo,['checkout','-q','-B','main',baseSha]);write('other.txt','o');git(repo,['add','.']);git(repo,['commit','-q','-m','main moved']);
  write('src/widget.js','w');write('tests/widget.test.js','t');git(repo,['add','.']);git(repo,['commit','-q','-m','squash']);const mergeSha=git(repo,['rev-parse','HEAD']);
  write('later.txt','l');git(repo,['add','.']);git(repo,['commit','-q','-m','later']);
  git(repo,['update-ref','refs/remotes/origin/main','HEAD']);
  const obs=T.gitMergeObserver({repoRoot:repo});
  assert.equal(obs.repo(),'sinbad-marine/atlas-marine-os');
  let r=obs.observeMerge({mergeSha,resultingSha:result,changedFiles:FILES});
  assert.equal(r.available,true);assert.equal(r.mergeShaExists,true);assert.equal(r.isAncestorOfMain,true);assert.equal(r.aheadOfMerge,1);assert.equal(r.parents.length,1);
  assert.deepEqual([...r.changedFilesAtMerge].sort(),FILES);assert.deepEqual(r.blobMatches,{'src/widget.js':true,'tests/widget.test.js':true});
  assert.equal(r.capabilityCommit,null);assert.equal(r.mergeBeforeCapability,false);
  // content that differs from the ingested result
  write('src/widget.js','DIFFERENT');git(repo,['add','.']);git(repo,['commit','-q','-m','drift']);const drift=git(repo,['rev-parse','HEAD']);git(repo,['update-ref','refs/remotes/origin/main','HEAD']);
  r=obs.observeMerge({mergeSha:drift,resultingSha:result,changedFiles:FILES});assert.equal(r.blobMatches['src/widget.js'],false);
  // a commit that exists but is not in main
  git(repo,['checkout','-q','-b','side',baseSha]);write('side.txt','s');git(repo,['add','.']);git(repo,['commit','-q','-m','side']);const side=git(repo,['rev-parse','HEAD']);git(repo,['checkout','-q','main']);
  r=obs.observeMerge({mergeSha:side,resultingSha:result,changedFiles:FILES});assert.equal(r.mergeShaExists,true);assert.equal(r.isAncestorOfMain,false);
  // an absent commit
  assert.equal(obs.observeMerge({mergeSha:'9'.repeat(40),resultingSha:result,changedFiles:FILES}).mergeShaExists,false);
  // the capability anchor: the commit that adds the lifecycle module decides "retroactive" by ancestry
  write('sinbad-ai-core/participation/lifecycle-v0.js','x');git(repo,['add','.']);git(repo,['commit','-q','-m','capability']);const cap=git(repo,['rev-parse','HEAD']);
  write('after.txt','a');git(repo,['add','.']);git(repo,['commit','-q','-m','after']);const after=git(repo,['rev-parse','HEAD']);git(repo,['update-ref','refs/remotes/origin/main','HEAD']);
  r=obs.observeMerge({mergeSha,resultingSha:result,changedFiles:FILES});assert.equal(r.capabilityCommit,cap);assert.equal(r.mergeBeforeCapability,true);
  r=obs.observeMerge({mergeSha:after,resultingSha:result,changedFiles:FILES});assert.equal(r.mergeBeforeCapability,false);
  r=obs.observeMerge({mergeSha:cap,resultingSha:result,changedFiles:FILES});assert.equal(r.mergeBeforeCapability,false);
  // workflow definitions are read at the merge commit
  const wf=fs.readdirSync(path.join(ROOT,'.github','workflows'));
  for(const f of wf)write(`.github/workflows/${f}`,fs.readFileSync(path.join(ROOT,'.github','workflows',f),'utf8'));
  git(repo,['add','.']);git(repo,['commit','-q','-m','workflows']);const withWf=git(repo,['rev-parse','HEAD']);
  const w=obs.observeWorkflows(withWf);assert.equal(w.available,true);assert.equal(L.checkWorkflowSet(w.list).ok,true);
  assert.equal(obs.observeWorkflows(baseSha).list.length,0);assert.equal(L.checkWorkflowSet(obs.observeWorkflows(baseSha).list).ok,false);
  // unavailable observation
  assert.equal(T.gitMergeObserver({repoRoot:dir}).observeMerge({mergeSha,resultingSha:result,changedFiles:FILES}).available,false);
  assert.equal(T.gitMergeObserver({repoRoot:repo,baseRef:'origin/missing'}).observeMerge({mergeSha,resultingSha:result,changedFiles:FILES}).available,false);
  assert.equal(T.gitMergeObserver({repoRoot:dir}).observeWorkflows(mergeSha).available,false);
  // repository identity from the remote URL
  for(const [url,expected] of [['https://github.com/a/b.git','a/b'],['git@github.com:a/b.git','a/b'],['https://github.com/a/b','a/b'],['https://example.com/a/b.git',null]])
    assert.equal(T.repoOf(()=>({status:0,stdout:url,error:null})),expected,url);
  assert.equal(T.repoOf(()=>({status:1,stdout:'',error:null})),null);
});

test('the command line refuses bad input, never needs a write to GitHub and prints the combined summary',()=>{
  const dir=tmp(),root=path.join(dir,'ledger');
  const run=(...args)=>cp.spawnSync(process.execPath,[path.join(ROOT,'tools','sinbad-participation-lifecycle.js'),...args,'--root',root],{encoding:'utf8',cwd:ROOT});
  assert.equal(run('nonsense').status,1);assert.equal(run('link-pr').status,1);assert.equal(run('link-pr','--task','T-A').status,1);
  assert.equal(run('link-pr','--task','T-A','--pr','311').status,2);
  assert.equal(run('verify-merge','--task','T-A').status,2);assert.equal(run('verify-ci','--task','T-A').status,2);
  const s=run('summary');assert.equal(s.status,0);assert.match(s.stdout,/SINBAD Owner Work Summary/u);assert.match(s.stdout,/TASK LIFECYCLE \(post-merge lifecycle v0\)/u);assert.match(s.stdout,/KNOWN LIMITATION/u);
  const inside=run('summary','--out',path.join(ROOT,'lifecycle-summary-should-not-exist.md'));assert.equal(inside.status,1);assert.equal(fs.existsSync(path.join(ROOT,'lifecycle-summary-should-not-exist.md')),false);
});

test('the lifecycle is inert: pure module, read-only observers, no network client, no write to GitHub or the repository, v0 untouched',()=>{
  const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
  const requires=src=>[...src.matchAll(/require\(['"]([^'"]+)['"]\)/gu)].map(m=>m[1]).sort();
  const pure=read('sinbad-ai-core/participation/lifecycle-v0.js'),tool=read('tools/sinbad-participation-lifecycle.js'),gh=read('tools/sinbad-participation-github.js');
  assert.deepEqual(requires(pure),['./participation-v0']);
  assert.deepEqual(requires(tool),['../sinbad-ai-core/argos-event-shelf','../sinbad-ai-core/participation/lifecycle-v0','../sinbad-ai-core/participation/participation-v0','./sinbad-participation','./sinbad-participation-github','node:child_process','node:fs','node:path']);
  assert.deepEqual(requires(gh),['node:child_process']);
  for(const src of [pure,tool,gh]){
    assert.doesNotMatch(src,/node:(?:http|https|net|tls|dns|dgram)|\bfetch\(|XMLHttpRequest|WebSocket|Date\.now\(/u);
    assert.doesNotMatch(src,/['"`][^'"`\n]*(?:engine-room|PROJECT2_STATE|ENGINE_ROOM|app\.js|sw\.js|index\.html)[^'"`\n]*['"`]/u);
  }
  assert.doesNotMatch(pure,/new Date\(/u);
  // git is read-only: no subcommand that changes the repository, its refs or its remotes
  assert.doesNotMatch(tool,/run\(\['(?:push|pull|fetch|commit|checkout|reset|clean|rebase|add|merge|tag|stash|branch|config|remote'\s*,\s*'(?:add|set-url|remove)|gc|rm|mv|update-ref)'/u);
  // gh is called only through buildArgs: GET api calls; no other gh command, method flag or request body option
  assert.doesNotMatch(gh,/--method['"],\s*['"](?:POST|PUT|PATCH|DELETE)|'-X'|'-f'|'-F'|'--field'|'--raw-field'|'--input'|'pr'|'workflow'|'issue'|'run'\s*,\s*'(?:rerun|cancel)|'release'|'repo'/u);
  assert.equal([...gh.matchAll(/spawnSync\(/gu)].length,1);assert.match(gh,/spawnSync\('gh',args/u);
  assert.doesNotMatch(tool,/spawnSync\('gh'/u);
  assert.doesNotMatch(pure,/\b(?:academy|gasm|zabit|akademi)\b/iu);
});
