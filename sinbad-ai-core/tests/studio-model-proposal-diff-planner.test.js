const test=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs').promises;
const os=require('node:os');
const path=require('node:path');
const compiler=require('../engines/studio/virtual-artifact-compiler.js');
const staticVerifier=require('../engines/studio/static-artifact-verifier.js');
const sandboxWriter=require('../engines/studio/sandbox-writer.js');
const persistedVerifier=require('../engines/studio/persisted-workspace-verifier.js');
const protocol=require('../engines/studio/local-model-protocol.js');
const gatewayModule=require('../engines/studio/local-model-loopback-gateway.js');
const modelValidator=require('../engines/studio/local-model-artifact-validator.js');
const plannerModule=require('../engines/studio/model-proposal-diff-planner.js');

async function fixture(t){
  const base=await fsp.mkdtemp(path.join(os.tmpdir(),'sinbad-pro-diff-'));t.after(()=>fsp.rm(base,{recursive:true,force:true}));
  const bundle=compiler.compile({instruction:'Web sayfası hazırla',projectName:'Review Demo',audience:'owner',acceptanceCriteria:'review'}),staticReport=staticVerifier.verify(bundle),writer=sandboxWriter.create({approvedBase:base,clock:()=>1000});
  await writer.persist(bundle,writer.authorize(bundle,{approvedBy:'owner-001',purpose:'source-001',nonce:'source-001',expiresAt:2000}));const report=await persistedVerifier.create({approvedBase:base}).verify(staticReport);
  const text=JSON.stringify({version:1,projectSlug:report.projectSlug,artifacts:[{path:'web/index.html',mediaType:'text/html; charset=utf-8',content:'<!doctype html><html><head></head><body><h1>Updated</h1></body></html>'},{path:'web/new.css',mediaType:'text/css; charset=utf-8',content:'body{color:white}\n'}]});
  const request=protocol.createRequest({endpoint:'http://127.0.0.1:11434/api/generate',model:'local',instruction:'proposal'}),gateway=gatewayModule.create({clock:()=>1000,transport:async()=>({statusCode:200,body:JSON.stringify({response:text})})}),draft=await gateway.send(request,gateway.authorize(request,{approvedBy:'owner-001',purpose:'model-001',nonce:'model-001',expiresAt:2000,timeoutMs:500}));
  return {base,report,proposal:modelValidator.validate(draft),project:path.join(base,'studio-workspaces',report.projectSlug)};
}

test('plans create update and preserve actions without writing or deleting',async t=>{const {base,report,proposal}=await fixture(t),result=await plannerModule.create({approvedBase:base}).plan(report,proposal);assert.equal(result.status,'MODEL_PROPOSAL_DIFF_READY');assert.deepEqual(result.summary,{create:1,update:1,unchanged:0,preserve:2,delete:0});assert.equal(result.deletionPolicy,'DENY');assert.deepEqual(result.io,{filesystemRead:true,filesystemWrite:false,network:false,commands:false});assert.equal(plannerModule.isAuthenticPlan(result),true);assert.equal(plannerModule.isAuthenticPlan({...result}),false);});
test('rejects copied trust objects and project mismatch',async t=>{const {base,report,proposal}=await fixture(t),planner=plannerModule.create({approvedBase:base});assert.equal((await planner.plan({...report},proposal)).reason,'AUTHENTIC_BOUND_WORKSPACE_REPORT_REQUIRED');assert.equal((await planner.plan(report,{...proposal})).reason,'AUTHENTIC_MODEL_PROPOSAL_REQUIRED');});
test('blocks changed missing and extra workspace files after verification',async t=>{for(const mode of ['changed','missing','extra']){const {base,report,proposal,project}=await fixture(t),target=path.join(project,...report.files[0].path.split('/'));if(mode==='changed')await fsp.writeFile(target,'tamper');if(mode==='missing')await fsp.rm(target);if(mode==='extra')await fsp.writeFile(path.join(project,'extra.txt'),'extra');const result=await plannerModule.create({approvedBase:base}).plan(report,proposal);assert.equal(result.reason,mode==='changed'?'WORKSPACE_FILE_CHANGED':mode==='missing'?'WORKSPACE_FILE_MISSING':'WORKSPACE_EXTRA_FILE');}});
test('planner exposes no patch writer deleter runner network or publisher',()=>{const planner=plannerModule.create();for(const field of ['apply','patch','write','remove','delete','run','execute','fetch','publish','deploy'])assert.equal(field in planner,false);});
