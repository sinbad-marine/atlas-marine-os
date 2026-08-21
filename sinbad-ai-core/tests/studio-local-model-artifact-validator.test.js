const test=require('node:test');
const assert=require('node:assert/strict');
const protocol=require('../engines/studio/local-model-protocol.js');
const gatewayModule=require('../engines/studio/local-model-loopback-gateway.js');
const validator=require('../engines/studio/local-model-artifact-validator.js');

const proposal=overrides=>JSON.stringify({version:1,projectSlug:'model-demo',artifacts:[{path:'web/index.html',mediaType:'text/html; charset=utf-8',content:'<!doctype html><html><head></head><body><h1>Yerel</h1></body></html>'}],...overrides});
async function draft(text){
  const request=protocol.createRequest({endpoint:'http://127.0.0.1:11434/api/generate',model:'local-coder',instruction:'JSON dosya önerisi üret'});
  const gateway=gatewayModule.create({clock:()=>1000,transport:async()=>({statusCode:200,body:JSON.stringify({response:text})})});
  const auth=gateway.authorize(request,{approvedBy:'owner-001',purpose:'proposal-001',nonce:'nonce-001',expiresAt:2000,timeoutMs:500});
  return gateway.send(request,auth);
}

test('validates a strict bounded model proposal without writing or executing it',async()=>{
  const result=validator.validate(await draft(proposal()));
  assert.equal(result.status,'LOCAL_MODEL_ARTIFACT_PROPOSAL_VERIFIED_UNTRUSTED');assert.equal(result.authority,'DATA_ONLY');
  assert.match(result.manifestHash,/^[a-f0-9]{64}$/u);assert.deepEqual(result.io,{filesystem:false,network:false,commands:false,render:false});
  assert.equal(validator.isAuthenticProposal(result),true);assert.equal(validator.isAuthenticProposal({...result}),false);
});

test('rejects copied drafts non-JSON markdown fences and unknown schema fields',async()=>{
  const authentic=await draft(proposal());assert.equal(validator.validate({...authentic}).reason,'AUTHENTIC_LOCAL_MODEL_DRAFT_REQUIRED');
  assert.equal(validator.validate(await draft('```json\n{}\n```')).reason,'ARTIFACT_PROPOSAL_JSON_INVALID');
  assert.equal(validator.validate(await draft(JSON.stringify({version:1,projectSlug:'x',artifacts:[],extra:true}))).reason,'ARTIFACT_PROPOSAL_SCHEMA_INVALID');
});

test('rejects traversal absolute duplicate malformed and oversized artifacts',async()=>{
  const base={mediaType:'text/html; charset=utf-8',content:'<p>x</p>'};
  const cases=[
    [{...base,path:'../escape.html'},'ARTIFACT_PATH_INVALID'],
    [{...base,path:'C:/escape.html'},'ARTIFACT_PATH_INVALID'],
    [[{...base,path:'web/a.html'},{...base,path:'web/a.html'}],'ARTIFACT_PATH_INVALID'],
    [{path:'web/a.html',mediaType:'text/html; charset=utf-8',content:'x',extra:true},'ARTIFACT_SCHEMA_INVALID'],
    [{...base,path:'web/a.html',content:'x'.repeat(validator.MAX_TOTAL_BYTES+1)},'ARTIFACT_BYTES_EXCEEDED']
  ];
  for(const [input,reason] of cases){const artifacts=Array.isArray(input)?input:[input],result=validator.validate(await draft(proposal({artifacts})));assert.equal(result.reason,reason);}
});

test('reuses static policy to block network command active markup and invalid media',async()=>{
  const samples=[
    {path:'web/index.html',mediaType:'text/html; charset=utf-8',content:'<iframe src="x"></iframe>'},
    {path:'software/run.js',mediaType:'text/javascript; charset=utf-8',content:"require('node:child_process')"},
    {path:'web/app.js',mediaType:'text/javascript; charset=utf-8',content:"fetch('https://evil.test')"},
    {path:'animation/a.svg',mediaType:'text/plain',content:'<svg></svg>'}
  ];
  for(const artifact of samples){const result=validator.validate(await draft(proposal({artifacts:[artifact]})));assert.equal(result.reason,'STATIC_POLICY_VIOLATION');assert.ok(result.issues.length>0);}
});

test('validator exposes no writer runner transport or publisher',()=>{
  for(const field of ['write','persist','send','fetch','run','execute','publish','deploy'])assert.equal(field in validator,false);
});
