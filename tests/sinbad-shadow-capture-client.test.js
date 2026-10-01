'use strict';
// Phase 4.3a / A3: the capture client. It is exercised ONLY against a loopback mock server and injected fakes: no call to
// sinbad-answer, no cloud endpoint, no real credential. The synthetic responses are written for these tests in the shape of
// the cloud answer function; they are not recorded production answers.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const C=require('../sinbad-ai-core/shadow/capture-client');
const E=require('../sinbad-ai-core/shadow/capture-evaluator');
const core=require('../sinbad-core');
const decision=require('../supabase/functions/sinbad-answer/core-decision');
const tool=require('../tools/capture-sinbad-answer');
const evaluate=require('../tools/evaluate-shadow-capture');

const ROOT=path.resolve(__dirname,'..');
const KEY='test-publishable-key-abcdef123456';
const TOKEN='test-access-token-0123456789abcdefXYZ';
const WS='ws-private-1';
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'sinbad-cap-'));
const CITED='The ISM Code requires a safety management system [S1]. The company must designate a person ashore [S2].';
const okResponse=over=>({answer:CITED,spokenSummary:'x',sources:[{id:'S1',title:'Private Title One',chunk:0,documentId:'0b9f5d3e-2c1a-4f6e-9a77-1d3c5e7f9a01',mimeType:'application/pdf',page:1},{id:'S2',title:'Private Title Two',chunk:1,documentId:'7d4e8f10-aaaa-4bbb-8ccc-0123456789ab',mimeType:'application/pdf',page:2}],visuals:[],sourceAccess:'privileged',mode:'private-rag',...over});

