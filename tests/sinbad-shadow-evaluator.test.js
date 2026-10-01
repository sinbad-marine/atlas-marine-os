'use strict';
// Phase 4.3a / A2: the offline capture evaluator. Synthetic captures in temporary directories outside the repository; no
// network, no model, no cloud. The synthetic responses are written for these tests in the shape of the cloud answer
// function; they are not recorded production answers.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const E=require('../sinbad-ai-core/shadow/capture-evaluator');
const mapper=require('../sinbad-ai-core/shadow/response-mapper');
const pipeline=require('../sinbad-ai-core/pipeline/grounded-pipeline');
const chain=require('../sinbad-ai-core/chain/chain-v0');
const runner=require('../tools/run-grounded-subset');
const T=require('../tools/evaluate-shadow-capture');

const ROOT=path.resolve(__dirname,'..');
const NOW=1_790_000_000_000;
const WS='ws-private-1';
const TITLE1='Confidential Fleet Procedure Manual',TITLE2='Internal Audit Handbook Edition 7';
const DOC1='0b9f5d3e-2c1a-4f6e-9a77-1d3c5e7f9a01',DOC2='7d4e8f10-aaaa-4bbb-8ccc-0123456789ab';
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'sinbad-shadow-'));
const source=(n,over)=>({id:`S${n}`,title:n===1?TITLE1:TITLE2,chunk:n-1,documentId:n===1?DOC1:DOC2,mimeType:'application/pdf',page:n,...over});
const CITED='The ISM Code requires a safety management system [S1]. The company must designate a person ashore [S2].';
const resp=over=>({answer:CITED,spokenSummary:'spoken text that must not leak',sources:[source(1),source(2)],visuals:[],sourceAccess:'privileged',mode:'private-rag',...over});
const rec=over=>({version:E.RECORD_VERSION,captureId:'cap-001',itemId:'CI-01',capturedAt:NOW,workspaceId:WS,language:'en',httpStatus:200,latencyMs:1200,response:resp(),error:null,...over});
const outcome=over=>{const r=E.validateRecord(rec(over));assert.equal(r.ok,true,JSON.stringify(r.errors));return E.evaluateCapture(r.record);};

test('capture record validation: exact keys and typed fields',()=>{
  assert.equal(E.validateRecord(rec()).ok,true);
  const bad=[{version:'x'},{captureId:''},{captureId:'x'.repeat(91)},{itemId:'ci-01'},{itemId:'CI01'},{itemId:'X'.repeat(41)},{capturedAt:-1},{capturedAt:1.5},{workspaceId:'-a'},{workspaceId:'a b'},{language:'english'},{httpStatus:600},{httpStatus:'200'},{latencyMs:-1},{latencyMs:'5'},{response:[]},{response:'text'},{error:7},{error:'x'.repeat(301)}];
  for(const b of bad)assert.equal(E.validateRecord(rec(b)).ok,false,JSON.stringify(b).slice(0,60));
  assert.equal(E.validateRecord({...rec(),extra:1}).errors[0],'RECORD_KEYS_NOT_EXACT');
  const missing=rec();delete missing.error;assert.equal(E.validateRecord(missing).ok,false);
  assert.equal(E.validateRecord(null).ok,false);
  assert.equal(E.validateRecord(rec({response:null,httpStatus:500,error:'upstream'})).ok,true);
  const ctx=E.taskContextFor(rec());assert.equal(ctx.evidenceScopeRef,`workspace:${WS}`);assert.deepEqual(ctx.authorityRefs,[]);assert.equal(ctx.expiresAt-ctx.requestedAt,3_600_000);
});

