'use strict';
// SINBAD Post-Merge Lifecycle v0 - the pure part. No file system, no git, no network, no model, no clock (callers
// pass `now`). It validates PR links, decides what a merge observation and a post-merge CI observation prove,
// reduces the separate participation-lifecycle shelf into task lifecycle states and renders the lifecycle section of
// the Owner summary. Observation and persistence live in the tools; this module only sees plain data.
//
// The accepted Participation Gate v0 is used but not changed. A v0 task in state CLOSED means "report accepted"
// (IMPLEMENTATION INGESTED); this module adds what happens after: PR, merge, post-merge CI, COMPLETED.
//
// Authority rules: an agent's merge or CI statement is a claim and stays UNVERIFIED even when it equals what was
// observed; observed evidence is recorded separately. COMPLETED needs independent observation of everything; no
// observation, no completion. GitHub observation is evidence input, not authority: the merge must also be verified
// in local git.
const base=require('./participation-v0');

const VERSION='sinbad-participation-lifecycle/0-v1';
const SHELF_ID='participation-lifecycle';
const ACTOR='sinbad-participation-lifecycle';
// Approved by the Owner (D2). The drift check below compares this set with the workflow files at the merge commit.
const REQUIRED_WORKFLOWS=Object.freeze(['Controlled Pages release','Release quality']);
const KINDS=Object.freeze(['pr.linked','merge.observed','ci.observed','task.completed']);
const MERGE_OUTCOMES=Object.freeze(['PR_OPEN','MERGED_VERIFIED','PR_CLOSED_UNMERGED','MERGE_CONTRADICTED','OBSERVATION_UNAVAILABLE']);
const CI_OUTCOMES=Object.freeze(['POST_MERGE_VERIFIED','POST_MERGE_PENDING','POST_MERGE_FAILED','CONTRADICTED','WORKFLOW_SET_DRIFT','OBSERVATION_UNAVAILABLE']);
const LABELS=base.LABELS;
const SHA=/^[0-9a-f]{40}$/u;
const HASH=/^[0-9a-f]{64}$/u;
const NAME=/^[A-Za-z0-9._-]{1,40}$/u;
const REPO=/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u;
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const NOT_RECORDED=base.NOT_RECORDED;
const LINK_KEYS=Object.freeze(['taskId','prNumber','repo','claims','linkedAt','v0Refs']);
const V0REF_KEYS=Object.freeze(['orderEventHash','ingestionEventHash','resultingSha','baseSha','branch','expectedFilesHash']);
const CLAIM_KEYS=Object.freeze(['kind','value','source','label']);
const isPlain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
function exact(v,names){
  if(!isPlain(v)||Object.getOwnPropertySymbols(v).length)return null;
  const keys=Object.getOwnPropertyNames(v);
  if(keys.length!==names.length||names.some(k=>!keys.includes(k)))return null;
  for(const k of keys){const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!Object.hasOwn(d,'value'))return null;}
  return v;
}
const sorted=a=>[...a].sort();
const sameSet=(a,b)=>a.length===b.length&&sorted(a).every((x,i)=>x===sorted(b)[i]);

// ---------- PR link ----------
function validateLink(input){
  const errors=[];
  const v=exact(input,LINK_KEYS);
  if(!v)return {ok:false,errors:['LINK_KEYS_NOT_EXACT'],link:null};
  if(typeof v.taskId!=='string'||!NAME.test(v.taskId))errors.push('TASK_ID_INVALID');
  if(!Number.isSafeInteger(v.prNumber)||v.prNumber<1||v.prNumber>10_000_000)errors.push('PR_NUMBER_INVALID');
  if(typeof v.repo!=='string'||!REPO.test(v.repo))errors.push('REPO_INVALID');
  if(typeof v.linkedAt!=='string'||!ISO.test(v.linkedAt))errors.push('LINKED_AT_INVALID');
  const refs=exact(v.v0Refs,V0REF_KEYS);
  if(!refs||!HASH.test(refs.orderEventHash)||!HASH.test(refs.ingestionEventHash)||!SHA.test(refs.resultingSha)||!SHA.test(refs.baseSha)||typeof refs.branch!=='string'||!HASH.test(refs.expectedFilesHash))errors.push('V0_REFS_INVALID');
  if(!Array.isArray(v.claims)||v.claims.length>50)errors.push('CLAIMS_INVALID');
  else for(const c of v.claims){
    const cc=exact(c,CLAIM_KEYS);
    const okValue=cc&&(cc.kind==='merge.sha'?typeof cc.value==='string'&&SHA.test(cc.value):cc.kind==='ci.run'?typeof cc.value==='string'&&/^\d{1,15}$/u.test(cc.value):false);
    if(!cc||!okValue||typeof cc.source!=='string'||cc.source.length<1||cc.source.length>40||cc.label!==LABELS.UNVERIFIED){errors.push('CLAIM_INVALID');break;}
  }
  const secret=base.secretFinding(v);if(secret)errors.push(`SECRET_PATTERN:${secret}`);
  if(errors.length)return {ok:false,errors,link:null};
  return {ok:true,errors:[],link:Object.freeze({...v})};
}