// ---- loopback mock of the function ----
async function mock(behavior){
  const state={requests:[],inFlight:0,maxInFlight:0};
  const server=http.createServer((req,res)=>{
    state.inFlight+=1;state.maxInFlight=Math.max(state.maxInFlight,state.inFlight);
    let raw='';req.on('data',d=>{raw+=d;});
    req.on('end',()=>{
      let body=null;try{body=JSON.parse(raw);}catch{body=null;}
      const index=state.requests.length;state.requests.push({method:req.method,url:req.url,headers:req.headers,body});
      const b=behavior(index,body,req.headers)||{status:200,json:okResponse()};
      setTimeout(()=>{res.writeHead(b.status,{'Content-Type':'application/json'});res.end(b.text!==undefined?b.text:JSON.stringify(b.json===undefined?{}:b.json));state.inFlight-=1;},1);
    });
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {state,url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>server.close(r))};
}
const envFor=url=>({SINBAD_SUPABASE_URL:url,SINBAD_SUPABASE_PUBLISHABLE_KEY:KEY,SINBAD_ACCESS_TOKEN:TOKEN,SINBAD_WORKSPACE_ID:WS});
const cfg=(over={})=>{const r=C.validateConfig({url:'https://abcdefghij.supabase.co',publishableKey:KEY,accessToken:TOKEN,workspaceId:WS,runId:'RUN1',maxCalls:5,execute:false,...over});assert.equal(r.ok,true,JSON.stringify(r.errors));return r.config;};
const deps=over=>({detectLanguage:q=>core.detectLanguage(q),makeEnvelope:(q,h)=>core.aiEnvelope(q,h),validateEnvelope:(e,q)=>decision.validateCoreEnvelope(e,q),serverDecision:q=>decision.serverCoreDecision(q),
  transport:async()=>({status:200,text:JSON.stringify(okResponse()),ms:5,error:null}),now:(()=>{let t=1_790_000_000_000;return()=>{t+=1000;return t;};})(),sleep:async()=>{},write:()=>{},...over});
const items=n=>Array.from({length:n},(_,i)=>({id:`CI-0${i+1}`,category:'context-isolation',prompt:`What does the ISM Code require about audit number ${i+1}?`}));

test('configuration: only https supabase hosts or loopback http; secrets and ceilings are checked; errors never echo a secret',()=>{
  const ok=(over)=>C.validateConfig({url:'https://abcdefghij.supabase.co',publishableKey:KEY,accessToken:TOKEN,workspaceId:WS,runId:'RUN1',maxCalls:5,execute:false,...over});
  assert.equal(ok({}).ok,true);assert.equal(ok({}).config.endpoint,'https://abcdefghij.supabase.co/functions/v1/sinbad-answer');
  assert.equal(ok({url:'http://127.0.0.1:8123'}).ok,true);assert.equal(ok({url:'http://localhost:8123'}).config.endpoint,'http://localhost:8123/functions/v1/sinbad-answer');
  for(const url of ['http://abcdefghij.supabase.co','https://example.com','https://abcdefghij.supabase.co.evil.com','https://evilsupabase.co','https://supabase.co','https://short.supabase.co','http://127.0.0.1','http://10.0.0.5:8000','https://user:pw@abcdefghij.supabase.co','https://abcdefghij.supabase.co/rest/v1','https://abcdefghij.supabase.co/?x=1','https://abcdefghij.supabase.co:8443','ftp://abcdefghij.supabase.co','not a url',undefined,'']){
    const r=ok({url});assert.equal(r.ok,false,String(url));assert.equal(JSON.stringify(r).includes(TOKEN),false);
  }
  assert.ok(ok({maxCalls:0}).errors.includes('MAX_CALLS_INVALID'));assert.ok(ok({maxCalls:C.MAX_CALLS+1}).errors.includes('MAX_CALLS_INVALID'));assert.ok(ok({maxCalls:2.5}).errors.includes('MAX_CALLS_INVALID'));assert.ok(ok({maxCalls:'5'}).errors.includes('MAX_CALLS_INVALID'));
  assert.equal(ok({maxCalls:C.MAX_CALLS}).ok,true);
  assert.ok(ok({execute:true}).errors.includes('CALL_CEILING_NOT_CONFIRMED'));assert.ok(ok({execute:true,confirmCalls:4}).errors.includes('CALL_CEILING_NOT_CONFIRMED'));assert.equal(ok({execute:true,confirmCalls:5}).ok,true);
  assert.ok(ok({execute:'yes'}).errors.includes('EXECUTE_INVALID'));
  for(const bad of [{publishableKey:''},{publishableKey:'a b c d e f g h'},{accessToken:'short'},{accessToken:'has a space in it 0123456789'},{workspaceId:'-x'},{workspaceId:'a b'},{runId:'x'},{runId:'bad id!'},{spacingMs:100},{spacingMs:70_000},{timeoutMs:100},{timeoutMs:400_000}])assert.equal(ok(bad).ok,false,JSON.stringify(bad));
  assert.equal(C.validateConfig(null).ok,false);
  const refused=ok({accessToken:'short',publishableKey:''});assert.equal(refused.config,null);assert.equal(JSON.stringify(refused).includes('short'),false);
});

test('the request is the web app request: exact body keys, no web search or visuals, headers only for the transport',()=>{
  const c=cfg();
  const r=C.buildRequest(c,{id:'CI-01',prompt:'What does the ISM Code require?'},deps());
  assert.equal(r.ok,true);assert.equal(r.language,'en');
  const body=JSON.parse(r.request.body);
  assert.deepEqual(Object.keys(body),['workspaceId','question','language','coreEnvelope']);assert.deepEqual(Object.keys(body),[...C.REQUEST_KEYS]);
  assert.equal(body.language,'en-US');assert.equal(body.workspaceId,WS);assert.equal(body.question,'What does the ISM Code require?');
  for(const forbidden of ['allowWebSearch','includeSourceVisuals','suppressSourceVisuals'])assert.equal(forbidden in body,false);
  assert.equal(decision.validateCoreEnvelope(body.coreEnvelope,body.question),true);assert.deepEqual(body.coreEnvelope.history,[]);
  assert.equal(r.request.headers.Authorization,`Bearer ${TOKEN}`);assert.equal(r.request.headers.apikey,KEY);assert.equal(r.request.headers['Content-Type'],'application/json');
  assert.equal(r.request.endpoint,c.endpoint);assert.equal(JSON.stringify(body).includes(TOKEN),false);assert.equal(JSON.stringify(body).includes(KEY),false);
  const tr=C.buildRequest(c,{id:'CI-02',prompt:'ISM Kodu ne gerektirir?'},{...deps(),detectLanguage:()=>'tr'});
  assert.equal(tr.language,'tr');assert.equal(JSON.parse(tr.request.body).language,'tr-TR');
  assert.equal(C.buildRequest(c,{id:'X-1',prompt:'  '},deps()).reason,'PROMPT_MISSING');assert.equal(C.buildRequest(c,null,deps()).reason,'PROMPT_MISSING');
  assert.equal(C.buildRequest(c,{id:'X-1',prompt:'hello'},{...deps(),validateEnvelope:()=>false}).reason,'ENVELOPE_INVALID');
});

test('a dry run (the default) sends nothing, writes nothing and shows the plan with predicted early exits',async()=>{
  let sends=0,writes=0;
  const r=await C.runCapture({config:cfg(),items:[...items(3),{id:'SS-01',category:'stale-state',prompt:'Man overboard right now, what do I do?'}].slice(0,4),deps:deps({transport:async()=>{sends+=1;return {};},write:()=>{writes+=1;}})});
  assert.equal(r.mode,'DRY_RUN');assert.equal(sends,0);assert.equal(writes,0);assert.equal(r.calls,0);assert.equal(r.written,0);assert.equal(r.refused,null);
  assert.equal(r.plan.length,4);assert.ok(r.plan.every(p=>p.envelope==='VALID'));assert.equal(r.plan[3].predictedEarlyExit,'core-safety-blocked');assert.equal(r.plan[0].predictedEarlyExit,null);
  assert.equal(JSON.stringify(r).includes(TOKEN)||JSON.stringify(r).includes(KEY),false);assert.equal(JSON.stringify(r).includes('audit number'),false);
});

test('execution: one call per prompt, strictly sequential and spaced, never above the ceiling, never truncating silently',async()=>{
  const m=await mock(()=>({status:200,json:okResponse()}));
  try{
    const written=[],sleeps=[];
    const c=cfg({url:m.url,execute:true,confirmCalls:4,maxCalls:4,spacingMs:700});
    const r=await C.runCapture({config:c,items:items(4),deps:deps({transport:(rq,o)=>tool.realTransport(rq,o),write:rec=>written.push(rec),sleep:async ms=>{sleeps.push(ms);}})});
    assert.equal(r.mode,'EXECUTE');assert.equal(r.calls,4);assert.equal(r.written,4);assert.equal(r.aborted,null);assert.equal(r.refused,null);
    assert.equal(m.state.requests.length,4);assert.equal(m.state.maxInFlight,1);assert.deepEqual(sleeps,[700,700,700]);
    for(const q of m.state.requests){assert.equal(q.method,'POST');assert.equal(q.url,'/functions/v1/sinbad-answer');assert.equal(q.headers.authorization,`Bearer ${TOKEN}`);assert.equal(q.headers.apikey,KEY);assert.deepEqual(Object.keys(q.body),[...C.REQUEST_KEYS]);}
    // a ceiling below the prompt count is refused up front, with no call at all
    const before=m.state.requests.length;
    const refused=await C.runCapture({config:cfg({url:m.url,execute:true,confirmCalls:3,maxCalls:3}),items:items(4),deps:deps({transport:(rq,o)=>tool.realTransport(rq,o),write:rec=>written.push(rec)})});
    assert.equal(refused.refused,'ITEMS_EXCEED_CEILING');assert.equal(refused.calls,0);assert.equal(m.state.requests.length,before);
    assert.equal((await C.runCapture({config:cfg(),items:[],deps:deps()})).refused,'NO_ITEMS');
  }finally{await m.close();}
});

test('there is no retry of any kind and the run stops on auth failure, rate limit, non-privileged caller or repeated errors',async()=>{
  const run=async(script,n=6)=>{
    const m=await mock((i)=>script(i));const written=[];
    try{
      const r=await C.runCapture({config:cfg({url:m.url,execute:true,confirmCalls:n,maxCalls:n}),items:items(n),deps:deps({transport:(rq,o)=>tool.realTransport(rq,o),write:rec=>written.push(rec)})});
      return {r,written,requests:m.state.requests.length};
    }finally{await m.close();}
  };
  for(const [name,status,reason] of [['401',401,'AUTH_REJECTED'],['403',403,'AUTH_REJECTED'],['429',429,'RATE_LIMITED']]){
    const x=await run(()=>({status,json:{error:'nope'}}));
    assert.equal(x.r.aborted.reason,reason,name);assert.equal(x.r.aborted.itemId,'CI-01',name);assert.equal(x.requests,1,name);assert.equal(x.written.length,1,name);assert.equal(x.written[0].httpStatus,status,name);
  }
  // a restricted (non-privileged) caller: the record is written, then the run stops
  const restricted=await run(()=>({status:200,json:okResponse({sourceAccess:'restricted',sources:[]})}));
  assert.equal(restricted.r.aborted.reason,'NOT_PRIVILEGED');assert.equal(restricted.requests,1);assert.equal(restricted.written.length,1);
  // three failures in a row stop it; a 500 is NOT retried; one success in between resets the count
  const errors=await run(()=>({status:500,json:{error:'x'}}));
  assert.equal(errors.r.aborted.reason,'TOO_MANY_ERRORS');assert.equal(errors.requests,C.MAX_CONSECUTIVE_ERRORS);assert.equal(errors.written.length,C.MAX_CONSECUTIVE_ERRORS);
  const mixed=await run(i=>i%3===2?{status:200,json:okResponse()}:{status:500,json:{error:'x'}},7);
  assert.equal(mixed.r.aborted,null);assert.equal(mixed.requests,7);
  // the function's own early exits carry no sourceAccess and are neither errors nor aborts
  const early=await run(()=>({status:200,json:{answer:'The cloud model was not run for this high-risk operational request.',sources:[],mode:'core-safety-blocked'}}),4);
  assert.equal(early.r.aborted,null);assert.equal(early.requests,4);assert.ok(early.written.every(r=>r.response&&r.response.mode==='core-safety-blocked'));
  // non-JSON and non-object bodies are recorded as errors, never as responses
  const odd=await run(()=>({status:200,text:'<html>gateway</html>'}),3);
  assert.equal(odd.r.aborted.reason,'TOO_MANY_ERRORS');assert.ok(odd.written.every(r=>r.response===null&&r.error==='RESPONSE_NOT_JSON'));
  const arr=await run(()=>({status:200,text:'[1,2]'}),1);assert.equal(arr.written[0].error,'RESPONSE_NOT_AN_OBJECT');
  // a transport that throws is recorded as a failure, not a crash
  const written=[];
  const t=await C.runCapture({config:cfg({execute:true,confirmCalls:2,maxCalls:2}),items:items(2),deps:deps({transport:async()=>{throw new Error('boom');},write:r=>written.push(r)})});
  assert.equal(t.calls,2);assert.deepEqual(written.map(r=>r.error),['TRANSPORT_FAILED','TRANSPORT_FAILED']);
  // an envelope the server validator would refuse is not sent, and does not count as a call
  const w2=[];const e=await C.runCapture({config:cfg({execute:true,confirmCalls:2,maxCalls:2}),items:items(2),deps:deps({validateEnvelope:()=>false,transport:async()=>{throw new Error('must not be called');},write:r=>w2.push(r)})});
  assert.equal(e.calls,0);assert.deepEqual(w2.map(r=>r.error),['NOT_SENT:ENVELOPE_INVALID','NOT_SENT:ENVELOPE_INVALID']);assert.equal(e.aborted,null);
});

test('credentials never reach a record, a summary or an error text; an echoing or secret-looking response is withheld',async()=>{
  const written=[];
  const echo=async()=>({status:200,text:JSON.stringify(okResponse({answer:`debug: token ${TOKEN} and key ${KEY}`})),ms:3,error:null});
  const r1=await C.runCapture({config:cfg({execute:true,confirmCalls:1,maxCalls:1}),items:items(1),deps:deps({transport:echo,write:x=>written.push(x)})});
  assert.equal(written[0].response,null);assert.equal(written[0].error,'RESPONSE_WITHHELD_CREDENTIAL_PATTERN');
  const secretish=await C.runCapture({config:cfg({execute:true,confirmCalls:1,maxCalls:1}),items:items(1),deps:deps({transport:async()=>({status:200,text:JSON.stringify(okResponse({answer:'api_key = abcdefghijklmnop1234'})),ms:1}),write:x=>written.push(x)})});
  assert.equal(written[1].error,'RESPONSE_WITHHELD_CREDENTIAL_PATTERN');
  const leakyError=await C.runCapture({config:cfg({execute:true,confirmCalls:1,maxCalls:1}),items:items(1),deps:deps({transport:async()=>({status:0,text:'',ms:1,error:`request failed: Authorization: Bearer ${TOKEN} apikey ${KEY}`}),write:x=>written.push(x)})});
  assert.ok(written[2].error.includes('[redacted]'));
  for(const rec of written)for(const secret of [TOKEN,KEY])assert.equal(JSON.stringify(rec).includes(secret),false);
  for(const summary of [r1,secretish,leakyError])for(const secret of [TOKEN,KEY,'audit number'])assert.equal(JSON.stringify(summary).includes(secret),false);
  assert.ok(written.every(rec=>E.validateRecord(rec).ok));
});

test('records are exactly the A2 format, written exclusively, and the A2 evaluator reads what the client wrote',async()=>{
  const m=await mock((i)=>i===1?{status:200,json:okResponse({sourceAccess:'privileged',answer:'Internal audits are annual [S1]. The master may override [S9].'})}:i===2?{status:200,json:{answer:'Not run.',sources:[],mode:'core-safety-blocked'}}:{status:200,json:okResponse()});
  const out=path.join(tmp(),'captures');
  try{
    const argv=['--out',out,'--max-calls','30','--execute','--confirm-cloud-calls','30','--run-id','RUN2'];
    const result=await tool.main(argv,envFor(m.url),{sleep:async()=>{}});
    assert.equal(result.calls,30);assert.equal(result.written,30);assert.equal(result.aborted,null);assert.equal(m.state.requests.length,30);
    const files=fs.readdirSync(out).sort();assert.equal(files.length,30);assert.ok(files.every(f=>/^cap-RUN2-[A-Z]+-[A-Z0-9-]+\.json$/u.test(f)));
    for(const f of files){
      const text=fs.readFileSync(path.join(out,f),'utf8'),rec=JSON.parse(text);
      assert.equal(E.validateRecord(rec).ok,true,f);assert.equal(f,`${rec.captureId}.json`);assert.equal(rec.workspaceId,WS);
      assert.equal(text.includes(TOKEN)||text.includes(KEY),false);
    }
    // the same run id again must not overwrite anything
    const before=fs.readFileSync(path.join(out,files[0]),'utf8');
    await assert.rejects(()=>tool.main(argv,envFor(m.url),{sleep:async()=>{}}),/EEXIST/u);
    assert.equal(fs.readFileSync(path.join(out,files[0]),'utf8'),before);
    // the evaluator takes the directory as it is
    const report=evaluate.evaluateDirectory({capturesDir:out});
    assert.equal(report.intake.invalid.count,0);assert.equal(report.captures.total,30);assert.equal(report.captures.byStatus.GATED,29);assert.equal(report.captures.byStatus.REFUSED,1);
    assert.equal(report.captures.refusedByReason.SOURCE_ACCESS_NOT_PRIVILEGED,1);assert.ok(report.markers.capturesWithUnknownMarker>=1);
    const text=JSON.stringify(report);for(const secret of [TOKEN,KEY,'Private Title','0b9f5d3e'])assert.equal(text.includes(secret),false);
  }finally{await m.close();}
});

test('the command line: dry run by default, repository paths and foreign hosts refused, nothing leaks, a real run stops on 401',async()=>{
  const script=path.join(ROOT,'tools','capture-sinbad-answer.js');
  const m=await mock(()=>({status:401,json:{error:'Invalid JWT'}}));
  const out=path.join(tmp(),'cli-out');
  const runSync=(args,env)=>cp.spawnSync(process.execPath,[script,...args],{encoding:'utf8',cwd:ROOT,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot||'',...env}});
  try{
    // dry run: no network, no files, no secrets needed
    const dry=runSync(['--out',out,'--max-calls','30'],{SINBAD_SUPABASE_URL:m.url,SINBAD_WORKSPACE_ID:WS});
    assert.equal(dry.status,0,dry.stderr);assert.match(dry.stdout,/DRY RUN: no network call was made and nothing was written/u);assert.match(dry.stdout,/30 calls would be made/u);assert.match(dry.stdout,/predicted core-safety early exits 0/u);
    assert.equal(m.state.requests.length,0);assert.equal(fs.existsSync(out),false);assert.match(dry.stdout,/--execute --confirm-cloud-calls/u);
    // with the maritime slice, 36 prompts need a ceiling of 36
    const wide=runSync(['--out',out,'--max-calls','36','--include-maritime'],{SINBAD_SUPABASE_URL:m.url,SINBAD_WORKSPACE_ID:WS});assert.match(wide.stdout,/36 calls would be made/u);
    const tooSmall=runSync(['--out',out,'--max-calls','30','--include-maritime'],{SINBAD_SUPABASE_URL:m.url,SINBAD_WORKSPACE_ID:WS});assert.equal(tooSmall.status,1);assert.match(tooSmall.stdout,/ITEMS_EXCEED_CEILING/u);
    // refusals
    assert.equal(runSync(['--max-calls','30'],{SINBAD_SUPABASE_URL:m.url,SINBAD_WORKSPACE_ID:WS}).status,1);
    assert.equal(runSync(['--out',path.join(ROOT,'captures-here'),'--max-calls','30'],{SINBAD_SUPABASE_URL:m.url,SINBAD_WORKSPACE_ID:WS}).status,1);assert.equal(fs.existsSync(path.join(ROOT,'captures-here')),false);
    assert.equal(runSync(['--out',out,'--max-calls','30'],{SINBAD_SUPABASE_URL:'https://example.com',SINBAD_WORKSPACE_ID:WS}).status,1);
    assert.equal(runSync(['--out',out,'--max-calls','30'],{SINBAD_SUPABASE_URL:'http://abcdefghij.supabase.co',SINBAD_WORKSPACE_ID:WS}).status,1);
    assert.equal(runSync(['--out',out,'--max-calls','30','--execute'],envFor(m.url)).status,1);                                  // no confirmation
    assert.equal(runSync(['--out',out,'--max-calls','30','--execute','--confirm-cloud-calls','29'],envFor(m.url)).status,1);       // wrong confirmation
    assert.equal(runSync(['--out',out,'--max-calls','30','--execute','--confirm-cloud-calls','30'],{SINBAD_SUPABASE_URL:m.url,SINBAD_WORKSPACE_ID:WS}).status,1); // no credentials
    assert.equal(runSync(['--out',out,'--max-calls','nope'],envFor(m.url)).status,1);assert.equal(runSync(['--bogus'],envFor(m.url)).status,1);
    assert.equal(m.state.requests.length,0);assert.equal(fs.existsSync(out),false);
  // a real (loopback) run: the mock rejects the token, the client stops after exactly one call
  // (everything from the dry run on is inside one try, so a failing assertion can never leave the mock server open)
  const child=cp.spawn(process.execPath,[script,'--out',out,'--max-calls','30','--execute','--confirm-cloud-calls','30','--run-id','RUN3'],{cwd:ROOT,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot||'',...envFor(m.url)}});
  let stdout='',stderr='';child.stdout.on('data',d=>{stdout+=d;});child.stderr.on('data',d=>{stderr+=d;});
  const code=await new Promise(r=>child.on('close',r));
  assert.equal(code,2,stderr);assert.match(stdout,/ABORTED: AUTH_REJECTED at CI-01/u);assert.match(stdout,/calls 1; records written 1/u);
    assert.equal(m.state.requests.length,1);assert.equal(fs.readdirSync(out).length,1);
    for(const text of [stdout,stderr,fs.readFileSync(path.join(out,fs.readdirSync(out)[0]),'utf8')])for(const secret of [TOKEN,KEY])assert.equal(text.includes(secret),false);
  }finally{await m.close();}
});

