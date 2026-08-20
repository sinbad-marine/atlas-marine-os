'use strict';
const crypto=require('node:crypto');
const fsp=require('node:fs').promises;
const path=require('node:path');
const persistedVerifier=require('./persisted-workspace-verifier.js');

const VERSION='0.1.0';
const MODE='SCRIPTLESS_PREVIEW_MEMORY_ONLY';
const ALLOWED=new Set(['.html','.css','.svg','.md','.json']);
const packages=new WeakSet();
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const blocked=(reason,detail='')=>freeze({version:VERSION,mode:MODE,status:'SCRIPTLESS_PREVIEW_BLOCKED',reason,detail:String(detail),artifacts:[],io:{filesystemRead:true,filesystemWrite:false,network:false,commands:false,render:false}});

function sanitizeHtml(source){
  let value=source.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/giu,'');
  value=value.replace(/<script\b[^>]*\/\s*>/giu,'');
  const policy='<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'self\'; img-src \'self\'; font-src \'none\'; connect-src \'none\'; media-src \'none\'; frame-src \'none\'; object-src \'none\'; script-src \'none\'; base-uri \'none\'; form-action \'none\'">';
  return value.replace(/<head>/iu,`<head>${policy}`);
}

function create(options={}){
  const approvedBase=path.resolve(String(options.approvedBase||process.cwd()));
  const workspaceRoot=path.join(approvedBase,'studio-workspaces');
  async function packagePreview(report){
    const projectRoot=path.join(workspaceRoot,String(report&&report.projectSlug||''));
    if(!persistedVerifier.isReportFor(report,projectRoot)||report.status!=='PERSISTED_WORKSPACE_VERIFIED')return blocked('AUTHENTIC_BOUND_PERSISTED_REPORT_REQUIRED');
    try{
      const artifacts=[];
      for(const item of report.files){
        const extension=path.posix.extname(item.path).toLowerCase();
        if(!ALLOWED.has(extension))continue;
        const absolute=path.resolve(projectRoot,...item.path.split('/'));
        if(!absolute.startsWith(path.resolve(projectRoot)+path.sep))return blocked('PREVIEW_PATH_ESCAPE',item.path);
        const stat=await fsp.lstat(absolute);
        if(stat.isSymbolicLink()||!stat.isFile())return blocked('PREVIEW_FILE_INVALID',item.path);
        const bytes=await fsp.readFile(absolute);
        if(bytes.length!==item.bytes||sha256(bytes)!==item.sha256)return blocked('PERSISTED_FILE_CHANGED',item.path);
        const original=bytes.toString('utf8'),content=extension==='.html'?sanitizeHtml(original):original;
        if(extension==='.html'&&(/<script\b/iu.test(content)||/\son[a-z]+\s*=|javascript\s*:/iu.test(content)))return blocked('SCRIPTLESS_POLICY_VIOLATION',item.path);
        const output=Buffer.from(content,'utf8');
        artifacts.push(Object.freeze({path:item.path,bytes:output.length,sha256:sha256(output),content}));
      }
      artifacts.sort((a,b)=>a.path.localeCompare(b.path));
      if(!artifacts.length)return blocked('NO_SCRIPTLESS_ARTIFACTS');
      const manifest=artifacts.map(({path,bytes,sha256})=>Object.freeze({path,bytes,sha256}));
      const result=freeze({version:VERSION,mode:MODE,status:'SCRIPTLESS_PREVIEW_PACKAGE_READY',projectSlug:report.projectSlug,sourceManifestHash:report.manifestHash,manifestHash:sha256(Buffer.from(JSON.stringify(manifest),'utf8')),artifacts:Object.freeze(artifacts),excludedExtensions:Object.freeze(['.js']),io:{filesystemRead:true,filesystemWrite:false,network:false,commands:false,render:false},nextGate:'EXPLICIT_LOCAL_PREVIEW_WRITE_AUTHORIZATION'});
      packages.add(result);return result;
    }catch(error){
      if(error&&error.code==='ENOENT')return blocked('PREVIEW_FILE_MISSING');
      return blocked('PREVIEW_PACKAGING_FAILED',error&&error.code?error.code:'UNKNOWN');
    }
  }
  return freeze({VERSION,MODE,workspaceRoot,packagePreview});
}

const isAuthenticPackage=value=>Boolean(value&&packages.has(value));
module.exports=freeze({VERSION,MODE,create,isAuthenticPackage});
