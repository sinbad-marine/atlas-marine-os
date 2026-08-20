'use strict';
const crypto=require('node:crypto');
const fsp=require('node:fs').promises;
const path=require('node:path');
const persistedVerifier=require('./persisted-workspace-verifier.js');
const modelValidator=require('./local-model-artifact-validator.js');

const VERSION='0.3.0';
const MODE='MODEL_PROPOSAL_DIFF_PLAN_ONLY';
const plans=new WeakSet();
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const blocked=(reason,detail='')=>freeze({version:VERSION,mode:MODE,status:'MODEL_PROPOSAL_DIFF_BLOCKED',reason,detail:String(detail),changes:[],io:{filesystemRead:true,filesystemWrite:false,network:false,commands:false}});

function create(options={}){
  const approvedBase=path.resolve(String(options.approvedBase||process.cwd())),workspaceRoot=path.join(approvedBase,'studio-workspaces');
  async function plan(report,proposal){
    const projectRoot=path.join(workspaceRoot,String(report&&report.projectSlug||''));
    if(!persistedVerifier.isReportFor(report,projectRoot)||report.status!=='PERSISTED_WORKSPACE_VERIFIED')return blocked('AUTHENTIC_BOUND_WORKSPACE_REPORT_REQUIRED');
    if(!modelValidator.isAuthenticProposal(proposal)||proposal.status!=='LOCAL_MODEL_ARTIFACT_PROPOSAL_VERIFIED_UNTRUSTED')return blocked('AUTHENTIC_MODEL_PROPOSAL_REQUIRED');
    if(report.projectSlug!==proposal.projectSlug)return blocked('PROJECT_SLUG_MISMATCH');
    try{
      const found=new Map();
      async function walk(directory){for(const entry of await fsp.readdir(directory,{withFileTypes:true})){const absolute=path.join(directory,entry.name),stat=await fsp.lstat(absolute),relative=path.relative(projectRoot,absolute).split(path.sep).join('/');if(stat.isSymbolicLink())throw Object.assign(new Error(relative),{reviewCode:'WORKSPACE_LINK_FORBIDDEN'});if(stat.isDirectory()){await walk(absolute);continue;}if(!stat.isFile())throw Object.assign(new Error(relative),{reviewCode:'WORKSPACE_SPECIAL_ENTRY_FORBIDDEN'});found.set(relative,absolute);}}
      await walk(projectRoot);
      const expected=new Map(report.files.map(item=>[item.path,item]));
      const missing=[...expected.keys()].filter(item=>!found.has(item)).sort(),extra=[...found.keys()].filter(item=>!expected.has(item)).sort();
      if(missing.length)return blocked('WORKSPACE_FILE_MISSING',missing.join(','));if(extra.length)return blocked('WORKSPACE_EXTRA_FILE',extra.join(','));
      const currentHashes=new Map();
      for(const [relative,item] of expected){const bytes=await fsp.readFile(found.get(relative));if(bytes.length!==item.bytes||sha256(bytes)!==item.sha256)return blocked('WORKSPACE_FILE_CHANGED',relative);currentHashes.set(relative,item.sha256);}
      const proposed=new Map(proposal.manifest.map(item=>[item.path,item])),changes=[];
      for(const item of proposal.manifest){const oldHash=currentHashes.get(item.path)||null;changes.push(Object.freeze({path:item.path,action:oldHash===null?'CREATE':oldHash===item.sha256?'UNCHANGED':'UPDATE',oldSha256:oldHash,newSha256:item.sha256,bytes:item.bytes}));}
      for(const item of report.files)if(!proposed.has(item.path))changes.push(Object.freeze({path:item.path,action:'PRESERVE',oldSha256:item.sha256,newSha256:null,bytes:item.bytes}));
      changes.sort((a,b)=>a.path.localeCompare(b.path));
      const summary=freeze({create:changes.filter(x=>x.action==='CREATE').length,update:changes.filter(x=>x.action==='UPDATE').length,unchanged:changes.filter(x=>x.action==='UNCHANGED').length,preserve:changes.filter(x=>x.action==='PRESERVE').length,delete:0});
      const result=freeze({version:VERSION,mode:MODE,status:'MODEL_PROPOSAL_DIFF_READY',projectSlug:report.projectSlug,workspaceManifestHash:report.manifestHash,proposalManifestHash:proposal.manifestHash,changes:Object.freeze(changes),summary,deletionPolicy:'DENY',authority:'PLAN_ONLY',io:{filesystemRead:true,filesystemWrite:false,network:false,commands:false},nextGate:'HUMAN_REVIEW_BEFORE_ANY_PATCH_AUTHORIZATION'});
      plans.add(result);return result;
    }catch(error){if(error&&error.reviewCode)return blocked(error.reviewCode,error.message);if(error&&error.code==='ENOENT')return blocked('WORKSPACE_MISSING');return blocked('DIFF_PLANNING_FAILED',error&&error.code?error.code:'UNKNOWN');}
  }
  return freeze({VERSION,MODE,workspaceRoot,plan});
}
const isAuthenticPlan=value=>Boolean(value&&plans.has(value));
module.exports=freeze({VERSION,MODE,create,isAuthenticPlan});
