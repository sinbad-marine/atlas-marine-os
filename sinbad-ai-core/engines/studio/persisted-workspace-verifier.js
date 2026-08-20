'use strict';
const crypto=require('node:crypto');
const fsp=require('node:fs').promises;
const path=require('node:path');
const staticVerifier=require('./static-artifact-verifier.js');

const VERSION='0.1.0';
const MODE='PERSISTED_WORKSPACE_VERIFY_ONLY';
const SLUG=/^[a-z0-9][a-z0-9-]{0,47}$/u;
const verifiedReports=new WeakSet();
const verifiedRoots=new WeakMap();
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');

function create(options={}){
  const approvedBase=path.resolve(String(options.approvedBase||process.cwd()));
  const workspaceRoot=path.join(approvedBase,'studio-workspaces');
  const blocked=(reason,detail='')=>freeze({version:VERSION,mode:MODE,status:'PERSISTED_WORKSPACE_BLOCKED',reason,detail:String(detail),io:{filesystemRead:true,filesystemWrite:false,network:false,commands:false,render:false}});

  async function verify(report){
    if(!staticVerifier.isAuthenticReport(report)||report.status!=='STATIC_PREVIEW_READY')return blocked('AUTHENTIC_STATIC_REPORT_REQUIRED');
    if(!SLUG.test(String(report.projectSlug||'')))return blocked('PROJECT_SLUG_INVALID');
    const expected=new Map(report.manifest.map(item=>[item.path,item]));
    try{
      const rootStat=await fsp.lstat(workspaceRoot);
      if(rootStat.isSymbolicLink()||!rootStat.isDirectory())return blocked('WORKSPACE_ROOT_INVALID');
      if(path.resolve(await fsp.realpath(workspaceRoot))!==path.resolve(workspaceRoot))return blocked('WORKSPACE_ROOT_REDIRECTED');
      const projectRoot=path.join(workspaceRoot,report.projectSlug);
      const projectStat=await fsp.lstat(projectRoot);
      if(projectStat.isSymbolicLink()||!projectStat.isDirectory())return blocked('PROJECT_ROOT_INVALID');
      if(path.resolve(await fsp.realpath(projectRoot))!==path.resolve(projectRoot))return blocked('PROJECT_ROOT_REDIRECTED');

      const found=new Map();
      async function walk(directory){
        for(const entry of await fsp.readdir(directory,{withFileTypes:true})){
          const absolute=path.join(directory,entry.name),stat=await fsp.lstat(absolute);
          const relative=path.relative(projectRoot,absolute).split(path.sep).join('/');
          if(stat.isSymbolicLink())throw Object.assign(new Error(relative),{verificationCode:'SYMLINK_FORBIDDEN'});
          if(stat.isDirectory()){await walk(absolute);continue;}
          if(!stat.isFile())throw Object.assign(new Error(relative),{verificationCode:'SPECIAL_ENTRY_FORBIDDEN'});
          found.set(relative,absolute);
        }
      }
      await walk(projectRoot);
      const missing=[...expected.keys()].filter(item=>!found.has(item)).sort();
      if(missing.length)return blocked('EXPECTED_FILE_MISSING',missing.join(','));
      const extra=[...found.keys()].filter(item=>!expected.has(item)).sort();
      if(extra.length)return blocked('UNEXPECTED_FILE_PRESENT',extra.join(','));
      const files=[];
      for(const [relative,item] of [...expected.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
        const content=await fsp.readFile(found.get(relative));
        if(content.length!==item.bytes)return blocked('FILE_SIZE_MISMATCH',relative);
        if(sha256(content)!==item.sha256)return blocked('FILE_HASH_MISMATCH',relative);
        files.push(Object.freeze({path:relative,bytes:content.length,sha256:item.sha256}));
      }
      const result=freeze({version:VERSION,mode:MODE,status:'PERSISTED_WORKSPACE_VERIFIED',projectSlug:report.projectSlug,manifestHash:report.manifestHash,files:Object.freeze(files),io:{filesystemRead:true,filesystemWrite:false,network:false,commands:false,render:false},nextGate:'SCRIPTLESS_LOCAL_PREVIEW_PACKAGE'});
      verifiedReports.add(result);verifiedRoots.set(result,path.resolve(projectRoot));return result;
    }catch(error){
      if(error&&error.verificationCode)return blocked(error.verificationCode,error.message);
      if(error&&error.code==='ENOENT')return blocked('WORKSPACE_OR_PROJECT_MISSING');
      return blocked('FILESYSTEM_VERIFICATION_FAILED',error&&error.code?error.code:'UNKNOWN');
    }
  }
  return freeze({VERSION,MODE,workspaceRoot,verify});
}

const isAuthenticReport=value=>Boolean(value&&verifiedReports.has(value));
const isReportFor=(value,projectRoot)=>Boolean(value&&verifiedReports.has(value)&&verifiedRoots.get(value)===path.resolve(String(projectRoot||'')));
module.exports=freeze({VERSION,MODE,create,isAuthenticReport,isReportFor});