// ---------- retroactive status (derived from git ancestry, never from a flag) ----------
function retroactiveOf(git){
  if(!git||typeof git.capabilityCommit!=='string'||!SHA.test(git.capabilityCommit))return {state:'UNKNOWN',capabilityCommit:null,statement:'the commit that introduced the lifecycle capability was not found in main history'};
  if(git.mergeBeforeCapability===true)return {state:'RETROACTIVE',capabilityCommit:git.capabilityCommit,statement:'the lifecycle capability did not exist when this task was merged; this evidence was recorded afterwards'};
  return {state:'FORWARD',capabilityCommit:git.capabilityCommit,statement:'merged after the lifecycle capability existed'};
}

// ---------- merge decision ----------
// facts: {resultingSha, changedFiles, baseSha} from the v0 ingestion the PR must match.
// github: {available, notFound, pull:{number,state,merged,mergedAt,mergeCommitSha,headSha,baseRef}, error}
// git: {available, originMainSha, mergeShaExists, isAncestorOfMain, aheadOfMerge, parents, changedFilesAtMerge, blobMatches, capabilityCommit, mergeBeforeCapability, error}
function decideMerge({link,facts,github,git,now}){
  const checks=[];
  const add=(id,pass,detail,basis)=>{checks.push(Object.freeze({id,pass,label:pass?LABELS.VERIFIED:LABELS.CONTRADICTED,detail,basis}));return pass;};
  const out=(outcome,extra)=>Object.freeze({schema:'sinbad-merge-observation/0-v1',taskId:link.taskId,prNumber:link.prNumber,repo:link.repo,observedAt:now,outcome,mergeSha:null,
    github:null,git:null,checks:Object.freeze(checks),claims:Object.freeze([]),retroactive:retroactiveOf(null),unavailableReason:null,...extra});
  if(!github||github.available!==true)return out('OBSERVATION_UNAVAILABLE',{unavailableReason:`github: ${String((github&&github.error)||'no observation')}`});
  if(github.notFound===true){add('PR_EXISTS',false,`PR #${link.prNumber} not found`,'GitHub API read-only');return out('MERGE_CONTRADICTED',{github:{notFound:true}});}
  const p=github.pull;
  const gh=Object.freeze({number:p.number,state:p.state,merged:p.merged,mergedAt:p.mergedAt,mergeCommitSha:p.mergeCommitSha,headSha:p.headSha,baseRef:p.baseRef});
  add('PR_NUMBER_MATCHES',p.number===link.prNumber,`observed #${p.number}`,'GitHub API read-only');
  add('PR_HEAD_MATCHES_INGESTED_RESULT',p.headSha===facts.resultingSha,p.headSha===facts.resultingSha?'PR head equals the ingested result':`PR head ${String(p.headSha).slice(0,12)} differs from the ingested result ${facts.resultingSha.slice(0,12)} (PR_HEAD_DIFFERS)`,'GitHub API read-only');
  add('PR_BASE_IS_MAIN',p.baseRef==='main',`base ${p.baseRef}`,'GitHub API read-only');
  const claims=[];
  const finish=(outcome,gitSubset)=>{
    // claims are compared with the observation; a match never elevates the claim
    for(const c of link.claims.filter(x=>x.kind==='merge.sha')){
      const same=p.merged===true&&c.value===p.mergeCommitSha;
      claims.push(Object.freeze({kind:c.kind,value:c.value,source:c.source,label:same?LABELS.UNVERIFIED:(p.merged===true?LABELS.CONTRADICTED:LABELS.UNVERIFIED),basis:same?'claimed by '+c.source+'; equals the observed merge SHA, the claim itself is not elevated':(p.merged===true?'claimed by '+c.source+'; differs from the observed merge SHA':'claimed by '+c.source+'; no merge observed')}));
    }
    const contradicted=claims.some(c=>c.label===LABELS.CONTRADICTED);
    let final=outcome;
    if(contradicted&&outcome==='MERGED_VERIFIED')final='MERGE_CONTRADICTED';
    return out(final,{github:gh,git:gitSubset||null,claims:Object.freeze(claims),mergeSha:p.merged===true&&SHA.test(String(p.mergeCommitSha))?p.mergeCommitSha:null,retroactive:retroactiveOf(gitSubset)});
  };
  if(checks.some(c=>!c.pass))return finish('MERGE_CONTRADICTED',null);
  if(p.merged!==true){
    if(p.state==='open')return finish('PR_OPEN',null);
    if(p.state==='closed')return finish('PR_CLOSED_UNMERGED',null);
    add('PR_STATE_KNOWN',false,`state ${p.state}`,'GitHub API read-only');return finish('MERGE_CONTRADICTED',null);
  }
  if(!add('MERGE_SHA_PRESENT',typeof p.mergeCommitSha==='string'&&SHA.test(p.mergeCommitSha),'GitHub reports a merge commit','GitHub API read-only'))return finish('MERGE_CONTRADICTED',null);
  if(!git||git.available!==true)return out('OBSERVATION_UNAVAILABLE',{github:gh,unavailableReason:`git: ${String((git&&git.error)||'no observation')}`,mergeSha:p.mergeCommitSha});
  const gs=Object.freeze({originMainSha:git.originMainSha,mergeShaExists:git.mergeShaExists===true,isAncestorOfMain:git.isAncestorOfMain===true,aheadOfMerge:git.aheadOfMerge,parents:Object.freeze([...(git.parents||[])]),
    changedFilesAtMerge:Object.freeze(sorted(git.changedFilesAtMerge||[])),blobMatches:Object.freeze({...(git.blobMatches||{})}),capabilityCommit:git.capabilityCommit||null,mergeBeforeCapability:git.mergeBeforeCapability===true});
  add('MERGE_SHA_EXISTS_LOCALLY',gs.mergeShaExists,'git cat-file','local git');
  add('MERGE_CONTAINED_IN_MAIN',gs.isAncestorOfMain,`merge-base --is-ancestor against ${String(gs.originMainSha).slice(0,12)}; main is ${gs.aheadOfMerge} commit(s) ahead`,'local git');
  const expectedFiles=sorted(facts.changedFiles);
  add('CHANGED_FILES_MATCH_INGESTED',sameSet(gs.changedFilesAtMerge,expectedFiles),`merge changed ${gs.changedFilesAtMerge.length} file(s), ingested ${expectedFiles.length}`,'local git');
  const union=[...new Set([...gs.changedFilesAtMerge,...expectedFiles])];
  add('BLOBS_MATCH_INGESTED_RESULT',union.length>0&&union.every(f=>gs.blobMatches[f]===true),'file contents at the merge commit equal the ingested result','local git');
  return finish(checks.every(c=>c.pass)?'MERGED_VERIFIED':'MERGE_CONTRADICTED',gs);
}