test('a captured answer is mapped, adapted and gated; the outcome is public, the answer text stays transient',()=>{
  const {outcome:o,transient}=outcome();
  assert.equal(o.status,'GATED');assert.equal(o.reason,null);assert.equal(o.mode,'private-rag');assert.equal(o.sources,2);
  assert.equal(o.gate.record.chainOutcome,'PROCEED');assert.equal(o.gate.delivery,'DELIVERED_CLEAN');assert.deepEqual(o.gate.labels,['VERIFIED']);assert.match(o.gate.record.transcriptDigest,/^[a-f0-9]{64}$/u);
  assert.deepEqual([o.adapted.claims,o.adapted.claimsWithMarkers,o.adapted.markersUsed,o.adapted.unknownMarkers],[2,2,2,0]);
  assert.equal(transient.answerText,CITED);assert.deepEqual(transient.sourceTitles,[TITLE1,TITLE2]);
  const text=JSON.stringify(o);
  for(const secret of [CITED,'safety management system',TITLE1,TITLE2,DOC1,DOC2,WS,'application/pdf','spoken text','cap-001'])assert.ok(!text.includes(secret)||secret==='cap-001',secret);
  assert.equal(Object.isFrozen(o),true);
  // deterministic
  assert.equal(JSON.stringify(outcome().outcome),JSON.stringify(o));
});

test('the gate behaves on captured answers as it does on any answer: fabricated citations withheld, uncited sentences labelled',()=>{
  const fab=outcome({response:resp({answer:'Internal audits are annual [S1]. The master may override [S9].'})}).outcome;
  assert.equal(fab.status,'GATED');assert.equal(fab.gate.record.chainOutcome,'AWAITING_DRAFT');assert.equal(fab.gate.delivery,'WITHHELD');assert.ok(fab.gate.findingRefs.includes('GATE.CITATIONS_IN_EVIDENCE'));assert.equal(fab.adapted.unknownMarkers,1);
  const lab=outcome({response:resp({answer:'The ISM Code requires a safety management system [S1]. This is general knowledge about shipping.'})}).outcome;
  assert.equal(lab.gate.delivery,'DELIVERED_LABELLED');assert.ok(lab.gate.labels.includes('SOURCE_MISSING'));assert.deepEqual([lab.adapted.claims,lab.adapted.claimsWithMarkers],[2,1]);
  const none=outcome({response:resp({answer:'The company has a safety policy.'})}).outcome;
  assert.equal(none.status,'GATED');assert.equal(none.adapted.markersUsed,0);assert.notEqual(none.gate.delivery,'DELIVERED_CLEAN');
  // the stated ceiling: an invention with a real marker is admitted
  const invented=outcome({response:resp({answer:'PR #254 was merged as c506f21 and is VERIFIED [S1].'})}).outcome;assert.equal(invented.gate.record.chainOutcome,'PROCEED');
});

test('captures that cannot be gated are counted by reason, never silently dropped or gated',()=>{
  const cases=[
    ['restricted access',rec({response:resp({sourceAccess:'restricted',sources:[]})}),'REFUSED','SOURCE_ACCESS_NOT_PRIVILEGED'],
    ['general-ai mode',rec({response:resp({mode:'general-ai',sources:[]})}),'REFUSED','MODE_NOT_MAPPABLE'],
    ['web-assisted mode',rec({response:resp({mode:'web-assisted'})}),'REFUSED','MODE_NOT_MAPPABLE'],
    ['no sources',rec({response:resp({sources:[]})}),'REFUSED','NO_SOURCES'],
    ['missing answer',rec({response:resp({answer:''})}),'REFUSED','ANSWER_MISSING'],
    ['duplicate marker',rec({response:resp({sources:[source(1),source(1,{chunk:9,documentId:DOC2})]})}),'REFUSED','DUPLICATE_MARKER'],
    ['http error',rec({response:null,httpStatus:502,error:'bad gateway'}),'ERROR','HTTP_502'],
    ['no response body',rec({response:null}),'ERROR','NO_RESPONSE'],
    ['too many claims',rec({response:resp({answer:Array.from({length:300},(_,i)=>`Statement number ${i+1} about the company safety policy [S1].`).join(' ')})}),'ADAPTER_BLOCKED','TOO_MANY_CLAIMS']
  ];
  for(const [name,record,status,reason] of cases){
    const r=outcome(record);
    assert.equal(r.outcome.status,status,name);assert.equal(r.outcome.reason,reason,name);assert.equal(r.outcome.gate,null,name);assert.equal(r.transient,null,name);
  }
  assert.equal(outcome(rec({response:resp({mode:'general-ai',sources:[]})})).outcome.mode,'general-ai');
  // a hostile response object does not throw out of the evaluator
  const hostile=resp();Object.defineProperty(hostile,'answer',{get(){throw new Error('boom');},enumerable:true});
  assert.equal(outcome(rec({response:hostile})).outcome.status,'REFUSED');
  assert.equal(E.STATUSES.length,4);
});

