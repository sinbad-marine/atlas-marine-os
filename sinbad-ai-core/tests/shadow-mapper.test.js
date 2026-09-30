'use strict';
// Phase 4.3a / A1: the response mapper. Offline. The responses below are written for these tests in the shape of the
// cloud answer function; they are not recorded production answers, and nothing here calls any endpoint.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const mapper=require('../shadow');
const direct=require('../shadow/response-mapper.js');
const {d,k,NOW,context,rehearseOne}=require('./helpers/draft-adapter-v0-builders.js');

const SCOPE='workspace:ws-1';
const DOC1='0b9f5d3e-2c1a-4f6e-9a77-1d3c5e7f9a01',DOC2='7d4e8f10-aaaa-4bbb-8ccc-0123456789ab';
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const source=(n,over)=>({id:`S${n}`,title:`Private Title ${n}`,chunk:n-1,documentId:n===1?DOC1:DOC2,mimeType:'application/pdf',page:n,...over});
const response=over=>({answer:'The ISM Code requires a safety management system [S1]. The company must designate a person ashore [S2].',spokenSummary:'x',sources:[source(1),source(2)],visuals:[],sourceAccess:'privileged',mode:'private-rag',...over});
const capture=over=>({version:mapper.INPUT_VERSION,captureId:'cap-001',capturedAt:NOW,workspaceId:'ws-1',context:context({evidenceScopeRef:SCOPE}),response:response(),...over});
const mapped=over=>{const r=mapper.map(capture(over));assert.equal(r.status,'MAPPED',r.reasonCode);return r;};
const refusedWith=(over,code)=>{const r=mapper.map(capture(over));assert.equal(r.status,'REFUSED');assert.equal(r.reasonCode,code);assert.equal(r.adapterInput,null);assert.equal(r.failClosed,true);return r;};

test('a privileged private-rag response maps to the exact Draft Adapter input',()=>{
  const r=mapped();
  assert.equal(r.version,mapper.OUTPUT_VERSION);assert.equal(r.failClosed,false);assert.equal(r.reasonCode,null);
  const a=r.adapterInput;
  assert.equal(a.version,d.INPUT_VERSION);assert.equal(a.adaptationId,'adapt-cap-001');assert.equal(a.at,NOW);assert.equal(a.retrievedAt,NOW);
  assert.deepEqual(a.answer,{text:response().answer,originRef:'model:sinbad-answer'});assert.deepEqual(a.proposedActions,[]);
  assert.deepEqual(Object.keys(a).sort(),[...d.INPUT_FIELDS].sort());
  assert.deepEqual(a.passages.map(p=>Object.keys(p).sort()),[[...d.PASSAGE_FIELDS].sort(),[...d.PASSAGE_FIELDS].sort()]);
  assert.deepEqual(a.passages[0],{marker:'S1',evidenceId:`doc.${DOC1}.c0`,sourceClass:'DOCUMENT',locatorRef:`library:${DOC1}:chunk-0`,contentHash:sha(`${DOC1}:0`),observedAt:NOW,scopeRef:SCOPE});
  assert.equal(a.passages[1].evidenceId,`doc.${DOC2}.c1`);
  assert.deepEqual(r.sourceMap,[{marker:'S1',evidenceId:`doc.${DOC1}.c0`},{marker:'S2',evidenceId:`doc.${DOC2}.c1`}]);
  assert.deepEqual(r.stats,{sources:2,answerChars:response().answer.length,mode:'private-rag'});
  assert.equal(r.authority,'NONE');assert.equal(r.callsModel,false);assert.equal(r.callsNetwork,false);assert.equal(r.writesFiles,false);
  assert.match(r.mappingDigest,/^[a-f0-9]{64}$/u);
});

test('the mapping is deterministic, sealed and leaves its input untouched',()=>{
  const input=capture();const before=JSON.stringify(input);
  const a=mapper.map(input),b=mapper.map(capture());
  assert.equal(JSON.stringify(input),before);
  assert.equal(a.mappingDigest,b.mappingDigest);assert.equal(JSON.stringify(a),JSON.stringify(b));
  assert.equal(Object.isFrozen(a),true);assert.equal(Object.isFrozen(a.adapterInput.passages[0]),true);
  assert.notEqual(mapper.map(capture({captureId:'cap-002'})).mappingDigest,a.mappingDigest);
  // the mapped context is a copy, not the caller's object
  assert.notEqual(a.adapterInput.context,input.context);
});

