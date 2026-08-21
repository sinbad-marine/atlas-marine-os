const test=require('node:test');
const assert=require('node:assert/strict');
const protocol=require('../engines/studio/local-model-protocol.js');
const gatewayModule=require('../engines/studio/local-model-loopback-gateway.js');

const request=()=>protocol.createRequest({endpoint:'http://127.0.0.1:11434/api/generate',model:'local-coder',instruction:'Web taslağı öner',context:'offline Studio'});
const approval={approvedBy:'owner-001',purpose:'local-draft-001',nonce:'model-nonce-001',expiresAt:2000,timeoutMs:500};

test('sends one explicitly authorized bounded loopback request through injected transport',async()=>{
  let captured;
  const gateway=gatewayModule.create({clock:()=>1000,transport:async input=>{captured=input;return {statusCode:200,body:JSON.stringify({response:'güvenilmeyen taslak'})};}}),draftRequest=request();
  const auth=gateway.authorize(draftRequest,approval),result=await gateway.send(draftRequest,auth);
  assert.equal(captured.url,'http://127.0.0.1:11434/api/generate');assert.equal(captured.method,'POST');assert.equal(captured.maxResponseBytes,gatewayModule.MAX_WIRE_BYTES);
  assert.equal(result.status,'LOCAL_MODEL_DRAFT_RECEIVED_UNTRUSTED');assert.equal(result.authority,'DATA_ONLY');
  assert.deepEqual(result.io,{performed:true,network:'LOOPBACK_ONLY',commands:false});
  await assert.rejects(gateway.send(draftRequest,auth),/NOT_AUTHORIZED/);
});

test('binds deterministic bounded JSON generation controls for artifact sessions',async()=>{
  let body;const gateway=gatewayModule.create({clock:()=>1000,transport:async input=>{body=JSON.parse(input.body);return {statusCode:200,body:'{"response":"{}"}'};}});
  const draftRequest=protocol.createRequest({endpoint:'http://127.0.0.1:11434/api/generate',model:'local-coder',instruction:'JSON',responseFormat:'json'}),auth=gateway.authorize(draftRequest,approval);await gateway.send(draftRequest,auth);
  assert.deepEqual({stream:body.stream,think:body.think,format:body.format,temperature:body.options.temperature,num_predict:body.options.num_predict},{stream:false,think:false,format:'json',temperature:0,num_predict:1024});
});

test('forwards a smaller authenticated output token budget to the local runtime',async()=>{
  let body;const gateway=gatewayModule.create({clock:()=>1000,transport:async input=>{body=JSON.parse(input.body);return {statusCode:200,body:'{"response":"draft"}'};}});
  const draftRequest=protocol.createRequest({endpoint:'http://127.0.0.1:11434/api/generate',model:'local-coder',instruction:'short draft',outputTokenLimit:256}),auth=gateway.authorize(draftRequest,approval);await gateway.send(draftRequest,auth);
  assert.equal(body.options.num_predict,256);
});

test('rejects copied requests forged grants cross-request replay and expired authorization',async()=>{
  const transport=async()=>({statusCode:200,body:'{"response":"draft"}'}),gateway=gatewayModule.create({clock:()=>1000,transport}),first=request(),second=request();
  assert.throws(()=>gateway.authorize({...first},approval),/authentic/);
  const auth=gateway.authorize(first,approval);
  await assert.rejects(gateway.send(second,auth),/NOT_AUTHORIZED/);await assert.rejects(gateway.send(first,{...auth}),/NOT_AUTHORIZED/);
  let now=1000;const late=gatewayModule.create({clock:()=>now,transport}),lateRequest=request(),expired=late.authorize(lateRequest,{...approval,expiresAt:1100});now=1100;
  await assert.rejects(late.send(lateRequest,expired),/EXPIRED/);
});

test('fails closed on timeout HTTP malformed JSON and oversized wire output',async()=>{
  const cases=[
    [()=>new Promise(()=>{}),/TIMEOUT/],
    [async()=>({statusCode:500,body:'{}'}),/HTTP_FAILURE/],
    [async()=>({statusCode:200,body:'not-json'}),/JSON_INVALID/],
    [async()=>({statusCode:200,body:'x'.repeat(gatewayModule.MAX_WIRE_BYTES+1)}),/TOO_LARGE/]
  ];
  for(const [index,[transport,pattern]] of cases.entries()){const gateway=gatewayModule.create({clock:()=>1000,transport}),draftRequest=request(),auth=gateway.authorize(draftRequest,{...approval,nonce:`nonce-${index}-case`,timeoutMs:100});await assert.rejects(gateway.send(draftRequest,auth),pattern);}
});

test('gateway has no built-in fetch shell installer downloader or publisher',async()=>{
  const gateway=gatewayModule.create({clock:()=>1000});
  for(const field of ['fetch','connect','run','execute','spawn','install','download','publish','deploy'])assert.equal(field in gateway,false);
  const draftRequest=request(),auth=gateway.authorize(draftRequest,approval);
  await assert.rejects(gateway.send(draftRequest,auth),/TRANSPORT_NOT_CONFIGURED/);
});
