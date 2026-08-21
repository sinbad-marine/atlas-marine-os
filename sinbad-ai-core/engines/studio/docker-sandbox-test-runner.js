'use strict';
const crypto=require('node:crypto');
const fsp=require('node:fs').promises;
const path=require('node:path');
const persistedVerifier=require('./persisted-workspace-verifier.js');

const VERSION='0.4.0',MODE='DOCKER_SANDBOX_TEST_ONLY',MAX_TTL_MS=5*60*1000;
const IMAGE='node@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32';
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u;
const launchRequests=new WeakSet();
const authenticResults=new WeakSet();
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');

function create(options={}){
  const approvedBase=path.resolve(String(options.approvedBase||process.cwd()));
  const workspaceRoot=path.join(approvedBase,'studio-workspaces');
  const clock=typeof options.clock==='function'?options.clock:Date.now;
  const launch=typeof options.launch==='function'?options.launch:null;
  const timeoutMs=Math.max(10,Math.min(30000,Number(options.timeoutMs)||30000));
  const maxOutputBytes=Math.max(1024,Math.min(131072,Number(options.maxOutputBytes)||131072));
  const grants=new WeakMap(),grantObjects=new WeakSet();

  function authorize(report,input={}){
    const projectRoot=path.join(workspaceRoot,String(report&&report.projectSlug||''));
    if(!persistedVerifier.isReportFor(report,projectRoot))throw new TypeError('authentic persisted workspace report required');
    const tests=report.files.filter(item=>/^software\/tests\/[A-Za-z0-9._-]+\.test\.js$/u.test(item.path)).map(item=>item.path);
    if(!tests.length)throw new Error('VERIFIED_SOFTWARE_TEST_REQUIRED');
    const approvedBy=String(input.approvedBy||''),purpose=String(input.purpose||''),nonce=String(input.nonce||'');
    if(!ID.test(approvedBy)||!ID.test(purpose)||!ID.test(nonce))throw new TypeError('bounded approval identity purpose and nonce are required');
    const now=Number(clock()),expiresAt=Number(input.expiresAt);
    if(!Number.isFinite(expiresAt)||expiresAt<=now||expiresAt>now+MAX_TTL_MS)throw new RangeError('sandbox test approval expiry is invalid');
    const authorization=freeze({version:VERSION,mode:MODE,approvedBy,purpose,nonce,projectSlug:report.projectSlug,manifestHash:report.manifestHash,expiresAt,scope:'VERIFIED_SOFTWARE_TESTS_ONLY'});
    grants.set(authorization,{report,projectRoot,tests:Object.freeze([...tests].sort()),consumed:false});grantObjects.add(authorization);return authorization;
  }

  async function revalidate(grant){
    const expected=new Map(grant.report.files.map(item=>[item.path,item])),found=[];
    async function walk(directory){for(const entry of await fsp.readdir(directory,{withFileTypes:true})){const absolute=path.join(directory,entry.name),stat=await fsp.lstat(absolute),relative=path.relative(grant.projectRoot,absolute).split(path.sep).join('/');if(stat.isSymbolicLink()||(!stat.isDirectory()&&!stat.isFile()))throw new Error('SANDBOX_SOURCE_ENTRY_INVALID');if(stat.isDirectory())await walk(absolute);else found.push(relative);}}
    await walk(grant.projectRoot);
    if(found.length!==expected.size||found.some(item=>!expected.has(item)))throw new Error('SANDBOX_SOURCE_FILESET_CHANGED');
    for(const [relative,item] of expected){const bytes=await fsp.readFile(path.join(grant.projectRoot,...relative.split('/')));if(bytes.length!==item.bytes||sha256(bytes)!==item.sha256)throw new Error('SANDBOX_SOURCE_HASH_CHANGED');}
  }

  async function run(report,authorization){
    const grant=authorization&&grantObjects.has(authorization)?grants.get(authorization):null;
    if(!grant||grant.report!==report||grant.consumed)throw new Error('SANDBOX_TEST_NOT_AUTHORIZED');
    grant.consumed=true;
    if(Number(clock())>=authorization.expiresAt)throw new Error('SANDBOX_TEST_AUTHORIZATION_EXPIRED');
    if(!launch)throw new Error('DOCKER_SANDBOX_LAUNCHER_NOT_CONFIGURED');
    await revalidate(grant);
    const containerName=`sinbad-studio-${sha256(Buffer.from(authorization.nonce)).slice(0,16)}`;
    const args=Object.freeze(['run','--rm','--name',containerName,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','64','--memory','256m','--cpus','1','--user','65532:65532','--tmpfs','/tmp:rw,noexec,nosuid,size=32m','--mount',`type=bind,source=${grant.projectRoot},target=/workspace,readonly`,'--workdir','/workspace',IMAGE,'node','--test',...grant.tests]);
    const launchRequest=freeze({version:VERSION,mode:MODE,args,containerName,timeoutMs,maxOutputBytes});launchRequests.add(launchRequest);
    const outcome=await launch(launchRequest);
    const exitCode=Number(outcome&&outcome.exitCode),timedOut=Boolean(outcome&&outcome.timedOut),output=Buffer.from(String(outcome&&outcome.output||''),'utf8').subarray(0,maxOutputBytes).toString('utf8');
    const result=freeze({version:VERSION,mode:MODE,status:!timedOut&&exitCode===0?'SANDBOX_TESTS_PASSED':'SANDBOX_TESTS_FAILED',projectSlug:report.projectSlug,manifestHash:report.manifestHash,image:IMAGE,tests:grant.tests,exitCode:Number.isInteger(exitCode)?exitCode:null,timedOut,output,policy:{network:'NONE',rootFilesystem:'READ_ONLY',hostMount:'READ_ONLY',capabilities:'DROP_ALL',privilegeEscalation:'DENY',user:'65532:65532',memory:'256m',cpus:1,pids:64},writes:{host:false,core:false,production:false},publishPerformed:false});authenticResults.add(result);return result;
  }
  return freeze({VERSION,MODE,IMAGE,authorize,run});
}
const isAuthenticLaunchRequest=value=>Boolean(value&&launchRequests.has(value));
const isAuthenticResult=value=>Boolean(value&&authenticResults.has(value));
module.exports=freeze({VERSION,MODE,IMAGE,MAX_TTL_MS,create,isAuthenticLaunchRequest,isAuthenticResult});
