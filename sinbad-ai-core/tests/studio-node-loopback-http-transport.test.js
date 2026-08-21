const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const protocol=require('../engines/studio/local-model-protocol.js');
const gatewayModule=require('../engines/studio/local-model-loopback-gateway.js');
const transportModule=require('../engines/studio/node-loopback-http-transport.js');

async function server(t,handler){
  const instance=http.createServer(handler);await new Promise((resolve,reject)=>{instance.once('error',reject);instance.listen(0,'127.0.0.1',resolve);});
  t.after(()=>new Promise(resolve=>instance.close(resolve)));return `http://127.0.0.1:${instance.address().port}/api/generate`;
}
const input=(url,extra={})=>({url,method:'POST',headers:{'content-type':'application/json'},body:'{"model":"local","prompt":"draft"}',maxResponseBytes:1024,...extra});

test('performs a bounded POST only to a real loopback JSON server',async t=>{
  let received='';const url=await server(t,(request,response)=>{request.setEncoding('utf8');request.on('data',chunk=>{received+=chunk;});request.on('end',()=>{response.writeHead(200,{'content-type':'application/json; charset=utf-8'});response.end('{"response":"local draft"}');});});
  const result=await transportModule.create().transport(input(url));
  assert.equal(result.statusCode,200);assert.deepEqual(JSON.parse(result.body.toString('utf8')),{response:'local draft'});assert.match(received,/"model":"local"/u);
});

test('integrates with the one-shot gateway against a loopback server',async t=>{
  const url=await server(t,(_request,response)=>{response.writeHead(200,{'content-type':'application/json'});response.end('{"response":"untrusted local model draft"}');});
  const request=protocol.createRequest({endpoint:url,model:'local-coder',instruction:'draft'}),gateway=gatewayModule.create({clock:()=>1000,transport:transportModule.create().transport});
  const auth=gateway.authorize(request,{approvedBy:'owner-001',purpose:'local-model-001',nonce:'nonce-001',expiresAt:2000,timeoutMs:1000}),result=await gateway.send(request,auth);
  assert.equal(result.status,'LOCAL_MODEL_DRAFT_RECEIVED_UNTRUSTED');assert.equal(result.text,'untrusted local model draft');
});

test('rejects remote malformed oversized non-JSON and aborted requests',async t=>{
  const transport=transportModule.create().transport;
  await assert.rejects(transport(input('http://example.com:11434/api/generate')),/LOOPBACK/);
  await assert.rejects(transport({...input('http://127.0.0.1:1/api/generate'),method:'GET'}),/REQUEST_INVALID/);
  const textUrl=await server(t,(_request,response)=>{response.writeHead(200,{'content-type':'text/plain'});response.end('no');});await assert.rejects(transport(input(textUrl)),/CONTENT_TYPE_INVALID/);
  const largeUrl=await server(t,(_request,response)=>{response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify({response:'x'.repeat(2048)}));});await assert.rejects(transport(input(largeUrl,{maxResponseBytes:128})),/RESPONSE_TOO_LARGE/);
  const controller=new AbortController();controller.abort();await assert.rejects(transport(input(textUrl,{signal:controller.signal})),error=>error.name==='AbortError');
});

test('transport exposes no remote client shell installer downloader or publisher',()=>{
  const adapter=transportModule.create();for(const field of ['fetch','connectRemote','run','execute','spawn','install','download','publish','deploy'])assert.equal(field in adapter,false);
});
