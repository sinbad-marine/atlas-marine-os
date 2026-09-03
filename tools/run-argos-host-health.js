'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {observe,assess}=require('../sinbad-ai-core/argos-health-contracts');
const {probeReleaseEvidence}=require('./argos-release-evidence');
const {recordHealth}=require('./argos-record-health');
const root=path.resolve(__dirname,'..'),site='https://sinbad-marine.github.io/atlas-marine-os/',project='https://kcvyftrvteqmabvxfebu.supabase.co';
const publicKey='sb_publishable_ZBHFlbhQAnhUAOyVg20Szw_nW0QDj_l';
const sha=value=>crypto.createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
function observed(component,state,reasonCode,evidence){const now=new Date();return observe({component,state,reasonCode,observedAt:now.toISOString(),validUntil:new Date(+now+300000).toISOString(),evidenceHash:sha(evidence)});}
async function json(url,options={}){const r=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('HTTP_'+r.status);return r.json();}
function command(exe,args){return cp.execFileSync(exe,args,{cwd:root,windowsHide:true,timeout:15000,encoding:'utf8',maxBuffer:2*1024*1024});}
function git(...args){return command('git',args).trim();}
function verifyNativeIdentity(native,expected){
 if(native.status!=='ARGOS_HOST_IDENTITY_VERIFIED'||native.packageId!==expected||!Number.isSafeInteger(native.processId)||!Array.isArray(native.files)||native.files.length!==9)throw Error('NATIVE_IDENTITY_INVALID');
 const actual=sha(native.files.map(({path,sha256})=>({path,sha256})));
 if(actual!==expected)throw Error('NATIVE_PACKAGE_MANIFEST_MISMATCH');
 return native;
}
async function collect({ref,packageId}){
 if(!/^[a-f0-9]{40}$/.test(ref||'')||!/^[a-f0-9]{64}$/.test(packageId||''))throw Error('EXPECTED_RELEASE_AND_PACKAGE_REQUIRED');
 const details={},observations=[];
 async function probe(component,work){try{details[component]=await work();observations.push(observed(component,'HEALTHY',null,details[component]));}catch(error){details[component]={reason:String(error.message).replace(/[^A-Za-z0-9_ :.-]/g,'').slice(0,150)};observations.push(observed(component,'DEGRADED',component+'_FUNCTIONAL_CHECK_FAILED',details[component]));}}
 await Promise.all([
 probe('APPLICATION',async()=>{
  const manifest=await json(site+'release-manifest.json?argos='+Date.now());
  if(manifest.sourceCommit!==ref)throw Error('LIVE_RELEASE_MISMATCH');
  const files=['index.html','app.js','academy.html','founder-owner-ui.js'];
  for(const file of files){const r=await fetch(site+file+'?argos='+ref,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('APPLICATION_RESOURCE_UNAVAILABLE');const bytes=Buffer.from(await r.arrayBuffer());const committed=cp.execFileSync('git',['show',ref+':'+file],{cwd:root,windowsHide:true,timeout:5000,maxBuffer:5*1024*1024});if(sha(bytes)!==sha(committed))throw Error('APPLICATION_SOURCE_MISMATCH');}
  return {sourceCommit:ref,files,scope:'Live dashboard and Academy source delivery; functional rendering covered by exact-release browser suite'};
 }),
 probe('BRIDGE',async()=>{
  const readIdentity=()=>verifyNativeIdentity(JSON.parse(command('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'argos-host-identity.ps1'),'-ExpectedPackageId',packageId])),packageId);
  const before=readIdentity(),status=await json('http://127.0.0.1:31983/argos/status');
  if(status.version!=='sinbad-argos-live-status/1-v1'||!status.ownerBoundary?.enforced||!status.ownerBoundary?.configured||!status.commandGate?.replayProtection)throw Error('BRIDGE_PROTECTION_INACTIVE');
  const checks=[];
  for(const [target,action] of [['/routes','ROUTE_WRITE'],['/routes/open','PHYSICAL_HANDOFF'],['/library/ingest','LIBRARY_WRITE'],['/library/reindex','LIBRARY_INDEX_WRITE'],['/opencpn/start','PHYSICAL_HANDOFF'],['/opencpn/input','PHYSICAL_HANDOFF']]){
   const r=await fetch('http://127.0.0.1:31983'+target,{method:'POST',headers:{'Content-Type':'application/json','X-Sinbad-Argos-Version':'sinbad-argos-command/1-v1','X-Sinbad-Argos-Action':action,'X-Sinbad-Argos-Target':target,'X-Sinbad-Argos-Command-Id':'browser-'+crypto.randomUUID(),'X-Sinbad-Argos-Requested-At':new Date().toISOString()},body:'{}',signal:AbortSignal.timeout(5000)});
   const b=await r.json();if(r.status!==403||b.error!=='BRIDGE_OWNER_BLOCKED'||b.reason!=='BRIDGE_OWNER_PROOF_REQUIRED')throw Error('BRIDGE_OWNER_DENIAL_FAILED');checks.push({target,status:r.status});
  }
  const after=readIdentity();if(after.processId!==before.processId||after.startedAt!==before.startedAt)throw Error('BRIDGE_CHANGED_DURING_PROBE');
  return {packageId,sourceCommit:before.sourceCommit,processId:before.processId,startedAt:before.startedAt,parentName:before.parentName,checks,scope:'OS listener, pinned package bytes and six Owner denials; physical operations are not exercised'};
 }),
 probe('LOCAL_MODEL',async()=>{
  const model='qwen3:14b',tags=await json('http://127.0.0.1:11434/api/tags');if(!tags.models?.some(x=>x.name===model))throw Error('LOCAL_MODEL_NOT_INSTALLED');
  const result=await json('http://127.0.0.1:11434/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,prompt:'Return JSON with ready set to true.',format:{type:'object',properties:{ready:{type:'boolean'}},required:['ready'],additionalProperties:false},think:false,stream:false,options:{temperature:0,num_predict:64}})});
  if(result.done!==true||result.done_reason!=='stop'||JSON.parse(result.response).ready!==true)throw Error('LOCAL_MODEL_INFERENCE_FAILED');return {model,challengePassed:true,scope:'Actual completed structured generation on the configured model; not maritime answer-quality certification'};
 }),
 probe('SUPABASE',async()=>{
  const health=await json(project+'/auth/v1/health',{headers:{apikey:publicKey}});if(!health.version&&!health.name)throw Error('AUTH_HEALTH_RESPONSE_INVALID');
  const r=await fetch(project+'/functions/v1/founder-owner-step-up',{method:'POST',headers:{apikey:publicKey,'Content-Type':'application/json'},body:'{}',redirect:'error',signal:AbortSignal.timeout(10000)});if(r.status!==401)throw Error('UNAUTHENTICATED_OWNER_REQUEST_NOT_DENIED');return {authReachable:true,anonymousOwnerStatus:401,scope:'Auth service and Owner endpoint boundary; production MFA acceptance is recorded separately'};
 }),
 probe('GITHUB',async()=>{
  const result=JSON.parse(command('gh',['api','repos/sinbad-marine/atlas-marine-os/commits/main']));if(result.sha!==ref)throw Error('REMOTE_MAIN_CHANGED');return {sourceCommit:ref,scope:'Authenticated repository API and current main identity; checks are assessed separately'};
 })
 ]);
 const githubFetch=async url=>{if(!url.startsWith('https://api.github.com/repos/sinbad-marine/atlas-marine-os/actions/'))throw Error('GITHUB_TARGET_BLOCKED');const body=JSON.parse(command('gh',['api',url.slice('https://api.github.com/'.length)]));return {ok:true,status:200,json:async()=>body};};
 observations.push(...await probeReleaseEvidence({owner:'sinbad-marine',repo:'atlas-marine-os',ref,root,fetcher:githubFetch}));
 const now=new Date().toISOString(),assessment=assess(observations,now);
 return {schemaVersion:'sinbad-argos-host-health/1',checkedAt:now,expectedRelease:ref,expectedBridgePackage:packageId,scope:'Bounded operational checks on this Windows host; not a global capability or durability guarantee',assessment,observations,details};
}
if(require.main===module){const [ref,packageId,destination]=process.argv.slice(2);collect({ref,packageId}).then(report=>{if(!destination)throw Error('OUTPUT_FILE_REQUIRED');fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n',{flag:'wx'});recordHealth({root:path.join(root,'.argos-runtime','host-health'),observations:report.observations,now:report.checkedAt});console.log(JSON.stringify({status:report.assessment.status,components:report.assessment.components,output:path.resolve(destination)}));if(report.assessment.status!=='ARGOS_SYSTEM_HEALTHY')process.exitCode=1;}).catch(error=>{console.error('HOST_ASSURANCE_FAILED: '+error.message);process.exitCode=1;});}
module.exports={collect,verifyNativeIdentity};
