const test=require('node:test');
const assert=require('node:assert/strict');
const protocol=require('../engines/studio/local-model-protocol.js');

test('builds a bounded immutable loopback-only request without I/O',()=>{
  const request=protocol.createRequest({endpoint:'http://127.0.0.1:11434/api/generate',model:'qwen2.5-coder:7b',instruction:'Yerel bir web taslağı öner.',context:'Studio sandbox'});
  assert.equal(request.status,'LOCAL_MODEL_REQUEST_READY');assert.equal(request.endpoint,'http://127.0.0.1:11434/api/generate');
  assert.deepEqual(request.io,{performed:false,network:false,commands:false});assert.equal(Object.isFrozen(request),true);
});

test('rejects remote credentialed unbounded and unsupported endpoints',()=>{
  for(const endpoint of ['https://127.0.0.1:11434/api/generate','http://example.com:11434/api/generate','http://user:pass@localhost:11434/api/generate','http://localhost:11434/private','http://localhost/api/generate','file:///tmp/model'])assert.throws(()=>protocol.validateEndpoint(endpoint));
  assert.equal(protocol.validateEndpoint('http://[::1]:11434/v1/chat/completions'),'http://[::1]:11434/v1/chat/completions');
});

test('normalizes supported provider shapes as untrusted data-only drafts',()=>{
  const request=protocol.createRequest({endpoint:'http://localhost:11434/v1/chat/completions',model:'local-coder',instruction:'Program öner'});
  for(const payload of [{response:'taslak'},{output_text:'taslak'},{choices:[{message:{content:'taslak'}}]}]){
    const result=protocol.parseResponse(request,payload);
    assert.equal(result.status,'LOCAL_MODEL_DRAFT_UNTRUSTED');assert.equal(result.authority,'DATA_ONLY');assert.equal(result.text,'taslak');
    assert.deepEqual(result.claims,{executed:false,published:false,networkVerified:false,coreModified:false,approved:false});
  }
});

test('fails closed on malformed empty controlled and oversized model output',()=>{
  const request=protocol.createRequest({endpoint:'http://localhost:11434/v1/responses',model:'local-coder',instruction:'Taslak'});
  for(const payload of [null,{},[],{response:''},{response:'bad\u0000text'}])assert.throws(()=>protocol.parseResponse(request,payload));
  assert.throws(()=>protocol.parseResponse(request,{response:'x'.repeat(protocol.MAX_RESPONSE_BYTES+1)}),/TOO_LARGE/);
});

test('rejects invalid model IDs empty prompts and oversized prompt inputs',()=>{
  assert.throws(()=>protocol.createRequest({endpoint:'http://localhost:11434/api/generate',model:'../ bad',instruction:'x'}),/MODEL_ID/);
  assert.throws(()=>protocol.createRequest({endpoint:'http://localhost:11434/api/generate',model:'local',instruction:''}),/INSTRUCTION/);
  assert.throws(()=>protocol.createRequest({endpoint:'http://localhost:11434/api/generate',model:'local',instruction:'x'.repeat(protocol.MAX_PROMPT_BYTES+1)}),/TOO_LARGE/);
  assert.throws(()=>protocol.createRequest({endpoint:'http://localhost:11434/api/generate',model:'local',instruction:'x',responseFormat:'xml'}),/RESPONSE_FORMAT/);
});

test('protocol exposes no transport shell model installer or downloader',()=>{
  for(const field of ['fetch','connect','send','run','execute','install','download','spawn'])assert.equal(field in protocol,false);
});

test('copied or merely frozen request shapes cannot cross the response trust boundary',()=>{
  const request=protocol.createRequest({endpoint:'http://localhost:11434/api/generate',model:'local',instruction:'Taslak'});
  assert.equal(protocol.isAuthenticRequest(request),true);assert.equal(protocol.isAuthenticRequest({...request}),false);
  assert.throws(()=>protocol.parseResponse(Object.freeze({...request}),{response:'taslak'}),/AUTHENTIC_REQUEST/);
});
