'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const http=require('node:http');
const net=require('node:net');
const {spawn}=require('node:child_process');

test('isolated HTTP parser and gate deny invalid requests before stubbed effects', {skip:process.platform!=='win32',timeout:70000},async t=>{
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve('tests/fixtures/argos-http-isolation.ps1'),'-Source',path.resolve('bridge/sinbad-bridge.ps1')],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  t.after(()=>{if(child.exitCode===null)child.kill();});
  let stderr='';child.stderr.on('data',b=>{stderr=(stderr+b).slice(-8000);});
  const port=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Isolation server timeout: '+stderr)),15000);
    let output='';
    child.once('error',e=>{clearTimeout(timer);reject(e);});
    child.once('exit',()=>{clearTimeout(timer);reject(Error('Isolation server exited: '+stderr));});
    child.stdout.on('data',b=>{output+=b;const match=output.match(/ARGOS_TEST_PORT=(\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});
  });
  assert.ok(port>0&&port!==31983);
  const request=(method,url,headers={})=>new Promise((resolve,reject)=>{
    const req=http.request({host:'127.0.0.1',port,path:url,method,headers:{'Content-Length':'0',...headers},agent:false},res=>{
      let body='';res.on('data',b=>{body+=b;});res.on('end',()=>resolve({status:res.statusCode,body:body?JSON.parse(body):null}));
    });
    req.setTimeout(5000,()=>req.destroy(Error('HTTP test timeout')));req.on('error',reject);req.end();
  });
  const envelope=(id='argos-http-positive-0001')=>({'X-Sinbad-Argos-Version':'sinbad-argos-command/1-v1','X-Sinbad-Argos-Action':'AI_INFERENCE','X-Sinbad-Argos-Target':'/ai/chat','X-Sinbad-Argos-Command-Id':id,'X-Sinbad-Argos-Requested-At':new Date().toISOString()});
  const status=await request('GET','/argos/status');
  assert.equal(status.status,200);assert.equal(status.body.commandGate.observedCommands,0);
  assert.equal(status.body.ai.model,'ISOLATED_TEST');
  for(const [route,length,code] of [['/ai/chat','2147483648',400],['/ai/chat','-1',400],['/ai/chat','2097153',413],['/ai/tts','8193',413],['/library/ingest','8388609',413]]){
    const response=await request('POST',route,{'Content-Length':length});assert.equal(response.status,code);
  }
  // No body is sent: rejection must occur before blocking on a claimed body.
  assert.equal((await request('POST','/ai/chat',{'Content-Length':'1024'})).status,403);
  for(const route of ['/ai/chat','/ai/tts','/visuals/search','/library/ingest','/library/reindex','/routes','/routes/open']){
    const result=await request('POST',route);assert.equal(result.status,403);assert.equal(result.body.reason,'ARGOS_COMMAND_BINDING_INVALID');
  }
  const cases=[
    ['/unknown',envelope(),'ARGOS_TARGET_NOT_REGISTERED'],
    ['/routes',envelope(),'ARGOS_COMMAND_BINDING_INVALID'],
    ['/ai/chat',{...envelope(),'X-Sinbad-Argos-Command-Id':'bad'},'ARGOS_COMMAND_ID_INVALID'],
    ['/ai/chat',{...envelope(),'X-Sinbad-Argos-Requested-At':'bad'},'ARGOS_COMMAND_TIME_INVALID'],
    ['/ai/chat',{...envelope(),'X-Sinbad-Argos-Requested-At':new Date(Date.now()-600000).toISOString()},'ARGOS_COMMAND_TIME_STALE']
  ];
  for(const [route,headers,reason] of cases){const r=await request('POST',route,headers);assert.equal(r.status,403);assert.equal(r.body.reason,reason);}
  assert.equal((await request('POST','/ai/chat',{...envelope(),Origin:'https://untrusted.invalid'})).status,403);
  const valid=envelope();
  assert.deepEqual((await request('POST','/ai/chat',valid)).body,{sentinel:1});
  const replay=await request('POST','/ai/chat',valid);assert.equal(replay.status,403);assert.equal(replay.body.reason,'ARGOS_COMMAND_REPLAYED');
  assert.deepEqual((await request('POST','/ai/chat',envelope('argos-http-positive-0002'))).body,{sentinel:2});
  assert.equal((await request('GET','/argos/status')).body.commandGate.observedCommands,2);
  const rawRequest=(lines,terminator='\r\n\r\n')=>new Promise((resolve,reject)=>{
    const socket=net.createConnection({host:'127.0.0.1',port,allowHalfOpen:true});let response='';
    socket.setTimeout(5000,()=>socket.destroy(Error('Raw request timeout')));
    socket.on('error',reject);socket.on('data',b=>{response+=b;});
    socket.on('end',()=>{socket.destroy();resolve(response);});
    socket.on('connect',()=>socket.end(lines.join('\r\n')+terminator));
  });
  const partialHeader=await rawRequest(['GET /argos/status HTTP/1.1','Host: localhost'],'\r\n');
  assert.match(partialHeader,/BRIDGE_HEADERS_INCOMPLETE/);
  const invalidLine=await rawRequest(['GET','Host: localhost']);
  assert.match(invalidLine,/BRIDGE_REQUEST_LINE_INVALID/);
  const chunked=await rawRequest(['POST /ai/chat HTTP/1.1','Host: localhost','Transfer-Encoding: chunked']);
  assert.match(chunked,/HTTP\/1.1 400/);assert.match(chunked,/BRIDGE_TRANSFER_ENCODING_UNSUPPORTED/);
  const duplicate=await rawRequest(['POST /ai/chat HTTP/1.1','Host: localhost','Content-Length: 0','Content-Length: 0']);
  assert.match(duplicate,/HTTP\/1.1 400/);assert.match(duplicate,/BRIDGE_CONTENT_LENGTH_INVALID/);
  const incomplete=await rawRequest(['POST /ai/chat HTTP/1.1','Host: localhost','Content-Length: 10',...Object.entries(envelope('argos-incomplete-body-0001')).map(([k,v])=>`${k}: ${v}`)]);
  assert.match(incomplete,/HTTP\/1.1 400/);assert.match(incomplete,/BRIDGE_BODY_INCOMPLETE/);
  assert.deepEqual((await request('POST','/ai/chat',envelope('argos-after-incomplete-0001'))).body,{sentinel:3});
  // Keep sending within the old per-read timeout: only a total deadline can stop this.
  const trickle=(prefix,byte)=>new Promise((resolve,reject)=>{
    const socket=net.createConnection({host:'127.0.0.1',port});let response='',interval;
    const started=Date.now();
    const timer=setTimeout(()=>{socket.destroy();reject(Error('Total request deadline was not enforced'));},15000);
    const cleanup=()=>{clearTimeout(timer);clearInterval(interval);socket.destroy();};
    const completeResponse=()=>{const split=response.indexOf('\r\n\r\n');if(split<0)return false;const length=response.slice(0,split).match(/\r\nContent-Length: (\d+)/i);return Boolean(length)&&Buffer.byteLength(response.slice(split+4))===Number(length[1]);};
    // Windows can reset a socket with unread trickled bytes after sending its
    // complete 408. Require the full framed response, never accept a bare reset.
    socket.on('error',error=>{const complete=completeResponse();cleanup();if(error.code==='ECONNRESET'&&complete)resolve({response,elapsed:Date.now()-started});else reject(error);});
    socket.on('data',chunk=>{response+=chunk;if(completeResponse()){cleanup();resolve({response,elapsed:Date.now()-started});}});
    socket.on('end',()=>{cleanup();resolve({response,elapsed:Date.now()-started});});
    socket.on('connect',()=>{socket.write(prefix);interval=setInterval(()=>socket.write(byte),200);});
  });
  const slowHeaders=await trickle('GET /argos/status HTTP/1.1\r\nX-Slow: ','x');
  assert.match(slowHeaders.response,/HTTP\/1.1 408/);
  assert.match(slowHeaders.response,/BRIDGE_REQUEST_DEADLINE_EXCEEDED/);
  assert.ok(slowHeaders.elapsed<14000);
  const slowBodyHeaders=['POST /ai/chat HTTP/1.1','Host: localhost','Content-Length: 1000',
    ...Object.entries(envelope('argos-slow-body-0001')).map(([k,v])=>`${k}: ${v}`)].join('\r\n')+'\r\n\r\n';
  const slowBody=await trickle(slowBodyHeaders,'x');
  assert.match(slowBody.response,/HTTP\/1.1 408/);
  assert.match(slowBody.response,/BRIDGE_REQUEST_DEADLINE_EXCEEDED/);
  assert.ok(slowBody.elapsed<14000);
  assert.deepEqual((await request('POST','/ai/chat',envelope('argos-after-deadline-0001'))).body,{sentinel:4});
});