test('the client is inert in the repository: pure core, one networking file, one write, no npm script or workflow points at it, accepted parts unchanged',()=>{
  const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
  const requires=src=>[...src.matchAll(/require\(['"]([^'"]+)['"]\)/gu)].map(m=>m[1]).sort();
  const coreSrc=read('sinbad-ai-core/shadow/capture-client.js'),toolSrc=read('tools/capture-sinbad-answer.js');
  assert.deepEqual(requires(coreSrc),['../participation/participation-v0','./capture-evaluator']);
  assert.doesNotMatch(coreSrc,/node:(?:fs|http|https|net|tls|dns|dgram|child_process)|\bfetch\(|XMLHttpRequest|WebSocket|Date\.now\(|new Date\(|Math\.random|process\.env|process\.argv/u);
  assert.doesNotMatch(coreSrc,/\b(?:academy|gasm|zabit|akademi)\b/iu);
  assert.deepEqual(requires(toolSrc),['../sinbad-ai-core/shadow/capture-client','../sinbad-core','../supabase/functions/sinbad-answer/core-decision','./evaluate-shadow-capture','./run-grounded-subset','./sinbad-participation','node:fs','node:http','node:https','node:path']);
  assert.doesNotMatch(toolSrc,/\bfetch\(|XMLHttpRequest|WebSocket|node:child_process|node:net|node:tls/u);
  assert.equal([...toolSrc.matchAll(/writeFileSync\(/gu)].length,1);assert.match(toolSrc,/flag:'wx'/u);assert.equal([...toolSrc.matchAll(/\.request\(/gu)].length,1);
  assert.doesNotMatch(toolSrc,/allowWebSearch|includeSourceVisuals|suppressSourceVisuals/u);assert.doesNotMatch(coreSrc,/allowWebSearch\s*[:=]|includeSourceVisuals\s*[:=]/u);
  // nothing in the repository starts it: no npm script, no workflow, no other tool or test spawns it against the cloud
  assert.equal(read('package.json').includes('capture-sinbad-answer'),false);
  for(const f of fs.readdirSync(path.join(ROOT,'.github','workflows')))assert.equal(read(`.github/workflows/${f}`).includes('capture-sinbad-answer'),false,f);
  const pin=f=>crypto.createHash('sha256').update(read(f).replace(/\r\n/gu,'\n')).digest('hex');
  const PINNED={
    'sinbad-ai-core/shadow/response-mapper.js':'85742b5dc9d189a4cf6154e40b6fa1d9d9ec889df0f2a1cbec148771e3c30cd6',
    'sinbad-ai-core/shadow/capture-evaluator.js':'ccac09de5f2dbee1f7305186374496f116ddd9c00f7aed7a37cfb65dcf57848f','tools/evaluate-shadow-capture.js':'db5448ba937fd45025ba7dc2abc19dcfdec5e01e7ebba56ccea728a2b30ed9db',
    'sinbad-ai-core/adapter/draft-adapter-v0.js':'8bbca9d77ce1c2aab5b8cc488664433dd2796787ada762795f6998757d0fb722',
    'sinbad-ai-core/chain/chain-v0.js':'cc668008a9a11040a8ffed0d2d4b1620511021eecf376c0ba5fc8c7aaed6b68b'
  };
  for(const [file,hash] of Object.entries(PINNED))assert.equal(pin(file),hash,`${file} changed`);
});
