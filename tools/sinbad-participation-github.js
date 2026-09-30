'use strict';
// Read-only GitHub observation for the SINBAD post-merge lifecycle. GitHub is an evidence INPUT, never an authority.
// Boundary (Owner decision D5): GET only, three allowlisted endpoint shapes, no mutation of any kind (no PR edit, merge,
// comment, dispatch, rerun, label or branch write), no credential handling or persistence - `gh` uses its own login and
// this module never reads, logs or stores a token. An unavailable or malformed answer is reported as unavailable so the
// caller fails closed.
const cp=require('node:child_process');

const SEGMENT='[A-Za-z0-9._-]+';
const ALLOWED_ENDPOINTS=Object.freeze([
  new RegExp(`^repos/${SEGMENT}/${SEGMENT}/pulls/\\d{1,8}$`,'u'),
  new RegExp(`^repos/${SEGMENT}/${SEGMENT}/actions/runs\\?head_sha=[0-9a-f]{40}&per_page=100&page=\\d{1,2}$`,'u'),
  new RegExp(`^repos/${SEGMENT}/${SEGMENT}/actions/runs/\\d{1,15}$`,'u')
]);
const REPO=/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u;
const SHA=/^[0-9a-f]{40}$/u;
const PER_PAGE=100,MAX_PAGES=10;

// the only argument vector this module ever hands to gh
function buildArgs(endpoint){
  if(typeof endpoint!=='string'||!ALLOWED_ENDPOINTS.some(re=>re.test(endpoint)))throw new Error('GITHUB_ENDPOINT_NOT_ALLOWED');
  return ['api','--method','GET',endpoint];
}
function defaultRunner(args){
  const r=cp.spawnSync('gh',args,{encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024,timeout:60_000});
  return {status:r.status,stdout:r.stdout||'',stderr:r.stderr||'',error:r.error?String(r.error.message):null};
}
const str=v=>typeof v==='string';
function pullOf(d){
  if(!d||typeof d!=='object'||!Number.isSafeInteger(d.number)||!str(d.state)||typeof d.merged!=='boolean'||!(d.merged_at===null||str(d.merged_at))||!(d.merge_commit_sha===null||str(d.merge_commit_sha))||!d.head||!str(d.head.sha)||!d.base||!str(d.base.ref))return null;
  return Object.freeze({number:d.number,state:d.state,merged:d.merged,mergedAt:d.merged_at,mergeCommitSha:d.merge_commit_sha,headSha:d.head.sha,baseRef:d.base.ref});
}
function runOf(d){
  if(!d||typeof d!=='object'||!Number.isSafeInteger(d.id)||!str(d.name)||!str(d.event)||!str(d.head_sha)||!str(d.status)||!(d.conclusion===null||str(d.conclusion)))return null;
  return Object.freeze({id:d.id,name:d.name,event:d.event,headSha:d.head_sha,status:d.status,conclusion:d.conclusion,runAttempt:Number.isSafeInteger(d.run_attempt)?d.run_attempt:null,createdAt:str(d.created_at)?d.created_at:null});
}

function githubObserver({repo,run=defaultRunner}={}){
  if(typeof repo!=='string'||!REPO.test(repo))throw new Error('GITHUB_REPO_INVALID');
  function get(endpoint){
    const r=run(buildArgs(endpoint));
    if(!r||r.error)return {ok:false,error:'gh is not available'};
    if(r.status!==0)return /HTTP 404/u.test(String(r.stderr))?{ok:false,notFound:true}:{ok:false,error:`gh exited with status ${r.status}`};
    try{return {ok:true,data:JSON.parse(r.stdout)};}catch{return {ok:false,error:'the answer was not JSON'};}
  }
  return Object.freeze({
    repo,
    getPull(number){
      if(!Number.isSafeInteger(number)||number<1||number>99_999_999)throw new Error('PR_NUMBER_INVALID');
      const r=get(`repos/${repo}/pulls/${number}`);
      if(r.notFound)return {available:true,notFound:true};
      if(!r.ok)return {available:false,error:r.error};
      const pull=pullOf(r.data);
      return pull?{available:true,notFound:false,pull}:{available:false,error:'unexpected pull request shape'};
    },
    listRuns(sha){
      if(typeof sha!=='string'||!SHA.test(sha))throw new Error('SHA_INVALID');
      const runs=[];
      for(let page=1;page<=MAX_PAGES;page+=1){
        const r=get(`repos/${repo}/actions/runs?head_sha=${sha}&per_page=${PER_PAGE}&page=${page}`);
        if(!r.ok)return {available:false,complete:false,runs:[],error:r.notFound?'runs endpoint not found':r.error};
        const d=r.data;
        if(!d||!Array.isArray(d.workflow_runs)||!Number.isSafeInteger(d.total_count))return {available:false,complete:false,runs:[],error:'unexpected runs shape'};
        const mapped=d.workflow_runs.map(runOf);
        if(mapped.some(x=>!x))return {available:false,complete:false,runs:[],error:'unexpected run shape'};
        runs.push(...mapped);
        if(runs.length>=d.total_count||d.workflow_runs.length<PER_PAGE)return {available:true,complete:true,runs:Object.freeze(runs)};
      }
      return {available:true,complete:false,runs:Object.freeze(runs),error:'more runs than the page limit'};
    },
    getRun(id){
      if(!Number.isSafeInteger(id)||id<1||id>999_999_999_999_999)throw new Error('RUN_ID_INVALID');
      const r=get(`repos/${repo}/actions/runs/${id}`);
      if(r.notFound)return {id,available:true,found:false,run:null};
      if(!r.ok)return {id,available:false,found:false,run:null,error:r.error};
      const run=runOf(r.data);
      return run?{id,available:true,found:true,run}:{id,available:false,found:false,run:null,error:'unexpected run shape'};
    }
  });
}

module.exports=Object.freeze({ALLOWED_ENDPOINTS,buildArgs,defaultRunner,githubObserver});