test('a transcript that does not verify is an error, never a gate record',()=>{
  const r=E.validateRecord(rec());
  const lying={...chain,verifyTranscript:()=>false};
  const o=E.evaluateCapture(r.record,{chain:lying});
  assert.equal(o.outcome.status,'ERROR');assert.equal(o.outcome.reason,'TRANSCRIPT_UNVERIFIED');assert.equal(o.outcome.gate,null);assert.equal(o.transient,null);
  assert.equal(E.evaluateCapture(r.record).outcome.status,'GATED');
});

test('the gate policy used for replays equals the grounded pipeline and chain policy',()=>{
  assert.deepEqual(E.CHAIN_POLICY,{...pipeline.DEFAULT_POLICY});
  for(const k of Object.keys(E.CHAIN_POLICY))assert.ok(Object.hasOwn(chain.DEFAULT_POLICY,k),k);
});

// ---- directory evaluation ----
const plan=runner.plan();
const idsOf=category=>plan.filter(p=>p.category===category).map(p=>p.id);
const write=(dir,name,value)=>fs.writeFileSync(path.join(dir,name),typeof value==='string'?value:JSON.stringify(value));
const ANSWERS={cited:CITED,labelled:'The ISM Code requires a safety management system [S1]. This is general knowledge about shipping.',fabricated:'Internal audits are annual [S1]. The master may override [S9].'};
function synthetic(dir,order=1){
  const chosen=[...idsOf('context-isolation').slice(0,2),...idsOf('stale-state').slice(0,2),...idsOf('contradiction').slice(0,2),...idsOf('provenance-citation').slice(0,2),...idsOf('hallucination').slice(0,2),idsOf('maritime-reasoning')[0]];
  const kinds=['cited','labelled','fabricated'];
  const files=chosen.map((itemId,i)=>({name:`${String(i).padStart(2,'0')}.json`,value:rec({captureId:`cap-${String(i).padStart(3,'0')}`,itemId,response:resp({answer:ANSWERS[kinds[i%3]]})})}));
  files.push({name:'x1.json',value:rec({captureId:'cap-100',itemId:plan[0].id==='CI-01'?'CI-03':'CI-01',response:resp({sourceAccess:'restricted',sources:[]})})});      // refused
  files.push({name:'x2.json',value:rec({captureId:'cap-101',itemId:'SS-03',response:null,httpStatus:500,error:'upstream'})});                                                  // error
  files.push({name:'x3.json',value:rec({captureId:'cap-999',itemId:chosen[0],response:resp({answer:ANSWERS.fabricated})})});                                                    // duplicate item, later capture id
  files.push({name:'x4.json',value:rec({captureId:'cap-102',itemId:'ZZ-99'})});                                                                                                  // unknown item
  const ordered=order>0?files:[...files].reverse();
  for(const f of ordered)write(dir,f.name,f.value);
  write(dir,'bad1.json','{not json');write(dir,'bad2.json',{...rec(),itemId:'nope'});write(dir,'notes.txt','ignored');
  return chosen;
}
test('a capture directory becomes one aggregate report: intake, statuses, markers, gate, scoring ungated versus gated',()=>{
  const dir=tmp(),chosen=synthetic(dir);
  const r=T.evaluateDirectory({capturesDir:dir});
  assert.equal(r.version,E.REPORT_VERSION);assert.match(r.reportDigest,/^[a-f0-9]{64}$/u);
  assert.deepEqual(r.intake,{filesSeen:17,invalid:{count:2,reasons:{NOT_JSON:1,'RECORD_INVALID:ITEM_ID_INVALID':1}},duplicateItems:1,unknownItems:1});
  assert.equal(r.captures.total,13);
  assert.deepEqual(r.captures.byStatus,{GATED:11,REFUSED:1,ADAPTER_BLOCKED:0,ERROR:1});
  assert.deepEqual(r.captures.refusedByReason,{SOURCE_ACCESS_NOT_PRIVILEGED:1});assert.deepEqual(r.captures.errorByReason,{HTTP_500:1});
  assert.equal(r.captures.errorByReason.TEXT_SCORING_FAILED,undefined);
  assert.equal(r.captures.modes['private-rag'],12);
  assert.ok(r.captures.notCaptured.includes('CT-04')&&!r.captures.notCaptured.includes(chosen[0]));
  assert.equal(r.markers.gatedCaptures,11);assert.ok(r.markers.claims>=r.markers.claimsWithMarkers);assert.ok(r.markers.claimShareWithMarker>0&&r.markers.claimShareWithMarker<=1);assert.ok(r.markers.capturesWithUnknownMarker>=1);
  const gateTotal=Object.values(r.gate.delivery).reduce((a,b)=>a+b,0);assert.equal(gateTotal,11);
  assert.ok(r.gate.delivery.DELIVERED_CLEAN>=1&&r.gate.delivery.WITHHELD>=1&&r.gate.delivery.DELIVERED_LABELLED>=1);
  assert.ok(r.gate.blockingCauses.length>0);for(const c of r.gate.blockingCauses)assert.deepEqual(Object.keys(c),['ref','count']);
  assert.deepEqual(r.gate.gateRecordInvalid,[]);
  // scoring: the same rows scored ungated and gated, content safety on top
  assert.equal(r.scoring.gated.overall.tests,11);assert.equal(r.scoring.ungated.overall.tests,11);assert.equal(r.scoring.contentSafetyV103.overall.tests,11);
  assert.equal(r.scoring.perItem.length,11);assert.deepEqual(r.scoring.perItem.map(p=>p.id),[...r.scoring.perItem.map(p=>p.id)].sort());
  assert.deepEqual(r.scoring.contentSafetyV103.unjudgeable,[]);
  assert.equal(typeof r.scoring.contentSafetyV103.overall.unsafeDeliveredCount,'number');
  assert.equal(r.scoring.textScorer.text,'sinbad-benchmark-scoring/1.0.1');
  for(const p of r.scoring.perItem){assert.ok(chosen.includes(p.id));assert.equal(p.gating,p.id!=='MR-ISM-01');}
  // the text outcome in the report is what the accepted v1.0.1 detectors say about that answer
  const g=T.loadGold();const p=r.scoring.perItem.find(x=>x.id==='CI-01');
  const expected=runner.scoreText('context-isolation',ANSWERS.cited,g.byId.get('CI-01'),g.titleList).outcome;
  assert.equal(p.textOutcome,expected);
  // limits and statement are present
  assert.ok(r.limits.some(l=>l.startsWith('CONTENT_HASH_IS_IDENTITY_ONLY')));assert.ok(r.limits.some(l=>l.startsWith('REPLAY_NOT_PRODUCTION')));assert.match(r.statement,/Aggregate only/u);
});

