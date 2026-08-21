const test=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs').promises;
const os=require('node:os');
const path=require('node:path');
const protocol=require('../engines/studio/local-model-protocol.js');
const gatewayModule=require('../engines/studio/local-model-loopback-gateway.js');
const validator=require('../engines/studio/local-model-artifact-validator.js');
const writerModule=require('../engines/studio/local-model-proposal-writer.js');

async function fixture(t){
  const base=await fsp.mkdtemp(path.join(os.tmpdir(),'sinbad-model-proposal-'));t.after(()=>fsp.rm(base,{recursive:true,force:true}));
  const text=JSON.stringify({version:1,projectSlug:'model-proposal',artifacts:[{path:'web/index.html',mediaType:'text/html; charset=utf-8',content:'<!doctype html><html><head></head><body>Proposal</body></html>'}]});
  const request=protocol.createRequest({endpoint:'http://127.0.0.1:11434/api/generate',model:'local-coder',instruction:'proposal'}),gateway=gatewayModule.create({clock:()=>1000,transport:async()=>({statusCode:200,body:JSON.stringify({response:text})})});
  const draft=await gateway.send(request,gateway.authorize(request,{approvedBy:'owner-001',purpose:'proposal-001',nonce:'model-001',expiresAt:2000,timeoutMs:500}));
  return {base,proposal:validator.validate(draft)};
}
const approval={approvedBy:'owner-001',purpose:'persist-proposal-001',nonce:'persist-001',expiresAt:2000};

test('atomically writes one isolated untrusted model proposal with evidence',async t=>{
  const {base,proposal}=await fixture(t),writer=writerModule.create({approvedBase:base,clock:()=>1000}),auth=writer.authorize(proposal,approval),result=await writer.persist(proposal,auth);
  assert.equal(result.status,'LOCAL_MODEL_PROPOSAL_CREATED_UNTRUSTED');assert.equal(result.proposal,'studio-proposals/model-proposal');assert.equal(result.authority,'DATA_ONLY');
  assert.deepEqual({executed:result.executed,opened:result.opened,published:result.published,overwritten:result.overwritten},{executed:false,opened:false,published:false,overwritten:false});
  const evidence=JSON.parse(await fsp.readFile(path.join(base,'studio-proposals','model-proposal','PROPOSAL_EVIDENCE.json'),'utf8'));assert.equal(evidence.executionAllowed,false);assert.equal(evidence.publishAllowed,false);
  await assert.rejects(writer.persist(proposal,auth),/NOT_AUTHORIZED/);
});

test('rejects copied proposals forged grants expiry and cross-proposal replay',async t=>{
  const {base,proposal}=await fixture(t),writer=writerModule.create({approvedBase:base,clock:()=>1000});
  assert.throws(()=>writer.authorize({...proposal},approval),/authentic/);const auth=writer.authorize(proposal,approval);
  await assert.rejects(writer.persist({...proposal},auth),/NOT_AUTHORIZED/);await assert.rejects(writer.persist(proposal,{...auth}),/NOT_AUTHORIZED/);
  let now=1000;const late=writerModule.create({approvedBase:path.join(base,'late'),clock:()=>now}),expired=late.authorize(proposal,{...approval,expiresAt:1100,nonce:'persist-002'});now=1100;
  await assert.rejects(late.persist(proposal,expired),/EXPIRED/);
});

test('refuses overwrite and concurrent creation permits exactly one winner',async t=>{
  const {base,proposal}=await fixture(t),a=writerModule.create({approvedBase:base,clock:()=>1000}),b=writerModule.create({approvedBase:base,clock:()=>1000});
  const first=a.authorize(proposal,approval),second=b.authorize(proposal,{...approval,nonce:'persist-002',purpose:'persist-proposal-002'}),results=await Promise.allSettled([a.persist(proposal,first),b.persist(proposal,second)]);
  assert.equal(results.filter(item=>item.status==='fulfilled').length,1);assert.equal(results.filter(item=>item.status==='rejected').length,1);
});

test('rejects redirected root and exposes no runner opener network or publisher',async t=>{
  const {base,proposal}=await fixture(t),outside=await fsp.mkdtemp(path.join(os.tmpdir(),'sinbad-proposal-outside-'));t.after(()=>fsp.rm(outside,{recursive:true,force:true}));
  const writer=writerModule.create({approvedBase:base,clock:()=>1000});
  try{await fsp.symlink(outside,path.join(base,'studio-proposals'),process.platform==='win32'?'junction':'dir');}catch(error){if(['EPERM','EACCES','UNKNOWN'].includes(error.code))return t.skip('symlink creation unavailable');throw error;}
  await assert.rejects(writer.persist(proposal,writer.authorize(proposal,approval)),/ROOT_INVALID/);
  for(const field of ['run','execute','open','fetch','connect','publish','deploy','overwrite'])assert.equal(field in writer,false);
});
