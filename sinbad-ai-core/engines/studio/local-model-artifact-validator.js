'use strict';
const crypto=require('node:crypto');
const path=require('node:path');
const gateway=require('./local-model-loopback-gateway.js');
const staticVerifier=require('./static-artifact-verifier.js');

const VERSION='0.2.0';
const MODE='LOCAL_MODEL_ARTIFACT_VALIDATE_ONLY';
const MAX_ARTIFACTS=16;
const MAX_TOTAL_BYTES=49152;
const SAFE_PATH=/^(?:web|software|animation)\/[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/u;
const SLUG=/^[a-z0-9][a-z0-9-]{0,47}$/u;
const proposals=new WeakSet();
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const blocked=(reason,issues=[])=>freeze({version:VERSION,mode:MODE,status:'LOCAL_MODEL_ARTIFACTS_BLOCKED',reason,issues:Object.freeze(issues),artifacts:[],io:{filesystem:false,network:false,commands:false,render:false}});

function validate(draft){
  if(!gateway.isAuthenticDraft(draft)||draft.status!=='LOCAL_MODEL_DRAFT_RECEIVED_UNTRUSTED')return blocked('AUTHENTIC_LOCAL_MODEL_DRAFT_REQUIRED');
  let parsed;try{parsed=JSON.parse(draft.text);}catch(_){return blocked('ARTIFACT_PROPOSAL_JSON_INVALID');}
  if(!exactKeys(parsed,['version','projectSlug','artifacts'])||parsed.version!==1||!SLUG.test(String(parsed.projectSlug||''))||!Array.isArray(parsed.artifacts))return blocked('ARTIFACT_PROPOSAL_SCHEMA_INVALID');
  if(!parsed.artifacts.length||parsed.artifacts.length>MAX_ARTIFACTS)return blocked('ARTIFACT_COUNT_INVALID');
  const seen=new Set(),artifacts=[],issues=[];let totalBytes=0;
  for(const candidate of parsed.artifacts){
    if(!exactKeys(candidate,['path','mediaType','content']))return blocked('ARTIFACT_SCHEMA_INVALID');
    const artifactPath=String(candidate.path||''),mediaType=String(candidate.mediaType||''),content=typeof candidate.content==='string'?candidate.content:null;
    if(!SAFE_PATH.test(artifactPath)||path.posix.normalize(artifactPath)!==artifactPath||seen.has(artifactPath))return blocked('ARTIFACT_PATH_INVALID');
    if(content===null)return blocked('ARTIFACT_CONTENT_INVALID');
    const bytes=Buffer.byteLength(content,'utf8');totalBytes+=bytes;
    if(totalBytes>MAX_TOTAL_BYTES)return blocked('ARTIFACT_BYTES_EXCEEDED');
    const artifact=Object.freeze({path:artifactPath,mediaType,content,bytes});seen.add(artifactPath);artifacts.push(artifact);
    for(const item of staticVerifier.inspectArtifact(artifact))issues.push(Object.freeze({path:artifactPath,...item}));
  }
  if(issues.length)return blocked('STATIC_POLICY_VIOLATION',issues);
  artifacts.sort((a,b)=>a.path.localeCompare(b.path));
  const manifest=artifacts.map(item=>Object.freeze({path:item.path,mediaType:item.mediaType,bytes:item.bytes,sha256:sha256(Buffer.from(item.content,'utf8'))}));
  const result=freeze({version:VERSION,mode:MODE,status:'LOCAL_MODEL_ARTIFACT_PROPOSAL_VERIFIED_UNTRUSTED',projectSlug:parsed.projectSlug,model:draft.model,authority:'DATA_ONLY',artifacts:Object.freeze(artifacts),manifest:Object.freeze(manifest),manifestHash:sha256(Buffer.from(JSON.stringify(manifest),'utf8')),totalBytes,io:{filesystem:false,network:false,commands:false,render:false},nextGate:'EXPLICIT_PROPOSAL_SANDBOX_WRITE_AUTHORIZATION'});
  proposals.add(result);return result;
}

const isAuthenticProposal=value=>Boolean(value&&proposals.has(value));
module.exports=freeze({VERSION,MODE,MAX_ARTIFACTS,MAX_TOTAL_BYTES,validate,isAuthenticProposal});
