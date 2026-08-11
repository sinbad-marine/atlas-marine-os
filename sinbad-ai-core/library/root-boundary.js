'use strict';
const fs=require('node:fs');const fsp=require('node:fs/promises');const path=require('node:path');const contracts=require('./contracts.js');
function windowsUnsafe(value){return /^\\\\|^\\[?.]\\|^[a-z]:.*:/iu.test(value)||value.includes('\0');}
function lifecycle(input){const value=input==null?{}:input;if(!value||typeof value!=='object'||Array.isArray(value))contracts.fail(contracts.STATES.LIBRARY_ROOT_INVALID,'lifecycle must be an object');const allowed=new Set(['afterInitialStat','afterReadBeforeFinalStat']);for(const [key,hook] of Object.entries(value)){if(!allowed.has(key))contracts.fail(contracts.STATES.LIBRARY_ROOT_INVALID,`unknown lifecycle hook: ${key}`);if(typeof hook!=='function')contracts.fail(contracts.STATES.LIBRARY_ROOT_INVALID,`lifecycle hook must be a function: ${key}`);}return Object.freeze({...value});}
async function create(input={}){
  const hooks=lifecycle(input.lifecycle);const requested=String(input.root||'');
  if(!path.isAbsolute(requested)||windowsUnsafe(requested))contracts.fail(contracts.STATES.LIBRARY_ROOT_INVALID,'approved root must be a local absolute path');
  const root=await fsp.realpath(requested);const stat=await fsp.lstat(root);
  if(!stat.isDirectory()||stat.isSymbolicLink())contracts.fail(contracts.STATES.LIBRARY_ROOT_INVALID,'approved root must be a real directory');
  async function resolve(relative){if(typeof relative!=='string'||path.isAbsolute(relative)||relative.split(/[\\/]+/).includes('..')||windowsUnsafe(relative))contracts.fail(contracts.STATES.ROOT_ESCAPE_BLOCKED,'unsafe relative path');const joined=path.resolve(root,relative);const rel=path.relative(root,joined);if(rel.startsWith('..')||path.isAbsolute(rel))contracts.fail(contracts.STATES.ROOT_ESCAPE_BLOCKED,'path escapes approved root');let cursor=root;for(const part of rel.split(path.sep).filter(Boolean)){cursor=path.join(cursor,part);const s=await fsp.lstat(cursor);if(s.isSymbolicLink())contracts.fail(contracts.STATES.REPARSE_POINT_REJECTED,'symbolic link or junction rejected',{path:relative});}const real=await fsp.realpath(joined);const realRel=path.relative(root,real);if(realRel.startsWith('..')||path.isAbsolute(realRel))contracts.fail(contracts.STATES.ROOT_ESCAPE_BLOCKED,'canonical path escapes approved root');return real;}
  async function read(relative,limits={}){const resolved=await resolve(relative);const handle=await fsp.open(resolved,fs.constants.O_RDONLY);try{const before=await handle.stat({bigint:true});if(!before.isFile())contracts.fail(contracts.STATES.MALFORMED_TEXT,'regular file required');if(before.size>BigInt(limits.maxFileBytes||contracts.LIMITS.maxFileBytes))contracts.fail(contracts.STATES.FILE_TOO_LARGE,'file exceeds limit');if(hooks.afterInitialStat)await hooks.afterInitialStat();const bytes=await handle.readFile();if(hooks.afterReadBeforeFinalStat)await hooks.afterReadBeforeFinalStat();const after=await handle.stat({bigint:true});if(before.size!==after.size||before.mtimeNs!==after.mtimeNs||before.ctimeNs!==after.ctimeNs||before.ino!==after.ino)contracts.fail(contracts.STATES.HASH_MISMATCH,'file changed during read',{dimension:'RAW_HASH'});return Object.freeze({resolved,bytes,stat:after});}finally{await handle.close();}}
  return Object.freeze({root,resolve,read});
}
function depth(relative){return String(relative).split(/[\\/]+/).filter(Boolean).length;}
async function createEnforced(input={}){
  const boundary=await create(input);
  function check(relative){
    if(String(relative).includes(':'))contracts.fail(contracts.STATES.ROOT_ESCAPE_BLOCKED,'alternate data streams are not allowed');
    const directoryDepth=Math.max(0,depth(relative)-1);
    if(directoryDepth>contracts.LIMITS.maxDepth)contracts.fail(contracts.STATES.ROOT_ESCAPE_BLOCKED,'path exceeds approved traversal depth',{depth:directoryDepth,limit:contracts.LIMITS.maxDepth});
  }
  return Object.freeze({root:boundary.root,async resolve(relative){check(relative);return boundary.resolve(relative);},async read(relative,limits){check(relative);return boundary.read(relative,limits);}});
}
module.exports=Object.freeze({create:createEnforced});