test('document identity: uuid kept, unusual ids and missing ids become hashed keys, titles never leak',()=>{
  const odd='weird id with spaces/€',titleOnly='Secret Regulation Handbook';
  const r=mapped({response:response({sources:[source(1),source(2,{documentId:odd}),source(3,{documentId:null,title:titleOnly,chunk:7}),source(4,{documentId:'',title:'Another Title',chunk:0})],answer:'A [S1]. B [S2]. C [S3]. D [S4].'})});
  const p=r.adapterInput.passages;
  assert.equal(p[1].evidenceId,`doc.h${sha(odd).slice(0,12)}.c1`);assert.equal(p[1].contentHash,sha(`${odd}:1`));
  assert.equal(p[2].evidenceId,`doc.h${sha(titleOnly).slice(0,12)}.c7`);assert.equal(p[2].locatorRef,`library:h${sha(titleOnly).slice(0,12)}:chunk-7`);assert.equal(p[2].contentHash,sha(`title:${titleOnly}:7`));
  assert.equal(p[3].evidenceId,`doc.h${sha('Another Title').slice(0,12)}.c0`);
  const text=JSON.stringify(r);
  for(const t of ['Private Title','Secret Regulation Handbook','Another Title','application/pdf',odd])assert.ok(!text.includes(t),t);
  // the same passage always gets the same identity hash; different chunks differ
  assert.equal(mapper.identityHash(source(1)),mapper.identityHash(source(1)));assert.notEqual(mapper.identityHash(source(1)),mapper.identityHash(source(1,{chunk:5})));
});

test('every refusal is fail-closed with its own reason code and never maps an empty or partial passage list',()=>{
  refusedWith({response:response({sourceAccess:'restricted',sources:[]})},'SOURCE_ACCESS_NOT_PRIVILEGED');
  refusedWith({response:response({sourceAccess:undefined})},'SOURCE_ACCESS_NOT_PRIVILEGED');
  for(const mode of ['general-ai','web-assisted','retrieval-only','source-access-restricted','core-safety-blocked','local-greeting','configuration-required',undefined,7])refusedWith({response:response({mode})},'MODE_NOT_MAPPABLE');
  refusedWith({response:response({sources:[]})},'NO_SOURCES');refusedWith({response:response({sources:undefined})},'NO_SOURCES');refusedWith({response:response({sources:'S1'})},'NO_SOURCES');
  for(const a of [undefined,'',' \n ',7,null,{},'x'.repeat(200_001)])refusedWith({response:response({answer:a})},'ANSWER_MISSING');
  refusedWith({response:response({sources:[source(1),source(1,{chunk:9,documentId:DOC2})]})},'DUPLICATE_MARKER');
  refusedWith({response:response({sources:[source(1),source(2,{documentId:DOC1,chunk:0})]})},'DUPLICATE_EVIDENCE');
  for(const bad of [{id:'S0'},{id:'s1'},{id:'S1000'},{id:'X1'},{id:1},{chunk:-1},{chunk:1.5},{chunk:'3'},{chunk:undefined},{chunk:2_000_000},{documentId:5},{documentId:null,title:''},{documentId:null,title:7}])refusedWith({response:response({sources:[source(1,bad)]})},'SOURCE_INVALID');
  refusedWith({response:response({sources:['S1',null,7]})},'SOURCE_INVALID');
  refusedWith({response:response({sources:Array.from({length:257},(_,i)=>source(1,{id:`S${i+1}`,chunk:i}))})},'TOO_MANY_SOURCES');
  refusedWith({response:null},'RESPONSE_INVALID');refusedWith({response:[]},'RESPONSE_INVALID');
  refusedWith({context:context({evidenceScopeRef:'workspace:other'})},'CONTEXT_SCOPE_MISMATCH');refusedWith({context:null},'CONTEXT_SCOPE_MISMATCH');
  for(const w of ['','-x','has space','a'.repeat(200),7])refusedWith({workspaceId:w,context:context({evidenceScopeRef:`workspace:${w}`})},'WORKSPACE_ID_INVALID');
  for(const c of ['','has space','x'.repeat(100),7])refusedWith({captureId:c},'CAPTURE_ID_INVALID');
  for(const t of [-1,1.5,'5',null,Number.MAX_SAFE_INTEGER+2])refusedWith({capturedAt:t},'INPUT_INVALID');
  for(const bad of [null,undefined,'x',[],{},{...capture(),extra:1},{...capture(),version:'other'}]){const r=mapper.map(bad);assert.equal(r.status,'REFUSED');assert.equal(r.reasonCode==='INPUT_INVALID',true);}
  assert.equal(mapper.map(capture({captureId:'x'.repeat(90)})).status,'MAPPED');
  assert.equal(mapper.map(capture({captureId:'x'.repeat(91)})).reasonCode,'CAPTURE_ID_INVALID');
  assert.equal(mapper.REASONS.length,13);
});

