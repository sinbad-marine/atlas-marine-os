'use strict';
const crypto=require('node:crypto');
const fsp=require('node:fs').promises;
const path=require('node:path');
const validator=require('./local-model-artifact-validator.js');

const VERSION='0.2.0';
const MODE='LOCAL_MODEL_PROPOSAL_WRITE_ONLY';
const MAX_TTL_MS=5*60*1000;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u;
const SAFE_PATH=/^(?:web|software|animation)\/[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/u;
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');

function create(options={}){
  const approvedBase=path.resolve(String(options.approvedBase||process.cwd()));
  const proposalRoot=path.join(approvedBase,'studio-proposals');
  const clock=typeof options.clock==='function'?options.clock:Date.now;
  const grants=new WeakMap(),grantObjects=new WeakSet();

  function authorize(proposal,input={}){
    if(!validator.isAuthenticProposal(proposal)||proposal.status!=='LOCAL_MODEL_ARTIFACT_PROPOSAL_VERIFIED_UNTRUSTED')throw new TypeError('authentic verified model proposal required');
    const approvedBy=String(input.approvedBy||''),purpose=String(input.purpose||''),nonce=String(input.nonce||'');
    if(!ID.test(approvedBy)||!ID.test(purpose)||!ID.test(nonce))throw new TypeError('bounded approval identity purpose and nonce are required');
    const now=Number(clock()),expiresAt=Number(input.expiresAt);
    if(!Number.isFinite(expiresAt)||expiresAt<=now||expiresAt>now+MAX_TTL_MS)throw new RangeError('proposal write approval expiry is invalid');
    const authorization=freeze({version:VERSION,mode:MODE,approvedBy,purpose,nonce,projectSlug:proposal.projectSlug,manifestHash:proposal.manifestHash,expiresAt,scope:'CREATE_NEW_UNTRUSTED_PROPOSAL_ONLY'});
    grants.set(authorization,{proposal,consumed:false});grantObjects.add(authorization);return authorization;
  }

  async function persist(proposal,authorization){
    const grant=authorization&&grantObjects.has(authorization)?grants.get(authorization):null;
    if(!grant||grant.proposal!==proposal||grant.consumed)throw new Error('MODEL_PROPOSAL_WRITE_NOT_AUTHORIZED');
    grant.consumed=true;
    if(Number(clock())>=authorization.expiresAt)throw new Error('MODEL_PROPOSAL_WRITE_AUTHORIZATION_EXPIRED');
    if(!validator.isAuthenticProposal(proposal))throw new Error('MODEL_PROPOSAL_INVALID');
    const seen=new Set();let totalBytes=0;
    for(const item of proposal.artifacts){
      if(!SAFE_PATH.test(item.path)||path.posix.normalize(item.path)!==item.path||seen.has(item.path))throw new Error('MODEL_PROPOSAL_ARTIFACT_INVALID');
      const bytes=Buffer.from(item.content,'utf8');
      if(bytes.length!==item.bytes||sha256(bytes)!==proposal.manifest.find(record=>record.path===item.path)?.sha256)throw new Error('MODEL_PROPOSAL_HASH_MISMATCH');
      seen.add(item.path);totalBytes+=bytes.length;
    }
    if(totalBytes!==proposal.totalBytes||totalBytes>validator.MAX_TOTAL_BYTES)throw new Error('MODEL_PROPOSAL_BYTES_INVALID');
    await fsp.mkdir(proposalRoot,{recursive:true});
    const rootStat=await fsp.lstat(proposalRoot);
    if(rootStat.isSymbolicLink()||!rootStat.isDirectory())throw new Error('MODEL_PROPOSAL_ROOT_INVALID');
    const realRoot=await fsp.realpath(proposalRoot);
    if(path.resolve(realRoot)!==path.resolve(proposalRoot))throw new Error('MODEL_PROPOSAL_ROOT_REDIRECTED');
    const target=path.join(realRoot,proposal.projectSlug);
    try{await fsp.lstat(target);throw new Error('MODEL_PROPOSAL_ALREADY_EXISTS');}catch(error){if(error.code!=='ENOENT')throw error;}
    let staging='';
    try{
      staging=await fsp.mkdtemp(path.join(realRoot,`.proposal-${proposal.projectSlug}-`));
      for(const item of proposal.artifacts){
        const destination=path.resolve(staging,...item.path.split('/'));
        if(!destination.startsWith(path.resolve(staging)+path.sep))throw new Error('MODEL_PROPOSAL_PATH_ESCAPE');
        await fsp.mkdir(path.dirname(destination),{recursive:true});await fsp.writeFile(destination,item.content,{encoding:'utf8',flag:'wx'});
      }
      const evidence=JSON.stringify({version:1,status:'UNTRUSTED_MODEL_PROPOSAL',model:proposal.model,manifestHash:proposal.manifestHash,authority:'DATA_ONLY',executionAllowed:false,publishAllowed:false},null,2)+'\n';
      await fsp.writeFile(path.join(staging,'PROPOSAL_EVIDENCE.json'),evidence,{encoding:'utf8',flag:'wx'});
      await fsp.rename(staging,target);staging='';
      return freeze({version:VERSION,mode:MODE,status:'LOCAL_MODEL_PROPOSAL_CREATED_UNTRUSTED',projectSlug:proposal.projectSlug,manifestHash:proposal.manifestHash,proposal:path.relative(approvedBase,target).split(path.sep).join('/'),files:Object.freeze([...seen].sort()),bytes:totalBytes,authority:'DATA_ONLY',executed:false,opened:false,published:false,overwritten:false,nextGate:'INDEPENDENT_PERSISTED_PROPOSAL_VERIFICATION'});
    }catch(error){if(staging&&path.resolve(staging).startsWith(path.resolve(realRoot)+path.sep))await fsp.rm(staging,{recursive:true,force:true});throw error;}
  }
  return freeze({VERSION,MODE,proposalRoot,authorize,persist});
}

module.exports=freeze({VERSION,MODE,MAX_TTL_MS,create});
