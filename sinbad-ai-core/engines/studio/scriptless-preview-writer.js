'use strict';
const crypto=require('node:crypto');
const fsp=require('node:fs').promises;
const path=require('node:path');
const packager=require('./scriptless-preview-packager.js');

const VERSION='0.1.0';
const MODE='SCRIPTLESS_PREVIEW_WRITE_ONLY';
const MAX_TTL_MS=10*60*1000;
const ID=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/u;
const SAFE_PATH=/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/u;
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');

function create(options={}){
  const approvedBase=path.resolve(String(options.approvedBase||process.cwd()));
  const previewRoot=path.join(approvedBase,'studio-previews');
  const clock=typeof options.clock==='function'?options.clock:Date.now;
  const grants=new WeakMap(),grantObjects=new WeakSet();

  function authorize(previewPackage,input={}){
    if(!packager.isAuthenticPackage(previewPackage)||previewPackage.status!=='SCRIPTLESS_PREVIEW_PACKAGE_READY')throw new TypeError('authentic scriptless preview package required');
    const approvedBy=String(input.approvedBy||''),purpose=String(input.purpose||''),nonce=String(input.nonce||'');
    if(!ID.test(approvedBy)||!ID.test(purpose)||!ID.test(nonce))throw new TypeError('bounded approval identity purpose and nonce are required');
    const now=Number(clock()),expiresAt=Number(input.expiresAt);
    if(!Number.isFinite(expiresAt)||expiresAt<=now||expiresAt>now+MAX_TTL_MS)throw new RangeError('preview write approval expiry is invalid');
    const authorization=freeze({version:VERSION,mode:MODE,approvedBy,purpose,nonce,projectSlug:previewPackage.projectSlug,manifestHash:previewPackage.manifestHash,expiresAt,scope:'CREATE_SCRIPTLESS_PREVIEW_ONLY'});
    grants.set(authorization,{previewPackage,consumed:false});grantObjects.add(authorization);return authorization;
  }

  async function persist(previewPackage,authorization){
    const grant=authorization&&grantObjects.has(authorization)?grants.get(authorization):null;
    if(!grant||grant.previewPackage!==previewPackage||grant.consumed)throw new Error('PREVIEW_WRITE_NOT_AUTHORIZED');
    grant.consumed=true;
    if(Number(clock())>=authorization.expiresAt)throw new Error('PREVIEW_WRITE_AUTHORIZATION_EXPIRED');
    if(!packager.isAuthenticPackage(previewPackage)||previewPackage.status!=='SCRIPTLESS_PREVIEW_PACKAGE_READY')throw new Error('PREVIEW_PACKAGE_INVALID');
    if(!/^[a-z0-9][a-z0-9-]{0,47}$/u.test(previewPackage.projectSlug))throw new Error('PROJECT_SLUG_INVALID');
    const seen=new Set();let totalBytes=0;
    for(const item of previewPackage.artifacts){
      if(!SAFE_PATH.test(item.path)||path.posix.normalize(item.path)!==item.path||seen.has(item.path)||item.path.endsWith('.js'))throw new Error('PREVIEW_ARTIFACT_INVALID');
      const bytes=Buffer.from(item.content,'utf8');
      if(bytes.length!==item.bytes||sha256(bytes)!==item.sha256)throw new Error('PREVIEW_ARTIFACT_HASH_MISMATCH');
      seen.add(item.path);totalBytes+=bytes.length;
    }
    await fsp.mkdir(previewRoot,{recursive:true});
    const rootStat=await fsp.lstat(previewRoot);
    if(rootStat.isSymbolicLink()||!rootStat.isDirectory())throw new Error('PREVIEW_ROOT_INVALID');
    const realRoot=await fsp.realpath(previewRoot);
    if(path.resolve(realRoot)!==path.resolve(previewRoot))throw new Error('PREVIEW_ROOT_REDIRECTED');
    const target=path.join(realRoot,previewPackage.projectSlug);
    try{await fsp.lstat(target);throw new Error('PREVIEW_ALREADY_EXISTS');}catch(error){if(error.code!=='ENOENT')throw error;}
    let staging='';
    try{
      staging=await fsp.mkdtemp(path.join(realRoot,`.preview-${previewPackage.projectSlug}-`));
      for(const item of previewPackage.artifacts){
        const destination=path.resolve(staging,...item.path.split('/'));
        if(!destination.startsWith(path.resolve(staging)+path.sep))throw new Error('PREVIEW_PATH_ESCAPE');
        await fsp.mkdir(path.dirname(destination),{recursive:true});
        await fsp.writeFile(destination,item.content,{encoding:'utf8',flag:'wx'});
      }
      await fsp.rename(staging,target);staging='';
      return freeze({version:VERSION,mode:MODE,status:'SCRIPTLESS_PREVIEW_CREATED',projectSlug:previewPackage.projectSlug,manifestHash:previewPackage.manifestHash,preview:path.relative(approvedBase,target).split(path.sep).join('/'),files:Object.freeze([...seen].sort()),bytes:totalBytes,opened:false,executed:false,networkUsed:false,published:false,overwritten:false,nextGate:'EXPLICIT_USER_LOCAL_OPEN'});
    }catch(error){
      if(staging&&path.resolve(staging).startsWith(path.resolve(realRoot)+path.sep))await fsp.rm(staging,{recursive:true,force:true});
      throw error;
    }
  }
  return freeze({VERSION,MODE,previewRoot,authorize,persist});
}

module.exports=freeze({VERSION,MODE,MAX_TTL_MS,create});
