'use strict';
const fs=require('node:fs');
const fsp=fs.promises;
const path=require('node:path');
const compiler=require('./virtual-artifact-compiler.js');

const VERSION='0.1.0';
const MODE='SANDBOX_WRITE_ONLY';
const ID=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/u;
const ARTIFACT_PATH=/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/u;
const MAX_TTL_MS=10*60*1000;
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

function create(options={}){
  const approvedBase=path.resolve(String(options.approvedBase||process.cwd()));
  const workspaceRoot=path.join(approvedBase,'studio-workspaces');
  const clock=typeof options.clock==='function'?options.clock:Date.now;
  const grants=new WeakMap(),grantObjects=new WeakSet();

  function authorize(bundle,input={}){
    if(!compiler.isAuthenticBundle(bundle)||bundle.status!=='VIRTUAL_ARTIFACTS_READY')throw new TypeError('authentic virtual artifact bundle required');
    const approvedBy=String(input.approvedBy||''),purpose=String(input.purpose||''),nonce=String(input.nonce||'');
    if(!ID.test(approvedBy)||!ID.test(purpose)||!ID.test(nonce))throw new TypeError('bounded approval identity purpose and nonce are required');
    const now=Number(clock()),expiresAt=Number(input.expiresAt);
    if(!Number.isFinite(expiresAt)||expiresAt<=now||expiresAt>now+MAX_TTL_MS)throw new RangeError('sandbox write approval expiry is invalid');
    const authorization=freeze({version:VERSION,mode:MODE,approvedBy,purpose,nonce,projectSlug:bundle.plan.project.slug,expiresAt,scope:'CREATE_NEW_PROJECT_ONLY'});
    grants.set(authorization,{bundle,consumed:false});grantObjects.add(authorization);return authorization;
  }

  async function persist(bundle,authorization){
    const grant=authorization&&grantObjects.has(authorization)?grants.get(authorization):null;
    if(!grant||grant.bundle!==bundle||grant.consumed)throw new Error('SANDBOX_WRITE_NOT_AUTHORIZED');
    grant.consumed=true;
    if(Number(clock())>=authorization.expiresAt)throw new Error('SANDBOX_WRITE_AUTHORIZATION_EXPIRED');
    if(!compiler.isAuthenticBundle(bundle)||bundle.status!=='VIRTUAL_ARTIFACTS_READY')throw new Error('VIRTUAL_BUNDLE_INVALID');
    const slug=String(bundle.plan?.project?.slug||'');
    if(!/^[a-z0-9][a-z0-9-]{0,47}$/u.test(slug))throw new Error('PROJECT_SLUG_INVALID');
    const paths=new Set();let totalBytes=0;
    for(const item of bundle.artifacts){
      if(!ARTIFACT_PATH.test(item.path)||path.posix.normalize(item.path)!==item.path||paths.has(item.path))throw new Error('ARTIFACT_PATH_INVALID');
      if(Buffer.byteLength(item.content,'utf8')!==item.bytes)throw new Error('ARTIFACT_SIZE_MISMATCH');
      paths.add(item.path);totalBytes+=item.bytes;
    }
    if(totalBytes!==bundle.totalBytes||totalBytes>compiler.MAX_TOTAL_BYTES)throw new Error('BUNDLE_SIZE_INVALID');

    await fsp.mkdir(workspaceRoot,{recursive:true});
    const rootStat=await fsp.lstat(workspaceRoot);
    if(rootStat.isSymbolicLink()||!rootStat.isDirectory())throw new Error('WORKSPACE_ROOT_INVALID');
    const realRoot=await fsp.realpath(workspaceRoot);
    if(path.resolve(realRoot)!==path.resolve(workspaceRoot))throw new Error('WORKSPACE_ROOT_REDIRECTED');
    const target=path.join(realRoot,slug);
    try{await fsp.lstat(target);throw new Error('PROJECT_ALREADY_EXISTS');}catch(error){if(error.code!=='ENOENT')throw error;}

    let staging='';
    try{
      staging=await fsp.mkdtemp(path.join(realRoot,`.studio-${slug}-`));
      for(const item of bundle.artifacts){
        const destination=path.resolve(staging,...item.path.split('/'));
        if(!destination.startsWith(path.resolve(staging)+path.sep))throw new Error('ARTIFACT_PATH_ESCAPE');
        await fsp.mkdir(path.dirname(destination),{recursive:true});
        await fsp.writeFile(destination,item.content,{encoding:'utf8',flag:'wx'});
      }
      await fsp.rename(staging,target);staging='';
      return freeze({version:VERSION,mode:MODE,status:'SANDBOX_PROJECT_CREATED',projectSlug:slug,workspace:path.relative(approvedBase,target).split(path.sep).join('/'),files:Object.freeze([...paths].sort()),bytes:totalBytes,executionPerformed:false,networkPerformed:false,publishPerformed:false,overwritePerformed:false});
    }catch(error){
      if(staging&&path.resolve(staging).startsWith(path.resolve(realRoot)+path.sep))await fsp.rm(staging,{recursive:true,force:true});
      throw error;
    }
  }
  return freeze({VERSION,MODE,workspaceRoot,authorize,persist});
}
module.exports=freeze({VERSION,MODE,MAX_TTL_MS,create});