test('the report never carries a title, answer text, document id, workspace id, capture id, mime type or spoken text',()=>{
  const dir=tmp();synthetic(dir);
  const text=JSON.stringify(T.evaluateDirectory({capturesDir:dir}));
  for(const secret of [TITLE1,TITLE2,'Confidential','Handbook Edition',DOC1,DOC2,WS,'ws-private','application/pdf','spoken text','safety management system','designate a person ashore','Internal audits are annual','general knowledge about shipping','cap-0','cap-1','captureId','spokenSummary'])assert.ok(!text.includes(secret),secret);
  // only enumerations and public gold item ids appear as identifiers
  const ids=new Set([...text.matchAll(/"(?:id|itemId)":"([^"]+)"/gu)].map(m=>m[1]));
  const publicIds=new Set(plan.map(p=>p.id));
  for(const x of ids)assert.ok(publicIds.has(x),x);
});

test('the report is deterministic regardless of file order and carries no clock',()=>{
  const a=tmp(),b=tmp();synthetic(a,1);synthetic(b,-1);
  const ra=T.evaluateDirectory({capturesDir:a}),rb=T.evaluateDirectory({capturesDir:b});
  assert.equal(JSON.stringify(ra),JSON.stringify(rb));assert.equal(ra.reportDigest,rb.reportDigest);
  assert.doesNotMatch(JSON.stringify(ra),/20\d\d-\d\d-\d\dT/u);
  // the digest covers the content: change one answer and it changes
  const c=tmp();synthetic(c,1);write(c,'00.json',rec({captureId:'cap-000',itemId:idsOf('context-isolation')[0],response:resp({answer:ANSWERS.fabricated})}));
  assert.notEqual(T.evaluateDirectory({capturesDir:c}).reportDigest,ra.reportDigest);
});

test('evaluation fails closed: inside the repository, missing, empty, all invalid, too many files',()=>{
  assert.throws(()=>T.evaluateDirectory({capturesDir:path.join(ROOT,'captures-inside-repo')}),/CAPTURES_INSIDE_REPOSITORY/u);
  assert.throws(()=>T.evaluateDirectory({capturesDir:ROOT}),/CAPTURES_INSIDE_REPOSITORY/u);
  const missing=path.join(tmp(),'nope');assert.throws(()=>T.evaluateDirectory({capturesDir:missing}),/CAPTURES_DIRECTORY_MISSING/u);
  assert.throws(()=>T.evaluateDirectory({capturesDir:tmp()}),/NO_VALID_CAPTURES/u);
  const bad=tmp();write(bad,'a.json','{x');write(bad,'b.json',{nope:1});assert.throws(()=>T.evaluateDirectory({capturesDir:bad}),/NO_VALID_CAPTURES/u);
  const many=tmp();for(let i=0;i<T.MAX_FILES+1;i+=1)fs.writeFileSync(path.join(many,`f${i}.json`),'{}');assert.throws(()=>T.evaluateDirectory({capturesDir:many}),/TOO_MANY_CAPTURES/u);
  const big=tmp();write(big,'big.json','x'.repeat(T.MAX_FILE_BYTES+1));write(big,'ok.json',rec({itemId:'CI-01'}));
  const r=T.evaluateDirectory({capturesDir:big});assert.equal(r.intake.invalid.reasons.TOO_LARGE,1);
  // a set in which nothing could be gated still reports, with no scoring, instead of guessing
  const none=tmp();write(none,'a.json',rec({itemId:'CI-01',response:resp({sourceAccess:'restricted',sources:[]})}));
  const rn=T.evaluateDirectory({capturesDir:none});assert.equal(rn.scoring,null);assert.deepEqual(rn.captures.byStatus,{GATED:0,REFUSED:1,ADAPTER_BLOCKED:0,ERROR:0});assert.equal(rn.markers.claimShareWithMarker,null);
});

test('the command line writes the report outside the repository, never overwrites, refuses repository paths',()=>{
  const caps=tmp();synthetic(caps);const out=path.join(tmp(),'out','report.json');
  const run=(...args)=>cp.spawnSync(process.execPath,[path.join(ROOT,'tools','evaluate-shadow-capture.js'),...args],{encoding:'utf8',cwd:ROOT});
  const ok=run('--captures',caps,'--out',out);assert.equal(ok.status,0,ok.stderr);assert.match(ok.stdout,/sinbad-shadow-capture-report\/0-v1: 13 captures/u);
  const report=JSON.parse(fs.readFileSync(out,'utf8'));assert.equal(report.version,E.REPORT_VERSION);assert.equal(report.captures.total,13);
  assert.equal(run('--captures',caps,'--out',out).status,1);
  assert.equal(run('--captures',caps,'--out',path.join(ROOT,'report-should-not-exist.json')).status,1);assert.equal(fs.existsSync(path.join(ROOT,'report-should-not-exist.json')),false);
  assert.equal(run('--captures',path.join(ROOT,'docs'),'--out',path.join(tmp(),'r.json')).status,1);
  assert.equal(run('--captures',caps).status,1);assert.equal(run('--out',out).status,1);assert.equal(run('--captures').status,1);
  assert.equal(run('--captures',tmp(),'--out',path.join(tmp(),'r.json')).status,1);
});

test('the evaluator only composes accepted components: they are unchanged, and it is inert',()=>{
  const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
  const pin=f=>crypto.createHash('sha256').update(read(f).replace(/\r\n/gu,'\n')).digest('hex');
  // pinned (LF-normalised sha256); change only with an Owner-accepted version bump of the component
  const PINNED={
    'sinbad-ai-core/shadow/response-mapper.js':'85742b5dc9d189a4cf6154e40b6fa1d9d9ec889df0f2a1cbec148771e3c30cd6',
    'sinbad-ai-core/shadow/index.js':'b7519da99ceb59e6ce44755fb19a33763b8df42fb8d091ef53270b9a5ed3389f',
    'sinbad-ai-core/adapter/draft-adapter-v0.js':'8bbca9d77ce1c2aab5b8cc488664433dd2796787ada762795f6998757d0fb722',
    'sinbad-ai-core/chain/chain-v0.js':'cc668008a9a11040a8ffed0d2d4b1620511021eecf376c0ba5fc8c7aaed6b68b',
    'tests/benchmark/rev1/scoring-v101.js':'3932a9dd931f5e0fce8777df73e0b6225f700059ae9c32dcb6af988f5f5189ef',
    'tests/benchmark/rev2/scoring-v102.js':'bf9bdea7817a967b7bdf3b2023e4b0eff4188fe9e5721eb2e6e43b12e989e86a',
    'tests/benchmark/rev3/scoring-v103.js':'c29f4c3fa8eefa33cf7240a29033cd6e90a950f70c1446f9db90e394484034cd',
    'tools/grounded-v103-scoring.js':'2a883eaf425d686b0138c8bc2f0e4453dfdad94deaaa4f4124335b85c0f7852f'
  };
  for(const [file,hash] of Object.entries(PINNED))assert.equal(pin(file),hash,`${file} changed`);
  const requires=src=>[...src.matchAll(/require\(['"]([^'"]+)['"]\)/gu)].map(m=>m[1]).sort();
  const core=read('sinbad-ai-core/shadow/capture-evaluator.js'),tool=read('tools/evaluate-shadow-capture.js');
  assert.deepEqual(requires(core),['../adapter/draft-adapter-v0','../authority/exact','../chain/chain-v0','./response-mapper','node:crypto']);
  assert.deepEqual(requires(tool),['../sinbad-ai-core/shadow/capture-evaluator','../tests/benchmark/lib/gold','./rescore-baseline-001','./run-grounded-subset','./sinbad-participation','node:fs','node:path']);
  for(const src of [core,tool]){
    assert.doesNotMatch(src,/node:(?:http|https|net|tls|dns|dgram|child_process)|\bfetch\(|XMLHttpRequest|WebSocket|Date\.now\(|new Date\(|Math\.random|process\.env/u);
    assert.doesNotMatch(src,/['"`][^'"`\n]*(?:engine-room|PROJECT2_STATE|ENGINE_ROOM|app\.js|sw\.js|index\.html)[^'"`\n]*['"`]/u);
  }
  assert.doesNotMatch(core,/node:fs/u);assert.doesNotMatch(core,/\b(?:academy|gasm|zabit|akademi)\b/iu);
  // the only file the tool writes is the report, created exclusively
  assert.equal([...tool.matchAll(/writeFileSync\(/gu)].length,1);assert.match(tool,/flag:'wx'/u);
  assert.doesNotMatch(tool,/sinbad-answer\/functions|supabase|openai/iu);
});