test('hostile inputs cannot reach the mapper through accessors, inherited fields or throwing proxies',()=>{
  const getter=capture();Object.defineProperty(getter,'captureId',{get(){throw new Error('boom');},enumerable:true});
  assert.equal(mapper.map(getter).reasonCode,'INPUT_INVALID');
  const inherited=Object.create({answer:'inherited [S1]'});Object.assign(inherited,{sources:[source(1)],sourceAccess:'privileged',mode:'private-rag'});
  assert.equal(mapper.map(capture({response:inherited})).reasonCode,'RESPONSE_INVALID');
  const accessorResponse=response();Object.defineProperty(accessorResponse,'answer',{get(){return 'lazy [S1]';},enumerable:true});
  assert.equal(mapper.map(capture({response:accessorResponse})).reasonCode,'ANSWER_MISSING');
  const accessorSource=source(1);Object.defineProperty(accessorSource,'chunk',{get(){return 0;},enumerable:true});
  assert.equal(mapper.map(capture({response:response({sources:[accessorSource]})})).reasonCode,'SOURCE_INVALID');
  const proxy=new Proxy(capture(),{ownKeys(){throw new Error('trap');}});
  assert.equal(mapper.map(proxy).status,'REFUSED');
  assert.equal(mapper.map(Object.create(null)).status,'REFUSED');
});

test('the output states its limits; identity-only hashes and cited existence are not support',()=>{
  const r=mapped();
  assert.equal(r.limits.length,3);
  assert.ok(r.limits.some(l=>l.startsWith('CONTENT_HASH_IS_IDENTITY_ONLY')));assert.ok(r.limits.some(l=>l.startsWith('CITATION_PROVES_EXISTENCE_NOT_SUPPORT')));assert.ok(r.limits.some(l=>l.startsWith('SOURCE_TITLES_NOT_CARRIED')));
  assert.equal(mapper.map(capture({response:null})).limits.length,3);
  assert.throws(()=>{r.limits.push('x');});
});

test('the adapter and the chain accept the mapped output; the gate then behaves as on any passages',()=>{
  const ctx=()=>({context:context({evidenceScopeRef:SCOPE})});
  const run=(answer,sources)=>{
    const r=mapped({response:response(sources?{answer,sources}:{answer})});
    const adapted=d.adapt(JSON.parse(JSON.stringify(r.adapterInput)));
    assert.equal(adapted.status,'ADAPTED',adapted.reasonCode);
    const t=rehearseOne(adapted,ctx());assert.equal(k.verifyTranscript(t),true);return {r,adapted,t};
  };
  const ok=run('The ISM Code requires a safety management system [S1]. The company must designate a person ashore [S2].');
  assert.equal(ok.t.outcome,'PROCEED');assert.deepEqual(ok.adapted.chainPass.evidenceSet.items.map(i=>i.evidenceId),[`doc.${DOC1}.c0`,`doc.${DOC2}.c1`]);
  // a marker the function never handed out is still a fabricated citation after mapping
  const fabricated=run('Internal audits are annual [S1]. The master may override [S9].');
  assert.equal(fabricated.t.outcome,'AWAITING_DRAFT');
  // the stated ceiling, demonstrated: an invention WITH a real marker is admitted, because identity is all the gate can check here
  const invented=run('PR #254 was merged as c506f21 and is VERIFIED [S1].');
  assert.equal(invented.t.outcome,'PROCEED');
});

test('the module is pure: only crypto and the exact-snapshot helpers, no I/O, network, model or clock, and the index re-exports it',()=>{
  const src=fs.readFileSync(path.join(__dirname,'..','shadow','response-mapper.js'),'utf8');
  assert.deepEqual([...src.matchAll(/require\(['"]([^'"]+)['"]\)/gu)].map(m=>m[1]).sort(),['../authority/exact','node:crypto']);
  assert.doesNotMatch(src,/node:(?:fs|http|https|net|tls|dns|child_process)|\bfetch\(|XMLHttpRequest|WebSocket|Date\.now\(|new Date\(|Math\.random|process\.env/u);
  assert.doesNotMatch(src,/\b(?:academy|gasm|zabit|akademi)\b/iu);
  assert.equal(mapper,direct);
  assert.equal(mapper.INPUT_VERSION,'sinbad-answer-capture/0-v1');assert.equal(mapper.ADAPTER_INPUT_VERSION,d.INPUT_VERSION);
});