// ---------- workflow set (drift) ----------
function stripComment(line){return line.replace(/\s+#.*$/u,'').replace(/^\s*#.*$/u,'');}
const indentOf=l=>l.length-l.trimStart().length;
function workflowName(text){
  const m=/^name:\s*(.+?)\s*$/mu.exec(String(text).replace(/\r\n/gu,'\n'));
  return m?m[1].replace(/^['"]|['"]$/gu,''):null;
}
// true: a push to main triggers it; false: it does not; null: cannot be decided from the text (fail closed upstream)
function workflowTriggersMainPush(text){
  const lines=String(text).replace(/\r\n/gu,'\n').split('\n').map(stripComment);
  const at=lines.findIndex(l=>/^on:/u.test(l));
  if(at<0)return null;
  const inline=lines[at].slice(3).trim();
  if(inline){
    if(inline==='push')return true;
    const list=/^\[(.*)\]$/u.exec(inline);
    if(list)return list[1].split(',').map(s=>s.trim().replace(/^['"]|['"]$/gu,'')).includes('push');
    return null;
  }
  const block=[];
  for(let i=at+1;i<lines.length;i+=1){if(lines[i].trim()==='')continue;if(indentOf(lines[i])===0)break;block.push(lines[i]);}
  if(!block.length)return null;
  const pushAt=block.findIndex(l=>/^\s+push:\s*(?:\{.*)?$/u.test(l)||/^\s+push:\s*$/u.test(l));
  if(pushAt<0)return false;
  const pushLine=block[pushAt],pushIndent=indentOf(pushLine);
  if(/\{/u.test(pushLine))return null;
  const children=[];
  for(let i=pushAt+1;i<block.length&&indentOf(block[i])>pushIndent;i+=1)children.push(block[i]);
  if(!children.length)return true;
  const keyAt=key=>children.findIndex(l=>new RegExp(`^\\s+${key}:`,'u').test(l));
  const listOf=key=>{
    const i=keyAt(key);if(i<0)return null;
    const rest=children[i].split(':').slice(1).join(':').trim();
    if(rest){const m=/^\[(.*)\]$/u.exec(rest);return m?m[1].split(',').map(s=>s.trim().replace(/^['"]|['"]$/gu,'')).filter(Boolean):undefined;}
    const items=[];const ind=indentOf(children[i]);
    for(let j=i+1;j<children.length&&indentOf(children[j])>ind;j+=1){const m=/^\s*-\s*(.+?)\s*$/u.exec(children[j]);if(!m)return undefined;items.push(m[1].replace(/^['"]|['"]$/gu,''));}
    return items;
  };
  if(keyAt('paths')>=0||keyAt('paths-ignore')>=0)return null;
  const branches=listOf('branches'),ignore=listOf('branches-ignore');
  if(branches===undefined||ignore===undefined)return null;
  if(branches!==null){
    if(branches.includes('main')||branches.includes('**'))return true;
    return branches.some(b=>/[*?[\]!]/u.test(b))?null:false;
  }
  if(ignore!==null)return ignore.includes('main')?false:(ignore.some(b=>/[*?[\]!]/u.test(b))?null:true);
  if(keyAt('tags')>=0&&keyAt('tags-ignore')<0)return false;
  return true;
}
// list: [{path,name,pushMain}] read from the repository at the merge commit
function checkWorkflowSet(list){
  if(!Array.isArray(list))return {ok:false,reason:'WORKFLOW_LIST_UNAVAILABLE',computed:[]};
  if(list.some(w=>w.pushMain===null||typeof w.name!=='string'))return {ok:false,reason:'WORKFLOW_TRIGGER_UNDECIDABLE',computed:[]};
  const computed=sorted(list.filter(w=>w.pushMain===true).map(w=>w.name));
  return sameSet(computed,REQUIRED_WORKFLOWS)?{ok:true,reason:null,computed}:{ok:false,reason:'WORKFLOW_SET_DRIFT',computed};
}

// ---------- post-merge CI decision ----------
// github: {available, complete, runs:[{id,name,event,headSha,status,conclusion,runAttempt,createdAt}], error}
// claimedRuns: [{id, available, found, run:{...}|null}]  workflows: {available, list, error}  git: {available, isAncestorOfMain, error}
function decideCi({link,mergeSha,mergeEventHash,github,claimedRuns,workflows,git,now}){
  const out=(outcome,extra)=>Object.freeze({schema:'sinbad-ci-observation/0-v1',taskId:link.taskId,prNumber:link.prNumber,mergeSha,mergeEventHash,observedAt:now,outcome,required:Object.freeze([...REQUIRED_WORKFLOWS]),
    perWorkflow:Object.freeze([]),runs:Object.freeze([]),nonRequired:Object.freeze([]),claims:Object.freeze([]),reasons:Object.freeze([]),unavailableReason:null,...extra});
  if(!github||github.available!==true)return out('OBSERVATION_UNAVAILABLE',{unavailableReason:`github: ${String((github&&github.error)||'no observation')}`});
  if(github.complete!==true)return out('OBSERVATION_UNAVAILABLE',{unavailableReason:'github: the run list is incomplete'});
  if(!workflows||workflows.available!==true)return out('OBSERVATION_UNAVAILABLE',{unavailableReason:`workflow definitions: ${String((workflows&&workflows.error)||'no observation')}`});
  if(!git||git.available!==true)return out('OBSERVATION_UNAVAILABLE',{unavailableReason:`git: ${String((git&&git.error)||'no observation')}`});
  const reasons=[];
  const wf=checkWorkflowSet(workflows.list);
  const all=(github.runs||[]).map(r=>Object.freeze({workflow:r.name,runId:r.id,event:r.event,headSha:r.headSha,status:r.status,conclusion:r.conclusion,runAttempt:r.runAttempt,createdAt:r.createdAt}));
  const claims=[];
  let contradicted=false;
  if(git.isAncestorOfMain!==true){reasons.push('MERGE_NOT_CONTAINED_IN_MAIN');contradicted=true;}
  const foreign=all.filter(r=>r.headSha!==mergeSha);
  if(foreign.length){reasons.push(`GITHUB_RETURNED_RUNS_OF_OTHER_SHA:${foreign.map(r=>r.runId).join(',')}`);contradicted=true;}
  for(const c of link.claims.filter(x=>x.kind==='ci.run')){
    const found=(claimedRuns||[]).find(x=>String(x.id)===c.value);
    if(!found||found.available!==true){return out('OBSERVATION_UNAVAILABLE',{unavailableReason:`claimed run ${c.value} could not be looked up`,perWorkflow:Object.freeze([]),runs:Object.freeze(all)});}
    if(found.found!==true){claims.push(Object.freeze({kind:c.kind,value:c.value,source:c.source,label:LABELS.CONTRADICTED,basis:`claimed by ${c.source}; run not found`}));reasons.push(`CLAIMED_RUN_NOT_FOUND:${c.value}`);contradicted=true;continue;}
    if(found.run.headSha!==mergeSha){claims.push(Object.freeze({kind:c.kind,value:c.value,source:c.source,label:LABELS.CONTRADICTED,basis:`claimed by ${c.source}; the run belongs to ${String(found.run.headSha).slice(0,12)}, not to the merge commit`}));reasons.push(`CI_RUN_BELONGS_TO_OTHER_SHA:${c.value}`);contradicted=true;continue;}
    claims.push(Object.freeze({kind:c.kind,value:c.value,source:c.source,label:LABELS.UNVERIFIED,basis:`claimed by ${c.source}; the run belongs to the merge commit, the claim itself is not elevated`}));
  }
  const candidates=all.filter(r=>r.headSha===mergeSha&&r.event==='push');
  const perWorkflow=REQUIRED_WORKFLOWS.map(name=>{
    const runs=candidates.filter(r=>r.workflow===name);
    let verdict;
    if(!runs.length)verdict='MISSING';
    else if(runs.some(r=>r.status!=='completed'))verdict='INCOMPLETE';
    else if(runs.some(r=>r.conclusion!=='success'))verdict='FAILED';
    else verdict='VERIFIED';
    return Object.freeze({workflow:name,verdict,runIds:Object.freeze(runs.map(r=>r.runId)),runs:runs.length});
  });
  const nonRequired=all.filter(r=>!(r.headSha===mergeSha&&r.event==='push'&&REQUIRED_WORKFLOWS.includes(r.workflow)));
  let outcome;
  if(!wf.ok){reasons.push(wf.reason);outcome='WORKFLOW_SET_DRIFT';}
  else if(contradicted)outcome='CONTRADICTED';
  else if(perWorkflow.some(w=>w.verdict==='FAILED'))outcome='POST_MERGE_FAILED';
  else if(perWorkflow.some(w=>w.verdict==='MISSING'||w.verdict==='INCOMPLETE'))outcome='POST_MERGE_PENDING';
  else outcome='POST_MERGE_VERIFIED';
  return out(outcome,{perWorkflow:Object.freeze(perWorkflow),runs:Object.freeze(all),nonRequired:Object.freeze(nonRequired),claims:Object.freeze(claims),reasons:Object.freeze(reasons)});
}

// ---------- reduction of the lifecycle shelf ----------
const TERMINAL=new Set(['COMPLETED','PR_CLOSED_UNMERGED']);
const POST_MERGE=new Set(['MERGED','POST_MERGE_PENDING','POST_MERGE_FAILED','POST_MERGE_BLOCKED','POST_MERGE_VERIFIED']);
const invalid=code=>{throw new Error(`LEDGER_INVALID:${code}`);};
// v0Tasks: the reduced v0 tasks ({taskId,state,...}); entries: lifecycle shelf entries in chain order
function reduceLifecycle({v0Tasks,entries}){
  const v0=new Map(v0Tasks.map(t=>[t.taskId,t]));
  const lc=new Map();
  const ref=e=>Object.freeze({sequence:e.sequence,eventHash:e.eventHash,bodyHash:e.bodyHash,observedAt:e.event.observedAt});
  for(const e of entries){
    const {kind,targetRef}=e.event,body=e.body;
    if(!KINDS.includes(kind))invalid(`UNKNOWN_KIND:${kind}`);
    const id=targetRef.startsWith('task/')?targetRef.slice(5):null;
    const task=id?v0.get(id):null;
    if(!task||task.state!=='CLOSED')invalid(`LIFECYCLE_FOR_NON_INGESTED_TASK:${id}`);
    let t=lc.get(id);
    if(!t){t={taskId:id,state:'INGESTED',link:null,linkRef:null,links:[],merges:[],cis:[],completed:null};lc.set(id,t);}
    if(TERMINAL.has(t.state))invalid(`EVENT_AFTER_TERMINAL:${id}`);
    if(kind==='pr.linked'){
      const v=validateLink(body&&body.link);
      if(!v.ok||body.schema!=='sinbad-pr-link/0-v1'||v.link.taskId!==id)invalid('PR_LINK_BODY');
      if(!['INGESTED','PR_LINKED','PR_OPEN','MERGE_CONTRADICTED'].includes(t.state))invalid(`PR_LINK_IN_STATE:${t.state}`);
      if(t.link&&t.link.prNumber!==v.link.prNumber)invalid('PR_LINK_CHANGED');
      for(const other of lc.values())if(other.taskId!==id&&other.link&&other.link.prNumber===v.link.prNumber&&other.link.repo===v.link.repo)invalid(`PR_LINKED_TWICE:${v.link.prNumber}`);
      t.link=v.link;t.linkRef=ref(e);t.links.push({ref:ref(e),link:v.link});t.state='PR_LINKED';
    }else if(kind==='merge.observed'){
      if(!t.link||!body||body.schema!=='sinbad-merge-observation/0-v1'||body.taskId!==id||body.prNumber!==t.link.prNumber||!MERGE_OUTCOMES.includes(body.outcome))invalid('MERGE_OBSERVATION_BODY');
      t.merges.push({ref:ref(e),body});
      if(body.outcome==='PR_OPEN')t.state=POST_MERGE.has(t.state)?'MERGE_CONTRADICTED':'PR_OPEN';
      else if(body.outcome==='MERGED_VERIFIED'){if(!SHA.test(String(body.mergeSha)))invalid('MERGE_SHA');if(!POST_MERGE.has(t.state))t.state='MERGED';else if(t.cis.length&&t.cis[t.cis.length-1].body.mergeSha!==body.mergeSha)t.state='MERGE_CONTRADICTED';}
      else if(body.outcome==='PR_CLOSED_UNMERGED')t.state='PR_CLOSED_UNMERGED';
      else if(body.outcome==='MERGE_CONTRADICTED')t.state='MERGE_CONTRADICTED';
    }else if(kind==='ci.observed'){
      const lastMerge=t.merges[t.merges.length-1];
      if(!POST_MERGE.has(t.state)||!lastMerge||lastMerge.body.outcome!=='MERGED_VERIFIED'||!body||body.schema!=='sinbad-ci-observation/0-v1'||body.taskId!==id||body.mergeSha!==lastMerge.body.mergeSha||body.mergeEventHash!==lastMerge.ref.eventHash||!CI_OUTCOMES.includes(body.outcome))invalid('CI_OBSERVATION_BODY');
      t.cis.push({ref:ref(e),body});
      if(body.outcome==='POST_MERGE_VERIFIED')t.state='POST_MERGE_VERIFIED';
      else if(body.outcome==='POST_MERGE_PENDING')t.state='POST_MERGE_PENDING';
      else if(body.outcome==='POST_MERGE_FAILED')t.state='POST_MERGE_FAILED';
      else if(body.outcome==='CONTRADICTED'||body.outcome==='WORKFLOW_SET_DRIFT')t.state='POST_MERGE_BLOCKED';
    }else{
      const lastMerge=t.merges[t.merges.length-1],lastCi=t.cis[t.cis.length-1];
      if(t.state!=='POST_MERGE_VERIFIED'||!lastMerge||!lastCi||lastMerge.body.outcome!=='MERGED_VERIFIED'||lastCi.body.outcome!=='POST_MERGE_VERIFIED'||!body||body.schema!=='sinbad-task-completion/0-v1'||body.taskId!==id||
        body.mergeSha!==lastMerge.body.mergeSha||body.mergeEventHash!==lastMerge.ref.eventHash||body.ciEventHash!==lastCi.ref.eventHash||lastCi.body.mergeEventHash!==lastMerge.ref.eventHash)invalid(`COMPLETED_WITHOUT_EVIDENCE:${id}`);
      t.completed={ref:ref(e),body};t.state='COMPLETED';
    }
  }
  const tasks=v0Tasks.map(v=>lc.get(v.taskId)||{taskId:v.taskId,state:v.state==='CLOSED'?'INGESTED':v.state,link:null,linkRef:null,links:[],merges:[],cis:[],completed:null});
  return Object.freeze({tasks});
}

// ---------- Owner summary: lifecycle section ----------
const short=s=>String(s).slice(0,12);
// v0View: {reduced:{tasks}}; lifecycle: reduceLifecycle result
function buildLifecycleSection({v0Reduced,lifecycle,head}){
  const facts=[];const lines=[];
  const add=(taskId,label,value,r,pointer)=>{const f=Object.freeze({taskId,label,value:String(value),eventHash:r.eventHash,bodyHash:r.bodyHash,pointer:pointer===undefined?null:pointer,derived:pointer===undefined});facts.push(f);lines.push(`- [${taskId}] ${label}: ${f.value}  {ev ${f.eventHash.slice(0,12)}}`);};
  const heading=t=>lines.push('',`### ${t}`,'');
  lines.push('# TASK LIFECYCLE (post-merge lifecycle v0)','',`Lifecycle shelf: ${head.eventCount} events, head ${head.headHash}`,
    'A v0 task state CLOSED means "agent report accepted" (IMPLEMENTATION INGESTED); it does not mean merged, verified or completed. Missing information is shown as '+NOT_RECORDED+'.',
    'KNOWN LIMITATION (Owner decision D1): an ingested task releases its file claim while its PR may still be open; the accepted v0 preflight is unchanged in this phase.');
  const per=[];
  for(const lt of lifecycle.tasks){
    const v0=v0Reduced.tasks.find(x=>x.taskId===lt.taskId);
    const ing=v0?[...v0.reports].reverse().find(r=>r.body.verification&&r.body.verification.outcome==='INGESTED'):null;
    const origin=v0&&v0.order.origin;
    const lastMerge=lt.merges.length?lt.merges[lt.merges.length-1]:null,lastCi=lt.cis.length?lt.cis[lt.cis.length-1]:null;
    per.push({lt,v0,ing,origin,lastMerge,lastCi});
  }
  heading('LIFECYCLE STATE');
  for(const {lt,v0,ing}of per){const r=lt.completed?lt.completed.ref:lastRef(lt)||(ing?ing.ref:v0.openedRef);add(lt.taskId,'lifecycle',lt.state,r);}
  heading('IMPLEMENTATION INGESTED');
  for(const {lt,v0,ing,origin}of per){
    if(ing)add(lt.taskId,'implementation',`INGESTED (v0 report accepted); resulting commit ${ing.body.report.resultingSha}`,ing.ref,undefined);
    else add(lt.taskId,'implementation',`${NOT_RECORDED} (v0 state ${v0.state})`,v0.openedRef);
    if(origin==='RETROACTIVE_BOOTSTRAP')add(lt.taskId,'origin','RETROACTIVE_BOOTSTRAP; no lifecycle evidence is recorded for it (Owner decision D4)',v0.openedRef);
  }
  heading('PR');
  for(const {lt,v0}of per){
    if(lt.link)add(lt.taskId,'PR',`#${lt.link.prNumber} linked to ${lt.link.repo}`,lt.linkRef,undefined);
    else add(lt.taskId,'PR',NOT_RECORDED,v0.openedRef);
  }
  heading('MERGED');
  for(const {lt,v0,lastMerge}of per){
    if(!lastMerge){add(lt.taskId,'merge',NOT_RECORDED,lt.linkRef||v0.openedRef);continue;}
    const b=lastMerge.body;
    add(lt.taskId,'merge observation',b.outcome==='MERGED_VERIFIED'?`MERGED_VERIFIED; merge commit ${b.mergeSha}; main is ${b.git.aheadOfMerge} commit(s) ahead; evidence GitHub read-only and local git`:b.outcome==='OBSERVATION_UNAVAILABLE'?`OBSERVATION_UNAVAILABLE (${b.unavailableReason})`:b.outcome,lastMerge.ref);
    for(const c of b.checks)add(lt.taskId,`merge check ${c.id} [${c.label}]`,`${c.detail} (${c.basis})`,lastMerge.ref);
  }
  heading('POST-MERGE CI VERIFIED');
  for(const {lt,v0,lastMerge,lastCi}of per){
    if(!lastCi){add(lt.taskId,'post-merge CI',NOT_RECORDED,lastMerge?lastMerge.ref:(lt.linkRef||v0.openedRef));continue;}
    const b=lastCi.body;
    add(lt.taskId,'post-merge CI outcome',`${b.outcome} for merge commit ${b.mergeSha}${b.unavailableReason?` (${b.unavailableReason})`:''}`,lastCi.ref);
    for(const w of b.perWorkflow)add(lt.taskId,`required workflow ${w.workflow}`,`${w.verdict}; runs ${w.runIds.length?w.runIds.join(', '):NOT_RECORDED}`,lastCi.ref);
    b.runs.filter(r=>r.headSha===b.mergeSha&&r.event==='push'&&REQUIRED_WORKFLOWS.includes(r.workflow)).forEach(r=>add(lt.taskId,'CI run',`workflow ${r.workflow}; run ${r.runId}; event ${r.event}; head ${r.headSha}; status ${r.status}; conclusion ${r.conclusion}`,lastCi.ref));
    b.nonRequired.forEach(r=>add(lt.taskId,'non-required run (does not block completion)',`workflow ${r.workflow}; run ${r.runId}; event ${r.event}; head ${r.headSha}; status ${r.status}; conclusion ${r.conclusion}`,lastCi.ref));
    b.reasons.forEach(r=>add(lt.taskId,'CI reason',r,lastCi.ref));
  }
  heading('COMPLETED');
  for(const {lt,v0}of per){
    if(lt.completed)add(lt.taskId,'completed',`COMPLETED (POST_MERGE_VERIFIED) at ${lt.completed.body.completedAt}; merge ${lt.completed.body.mergeSha}`,lt.completed.ref,undefined);
    else add(lt.taskId,'completed',`${NOT_RECORDED} (lifecycle ${lt.state})`,lastRef(lt)||v0.openedRef);
  }
  heading('RETROACTIVE LABEL');
  let any=false;
  for(const {lt,lastMerge,lastCi}of per){
    const src=lt.completed?lt.completed.body.retroactive:lastCi&&lastCi.body.retroactive?lastCi.body.retroactive:lastMerge?lastMerge.body.retroactive:null;
    if(src&&src.state==='RETROACTIVE'){any=true;add(lt.taskId,'RETROACTIVE',`${src.statement}; capability commit ${src.capabilityCommit}`,lt.completed?lt.completed.ref:(lastCi?lastCi.ref:lastMerge.ref));}
  }
  if(!any)lines.push(NOT_RECORDED);
  heading('UNVERIFIED CLAIMS (claimed, not elevated)');
  let anyClaim=false;
  for(const {lt,lastMerge,lastCi}of per){
    for(const {ref:r,link}of lt.links)for(const c of link.claims){anyClaim=true;add(lt.taskId,`claimed ${c.kind} [UNVERIFIED]`,`${c.value} (source ${c.source})`,r);}
    for(const c of (lastMerge?lastMerge.body.claims:[]).filter(c=>c.label==='CONTRADICTED'))add(lt.taskId,`claim ${c.kind} [CONTRADICTED]`,`${c.value}: ${c.basis}`,lastMerge.ref);
    for(const c of (lastCi?lastCi.body.claims:[]).filter(c=>c.label==='CONTRADICTED'))add(lt.taskId,`claim ${c.kind} [CONTRADICTED]`,`${c.value}: ${c.basis}`,lastCi.ref);
  }
  if(!anyClaim)lines.push(NOT_RECORDED);
  lines.push('');
  return Object.freeze({text:`${lines.join('\n')}\n`,facts:Object.freeze(facts)});
  function lastRef(lt){
    const all=[...(lt.linkRef?[lt.linkRef]:[]),...lt.merges.map(m=>m.ref),...lt.cis.map(c=>c.ref)].sort((a,b)=>a.sequence-b.sequence);
    return all.length?all[all.length-1]:null;
  }
}

module.exports=Object.freeze({VERSION,SHELF_ID,ACTOR,REQUIRED_WORKFLOWS,KINDS,MERGE_OUTCOMES,CI_OUTCOMES,LINK_KEYS,V0REF_KEYS,validateLink,retroactiveOf,decideMerge,decideCi,workflowName,workflowTriggersMainPush,checkWorkflowSet,reduceLifecycle,buildLifecycleSection});
