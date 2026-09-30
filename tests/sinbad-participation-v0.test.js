'use strict';
// SINBAD Active Participation Gate v0. Offline: a fake observer, temp directories and (for the git observer only) a
// throw-away local git repository. No model, no network, nothing written inside the repository.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const P=require('../sinbad-ai-core/participation');
const tool=require('../tools/sinbad-participation');

const ROOT=path.resolve(__dirname,'..');
const HEAD='1'.repeat(40),HEAD2='2'.repeat(40),RESULT='a'.repeat(40);
const T0=Date.parse('2026-09-30T10:00:00.000Z');
const at=min=>new Date(T0+min*60000).toISOString();

function tmp(){return fs.mkdtempSync(path.join(os.tmpdir(),'sinbad-part-'));}
function order(over={}){
  return {taskId:'T-A',kind:'task',title:'Add the widget',origin:'OWNER_DIRECTED',originNote:'',ownerStatement:'Owner: build the widget, nothing else.',agentId:'claude',baseSha:HEAD,branch:'codex/widget',
    expectedFiles:['src/widget.js','tests/widget.test.js'],context:'The widget is missing.',plan:'Write it and test it.',decisions:['Keep it small'],rejectedAlternatives:['Rewrite the module'],hold:false,
    sinbadCapabilityBefore:'SINBAD had no record of this work.',sinbadCapabilityAfter:'SINBAD records and verifies this work.',...over};
}
function report(over={}){
  return {taskId:'T-A',agentId:'claude',baseSha:HEAD,resultingSha:RESULT,branch:'codex/widget',changedFiles:['src/widget.js','tests/widget.test.js'],actions:['wrote the widget'],failures:[],evidence:['commit '+RESULT.slice(0,7)],
    tests:[{name:'widget suite',command:'node --test tests/widget.test.js',reportedOutcome:'PASS'}],result:'Widget added.',lessons:[],decisions:[],rejectedAlternatives:[],capabilityGained:'SINBAD verified this report against git.',reportedAt:at(30),...over};
}
function fakeObserver(state){
  return {
    observeHead(){return state.headUnavailable?{available:false,error:'fake: unavailable'}:{available:true,headSha:state.head,baseShaExists:state.baseExists!==false,dirtyPaths:state.dirty||[]};},
    observeResult(o,r){return state.resultUnavailable?{available:false,error:'fake: unavailable'}:{available:true,resultingShaExists:state.resultExists!==false,baseIsAncestor:state.ancestor!==false,observedChangedFiles:state.changed,branchTip:state.branchTip===undefined?r.resultingSha:state.branchTip};}
  };
}
function mk(){
  const dir=tmp(),repoRoot=path.join(dir,'repo');fs.mkdirSync(repoRoot);
  const state={head:HEAD,changed:['src/widget.js','tests/widget.test.js']};
  const ledger=tool.openLedger({root:path.join(dir,'ledger'),repoRoot});
  const ctx={ledger,observer:fakeObserver(state),now:at(0)};
  return {dir,repoRoot,state,ledger,ctx,reopen:()=>tool.openLedger({root:path.join(dir,'ledger'),repoRoot})};
}
const eventCount=m=>m.ledger.verify().head.eventCount;
function delegated(m,o=order()){
  assert.equal(tool.open(m.ctx,o).ok,true);
  m.ctx.now=at(1);assert.equal(tool.preflight(m.ctx,o.taskId).ok,true);
  m.ctx.now=at(2);assert.equal(tool.delegate(m.ctx,o.taskId).ok,true);
  m.ctx.now=at(30);
}
const shelfDir=m=>path.join(m.dir,'ledger','participation');
const bodiesDir=m=>path.join(m.dir,'ledger','bodies');

test('an invalid task cannot open and leaves no trace',()=>{
  const m=mk();
  const bad=[
    order({sinbadCapabilityBefore:''}),order({sinbadCapabilityAfter:''}),order({sinbadCapabilityAfter:'SINBAD had no record of this work.'}),
    order({expectedFiles:[]}),order({expectedFiles:['../escape.js']}),order({baseSha:'abc'}),order({taskId:'has space'}),order({ownerStatement:''}),order({context:''}),
    order({origin:'RETROACTIVE_BOOTSTRAP',originNote:'short'}),order({agentId:''}),
    order({plan:'password: hunter2hunter2hunter2'}),{...order(),extra:1},{...order(),title:undefined}
  ];
  for(const b of bad){const r=tool.open(m.ctx,b);assert.equal(r.ok,false,JSON.stringify(b).slice(0,80));assert.equal(r.status,'ORDER_REJECTED');}
  assert.equal(tool.open(m.ctx,null).ok,false);
  assert.equal(eventCount(m),0);
  assert.equal(tool.open(m.ctx,order()).ok,true);
  assert.equal(tool.open(m.ctx,order()).status,'TASK_EXISTS');
  assert.equal(eventCount(m),1);
});

test('no delegation without a task, and no task is created by anything but open',()=>{
  const m=mk();
  assert.equal(tool.delegate(m.ctx,'NOPE').status,'TASK_UNKNOWN');
  assert.equal(tool.preflight(m.ctx,'NOPE').status,'TASK_UNKNOWN');
  assert.equal(eventCount(m),0);
  // an agent report for an unknown task is rejected; it does not create a task
  const r=tool.ingest(m.ctx,JSON.stringify(report({taskId:'NOPE'})));
  assert.equal(r.status,'REPORT_REJECTED');assert.deepEqual(r.errors,['TASK_UNKNOWN']);
  assert.equal(m.ledger.view().reduced.tasks.length,0);
});

test('no delegation without a fresh PASS preflight',()=>{
  const m=mk();
  tool.open(m.ctx,order());
  m.ctx.now=at(1);
  let r=tool.delegate(m.ctx,'T-A');
  assert.equal(r.ok,false);assert.ok(r.reasons.includes('NO_PREFLIGHT'));
  // a FAIL preflight does not unlock it either
  m.state.dirty=['src/widget.js'];
  assert.equal(tool.preflight(m.ctx,'T-A').status,'PREFLIGHT_FAIL');
  m.state.dirty=[];
  r=tool.delegate(m.ctx,'T-A');assert.ok(r.reasons.includes('PREFLIGHT_NOT_PASS'));
  // PASS, then time passes beyond the freshness window
  m.ctx.now=at(2);assert.equal(tool.preflight(m.ctx,'T-A').ok,true);
  m.ctx.now=at(2+61);
  r=tool.delegate(m.ctx,'T-A');assert.ok(r.reasons.includes('PREFLIGHT_STALE_TIME'));
  // and a fresh one works, bound to the order
  m.ctx.now=at(70);assert.equal(tool.preflight(m.ctx,'T-A').ok,true);
  m.ctx.now=at(71);assert.equal(tool.delegate(m.ctx,'T-A').ok,true);
  assert.equal(m.ledger.view().reduced.tasks[0].state,'DELEGATED');
});

test('unsafe paths are refused everywhere',()=>{
  for(const bad of ['','../x','a/../b','/abs','C:\\x','a\\b','.git/config','a/.git/x','a/./b','src//x','*.js','src/[a].js','~/x','x\u0000y','x\ny','a/'.repeat(200)])assert.equal(P.normalizePath(bad),null,JSON.stringify(bad));
  assert.equal(P.normalizePath('src/a.js'),'src/a.js');assert.equal(P.normalizePath('src/'),'src/');
  const m=mk();
  assert.equal(tool.open(m.ctx,order({expectedFiles:['ok.js','.git/HEAD']})).ok,false);
  // a report may not name an unsafe or directory path either
  tool.open(m.ctx,order());delegated.call(null,m,order({taskId:'T-B',expectedFiles:['other.js']}));
  assert.equal(tool.ingest(m.ctx,JSON.stringify(report({taskId:'T-B',changedFiles:['../escape']}))).status,'REPORT_REJECTED');
  assert.equal(tool.ingest(m.ctx,JSON.stringify(report({taskId:'T-B',changedFiles:['dir/']}))).status,'REPORT_REJECTED');
});

test('exact path overlap fails, earlier task keeps the claim',()=>{
  const m=mk();
  tool.open(m.ctx,order());
  tool.open(m.ctx,order({taskId:'T-B',agentId:'grok',branch:'codex/other',expectedFiles:['src/widget.js','docs/x.md']}));
  m.ctx.now=at(1);
  const b=tool.preflight(m.ctx,'T-B');
  assert.equal(b.ok,false);assert.match(b.decision.reasons.join(' '),/EXACT_OVERLAP with T-A: src\/widget\.js/u);
  assert.equal(tool.preflight(m.ctx,'T-A').ok,true);
});

test('directory-prefix overlap fails (both directions, case-insensitive)',()=>{
  const m=mk();
  tool.open(m.ctx,order({expectedFiles:['tools/']}));
  tool.open(m.ctx,order({taskId:'T-B',branch:'codex/b',expectedFiles:['Tools/run.js']}));
  m.ctx.now=at(1);
  const b=tool.preflight(m.ctx,'T-B');
  assert.equal(b.ok,false);assert.match(b.decision.reasons.join(' '),/PREFIX_OVERLAP with T-A/u);
  assert.equal(P.overlapKind('a/b/','a/b/c.js'),'PREFIX');assert.equal(P.overlapKind('a/b','a/bc.js'),null);assert.equal(P.overlapKind('a/b/','a/bc/x'),null);
});

test('disjoint tasks pass and can both be delegated; a closed task stops claiming',()=>{
  const m=mk();
  tool.open(m.ctx,order());
  tool.open(m.ctx,order({taskId:'T-B',agentId:'grok',branch:'codex/b',expectedFiles:['engine/room.js']}));
  m.ctx.now=at(1);
  assert.equal(tool.preflight(m.ctx,'T-A').ok,true);assert.equal(tool.preflight(m.ctx,'T-B').ok,true);
  m.ctx.now=at(2);
  assert.equal(tool.delegate(m.ctx,'T-A').ok,true);assert.equal(tool.delegate(m.ctx,'T-B').ok,true);
  // closing T-A releases its files for a later task
  m.ctx.now=at(30);
  assert.equal(tool.ingest(m.ctx,JSON.stringify(report())).status,'REPORT_INGESTED');
  tool.open(m.ctx,order({taskId:'T-C',branch:'codex/c'}));
  m.ctx.now=at(31);
  assert.equal(tool.preflight(m.ctx,'T-C').ok,true);
});

test('a HOLD task cannot be delegated and does not block others',()=>{
  const m=mk();
  tool.open(m.ctx,order({hold:true}));
  m.ctx.now=at(1);
  const p=tool.preflight(m.ctx,'T-A');
  assert.equal(p.ok,false);assert.ok(p.decision.reasons.some(r=>r.startsWith('NOT_ON_HOLD')));
  const d=tool.delegate(m.ctx,'T-A');
  assert.equal(d.ok,false);assert.ok(d.reasons.includes('TASK_ON_HOLD'));
  assert.equal(m.ledger.view().reduced.tasks[0].state,'HOLD');
  tool.open(m.ctx,order({taskId:'T-B',branch:'codex/b'}));
  m.ctx.now=at(2);
  assert.equal(tool.preflight(m.ctx,'T-B').ok,true);
});

test('a moved head invalidates a PASS preflight; a stale base fails preflight',()=>{
  const m=mk();
  tool.open(m.ctx,order());
  m.ctx.now=at(1);assert.equal(tool.preflight(m.ctx,'T-A').ok,true);
  m.state.head=HEAD2;m.ctx.now=at(2);
  const d=tool.delegate(m.ctx,'T-A');
  assert.equal(d.ok,false);assert.ok(d.reasons.includes('PREFLIGHT_STALE_HEAD'));
  const p=tool.preflight(m.ctx,'T-A');
  assert.equal(p.ok,false);assert.match(p.decision.reasons.join(' '),/BASE_SHA_FRESH/u);
  m.state.head=HEAD;m.state.baseExists=false;
  assert.match(tool.preflight(m.ctx,'T-A').decision.reasons.join(' '),/BASE_SHA_EXISTS/u);
});

test('a dirty worktree inside the expected scope fails preflight; dirt elsewhere does not',()=>{
  const m=mk();
  tool.open(m.ctx,order());
  m.state.dirty=['unrelated/file.txt'];m.ctx.now=at(1);
  assert.equal(tool.preflight(m.ctx,'T-A').ok,true);
  m.state.dirty=['src/widget.js'];m.ctx.now=at(2);
  assert.match(tool.preflight(m.ctx,'T-A').decision.reasons.join(' '),/WORKTREE_CLEAN_IN_SCOPE:dirty path src\/widget\.js/u);
});

test('an unavailable observation fails closed in preflight, delegation and ingestion',()=>{
  const m=mk();
  tool.open(m.ctx,order());
  m.state.headUnavailable=true;m.ctx.now=at(1);
  const p=tool.preflight(m.ctx,'T-A');
  assert.equal(p.ok,false);assert.match(p.decision.reasons.join(' '),/OBSERVATION_AVAILABLE/u);assert.equal(p.decision.decision,'FAIL');
  assert.equal(P.decidePreflight({order:order(),now:at(1),observation:null,others:[]}).decision,'FAIL');
  assert.equal(P.decidePreflight({order:order(),now:at(1),observation:{available:true,headSha:HEAD,baseShaExists:true,dirtyPaths:[]},others:undefined}).decision,'FAIL');
  m.state.headUnavailable=false;m.ctx.now=at(2);assert.equal(tool.preflight(m.ctx,'T-A').ok,true);
  m.ctx.now=at(3);m.state.headUnavailable=true;
  assert.ok(tool.delegate(m.ctx,'T-A').reasons.includes('OBSERVATION_UNAVAILABLE'));
  m.state.headUnavailable=false;m.ctx.now=at(4);assert.equal(tool.delegate(m.ctx,'T-A').ok,true);
  m.state.resultUnavailable=true;m.ctx.now=at(30);
  const i=tool.ingest(m.ctx,JSON.stringify(report()));
  assert.equal(i.ok,false);assert.equal(i.status,'REPORT_OBSERVATION_UNAVAILABLE');
  assert.equal(m.ledger.view().reduced.tasks[0].state,'DELEGATED');
});

test('an out-of-scope change is a SCOPE_BREACH and fails closed, even if the agent did not report it',()=>{
  const m=mk();delegated(m);
  m.state.changed=['src/widget.js','tests/widget.test.js','config/argos-integrity-policy.json'];
  const i=tool.ingest(m.ctx,JSON.stringify(report({changedFiles:['src/widget.js','tests/widget.test.js']})));
  assert.equal(i.ok,false);assert.equal(i.status,'REPORT_SCOPE_BREACH');
  assert.deepEqual(i.verification.scopeBreach,['config/argos-integrity-policy.json']);
  // the concealed file also contradicts the report's own list
  assert.ok(i.verification.claims.some(c=>c.kind==='git.changed_files'&&c.label==='CONTRADICTED'));
  assert.equal(m.ledger.view().reduced.tasks[0].state,'BREACHED');
  // honest reporting of the same breach is still a breach
  m.ctx.now=at(31);
  const j=tool.ingest(m.ctx,JSON.stringify(report({changedFiles:['config/argos-integrity-policy.json','src/widget.js','tests/widget.test.js']})));
  assert.equal(j.status,'REPORT_SCOPE_BREACH');
  // a directory entry in expectedFiles covers files below it
  const m2=mk();delegated(m2,order({expectedFiles:['src/']}));m2.state.changed=['src/deep/x.js'];
  assert.equal(tool.ingest(m2.ctx,JSON.stringify(report({changedFiles:['src/deep/x.js']}))).status,'REPORT_INGESTED');
});

test('a nonexistent resulting SHA, a wrong ancestry or a wrong identity fails',()=>{
  const m=mk();delegated(m);
  m.state.resultExists=false;
  let i=tool.ingest(m.ctx,JSON.stringify(report()));
  assert.equal(i.ok,false);assert.equal(i.status,'REPORT_CONTRADICTED');
  assert.equal(i.verification.claims.find(c=>c.kind==='git.resulting_sha_exists').label,'CONTRADICTED');
  assert.notEqual(m.ledger.view().reduced.tasks[0].state,'CLOSED');
  m.state.resultExists=true;m.state.ancestor=false;m.ctx.now=at(31);
  i=tool.ingest(m.ctx,JSON.stringify(report()));assert.equal(i.status,'REPORT_CONTRADICTED');
  m.state.ancestor=true;m.ctx.now=at(32);
  i=tool.ingest(m.ctx,JSON.stringify(report({agentId:'grok'})));
  assert.equal(i.status,'REPORT_CONTRADICTED');assert.equal(i.verification.claims.find(c=>c.kind==='report.agentId').label,'CONTRADICTED');
  m.ctx.now=at(33);
  i=tool.ingest(m.ctx,JSON.stringify(report({branch:'codex/other'})));assert.equal(i.status,'REPORT_CONTRADICTED');
  m.state.branchTip='f'.repeat(40);m.ctx.now=at(34);
  assert.equal(tool.ingest(m.ctx,JSON.stringify(report())).status,'REPORT_CONTRADICTED');
  // a corrected report after contradictions can still close the task
  m.state.branchTip=undefined;m.ctx.now=at(35);
  assert.equal(tool.ingest(m.ctx,JSON.stringify(report())).status,'REPORT_INGESTED');
});

test('a tampered or truncated-in-the-middle shelf fails closed',()=>{
  const m=mk();delegated(m);tool.ingest(m.ctx,JSON.stringify(report()));
  assert.doesNotThrow(()=>m.ledger.view());
  const files=fs.readdirSync(shelfDir(m)).sort();
  const victim=path.join(shelfDir(m),files[1]);
  const original=fs.readFileSync(victim,'utf8');
  const rec=JSON.parse(original);rec.outcome='forged';fs.writeFileSync(victim,`${JSON.stringify(rec)}\n`);
  assert.throws(()=>m.ledger.view(),/LEDGER_INVALID/u);
  assert.throws(()=>tool.summary(m.ctx),/LEDGER_INVALID/u);
  assert.throws(()=>tool.open(m.ctx,order({taskId:'T-Z'})),/LEDGER_INVALID/u);
  fs.writeFileSync(victim,original);assert.doesNotThrow(()=>m.ledger.view());
  fs.unlinkSync(path.join(shelfDir(m),files[0]));
  assert.throws(()=>m.ledger.view(),/LEDGER_INVALID/u);
});

test('a missing or tampered body fails closed; bodies are created exclusively',()=>{
  const m=mk();delegated(m);
  const bodies=fs.readdirSync(bodiesDir(m));
  assert.ok(bodies.length>=3);
  const file=path.join(bodiesDir(m),bodies[0]);
  const original=fs.readFileSync(file,'utf8');
  fs.writeFileSync(file,original.replace('"','"x'));
  assert.throws(()=>m.ledger.view(),/LEDGER_INVALID:(BODY_TAMPERED|BODY_UNREADABLE)/u);
  fs.writeFileSync(file,original);assert.doesNotThrow(()=>m.ledger.view());
  fs.unlinkSync(file);
  assert.throws(()=>m.ledger.view(),/LEDGER_INVALID:BODY_MISSING/u);
  fs.writeFileSync(file,original);
  // appending the same body again must not overwrite a tampered file of that name
  const body={schema:'x',v:1},hash=P.bodyHash(body);
  m.ledger.append({kind:'report.rejected',outcome:'rejected',now:at(40),body});
  fs.writeFileSync(path.join(bodiesDir(m),`${hash}.json`),'{"schema":"x","v":2}\n');
  assert.throws(()=>m.ledger.append({kind:'report.rejected',outcome:'rejected',now:at(41),body}),/BODY_TAMPERED/u);
});

test('a duplicate event append fails',()=>{
  const m=mk();
  const args={kind:'report.rejected',outcome:'rejected',now:at(5),body:{schema:'sinbad-report-rejection/0-v1',taskId:null,errors:['X'],reportSha256:'0'.repeat(64),at:at(5)}};
  m.ledger.append(args);
  assert.throws(()=>m.ledger.append(args),/ARGOS_SHELF_DUPLICATE_EVENT/u);
  assert.equal(eventCount(m),1);
});

test('an agent assertion never becomes VERIFIED; identity and self-reported results stay UNVERIFIED',()=>{
  const m=mk();delegated(m);
  const i=tool.ingest(m.ctx,JSON.stringify(report({failures:['one flaky test'],lessons:['read the diff first'],decisions:['kept it small'],rejectedAlternatives:['a rewrite']})));
  assert.equal(i.status,'REPORT_INGESTED');
  for(const c of i.verification.claims){
    if(c.kind.startsWith('agent.')||c.kind.startsWith('report.')||c.kind==='test')assert.equal(c.label,'UNVERIFIED',`${c.kind} ${c.statement}`);
  }
  const verified=i.verification.claims.filter(c=>c.label==='VERIFIED').map(c=>c.kind).sort();
  assert.deepEqual(verified,['git.base_is_ancestor','git.branch_tip','git.changed_files','git.resulting_sha_exists','scope.expected_files']);
  const s=tool.summary(m.ctx);
  const inSection=(name)=>s.facts.filter(f=>f.section===name).map(f=>f.label+' '+f.value).join('\n');
  assert.match(inSection('UNVERIFIED AGENT CLAIMS'),/agent\.result/u);
  assert.match(inSection('UNVERIFIED AGENT CLAIMS'),/agent\.capabilityGained/u);
  assert.doesNotMatch(inSection('VERIFIED FACTS'),/Widget added|widget suite/u);
});

test('an agent-reported test PASS is never a verified PASS without independent evidence',()=>{
  const m=mk();delegated(m);
  const i=tool.ingest(m.ctx,JSON.stringify(report()));
  const t=i.verification.claims.find(c=>c.kind==='test');
  assert.equal(t.label,'UNVERIFIED');assert.match(t.statement,/AGENT_REPORTED_PASS/u);
  const o=P.validateOrder(order()).order,r=P.validateReport(report()).report;
  const obs={available:true,resultingShaExists:true,baseIsAncestor:true,observedChangedFiles:['src/widget.js','tests/widget.test.js'],branchTip:RESULT};
  const run=ev=>P.verifyReport({order:o,report:r,observation:obs,independentTestEvidence:ev}).claims.find(c=>c.kind==='test');
  assert.equal(run(undefined).label,'UNVERIFIED');assert.equal(run([]).label,'UNVERIFIED');
  for(const bad of [{name:'widget suite',resultingSha:RESULT,outcome:'PASS',source:'AGENT'},{name:'widget suite',resultingSha:HEAD,outcome:'PASS',source:'CI_RUN_VERIFIED'},{name:'other',resultingSha:RESULT,outcome:'PASS',source:'CI_RUN_VERIFIED'},{name:'widget suite',resultingSha:RESULT,outcome:'FAIL',source:'CI_RUN_VERIFIED'}])assert.equal(run([bad]).label,'UNVERIFIED');
  assert.equal(run([{name:'widget suite',resultingSha:RESULT,outcome:'PASS',source:'CI_RUN_VERIFIED'}]).label,'VERIFIED');
  // a reported FAIL or NOT_RUN is never elevated either
  const f=P.validateReport(report({tests:[{name:'widget suite',command:'x',reportedOutcome:'FAIL'}]})).report;
  assert.equal(P.verifyReport({order:o,report:f,observation:obs,independentTestEvidence:[{name:'widget suite',resultingSha:RESULT,outcome:'PASS',source:'CI_RUN_VERIFIED'}]}).claims.find(c=>c.kind==='test').label,'UNVERIFIED');
});

test('the Owner summary is deterministic and renders missing information as NOT RECORDED',()=>{
  const m=mk();
  tool.open(m.ctx,order());
  const empty=tool.summary(m.ctx);
  assert.match(empty.text,/preflight: NOT RECORDED/u);assert.match(empty.text,/delegation: NOT RECORDED/u);assert.match(empty.text,/agent report: NOT RECORDED/u);assert.match(empty.text,/failures: NOT RECORDED/u);
  m.ctx.now=at(1);tool.preflight(m.ctx,'T-A');m.ctx.now=at(2);tool.delegate(m.ctx,'T-A');m.ctx.now=at(30);tool.ingest(m.ctx,JSON.stringify(report()));
  const a=tool.summary(m.ctx),b=tool.summary(m.ctx);
  const c=tool.summary({...m.ctx,ledger:m.reopen()});
  assert.equal(a.text,b.text);assert.equal(a.text,c.text);
  for(const section of P.SECTIONS)assert.ok(a.text.includes(`## ${section}`),section);
  assert.match(a.text,/failures \(agent report\): NOT RECORDED/u);
  assert.match(a.text,/lessons \(agent report\): NOT RECORDED/u);
});

function pointer(body,ptr){return ptr.split('/').slice(1).reduce((v,k)=>v[k],body);}
test('every fact of the summary traces to a stored event and body',()=>{
  const m=mk();delegated(m);
  tool.ingest(m.ctx,JSON.stringify(report({failures:['a failure'],lessons:['a lesson'],decisions:['a decision'],rejectedAlternatives:['an alternative']})));
  tool.open(m.ctx,order({taskId:'T-B',agentId:'grok',branch:'codex/b',expectedFiles:['x/y.js'],hold:true}));
  tool.ingest(m.ctx,'{not json');
  const s=tool.summary(m.ctx);
  const view=m.ledger.view(),byHash=new Map(view.entries.map(e=>[e.eventHash,e]));
  assert.ok(s.facts.length>30);
  for(const f of s.facts){
    const e=byHash.get(f.eventHash);assert.ok(e,`event ${f.eventHash}`);
    assert.equal(e.bodyHash,f.bodyHash);
    const stored=JSON.parse(fs.readFileSync(path.join(bodiesDir(m),`${f.bodyHash}.json`),'utf8'));
    assert.equal(P.bodyHash(stored),f.bodyHash);
    if(f.pointer!==null){assert.equal(f.derived,false);assert.equal(String(pointer(stored,f.pointer)),f.value,`${f.label}`);}
    else assert.equal(f.derived,true);
  }
  const bullets=s.text.split('\n').filter(l=>l.startsWith('- ['));
  assert.equal(bullets.length,s.facts.length);
  for(const l of bullets)assert.match(l,/\{ev [0-9a-f]{12}\}$/u);
  assert.match(s.text,/a failure/u);
});

test('capability delta is required at open and in every report; a report without it is rejected and stored without its content',()=>{
  const m=mk();delegated(m);
  const raw=JSON.stringify(report({capabilityGained:''}));
  const r=tool.ingest(m.ctx,raw);
  assert.equal(r.status,'REPORT_REJECTED');assert.ok(r.errors.includes('CAPABILITY_GAINED_MISSING'));
  assert.equal(m.ledger.view().reduced.tasks[0].state,'DELEGATED');
  const stored=fs.readdirSync(bodiesDir(m)).map(f=>fs.readFileSync(path.join(bodiesDir(m),f),'utf8')).join('\n');
  assert.ok(stored.includes(P.sha256(raw)));assert.ok(!stored.includes('Widget added.'));
  for(const key of ['sinbadCapabilityBefore','sinbadCapabilityAfter']){const o=order();delete o[key];assert.equal(tool.open(mk().ctx,o).ok,false);}
  const miss=report();delete miss.capabilityGained;assert.equal(tool.ingest(m.ctx,JSON.stringify(miss)).status,'REPORT_REJECTED');
  // missing fields are never filled in
  const partial=report();delete partial.tests;assert.ok(tool.ingest(m.ctx,JSON.stringify(partial)).errors.includes('REPORT_KEYS_NOT_EXACT'));
});

test('ingestion only accepts reports for delegated tasks (or an explicit retroactive bootstrap)',()=>{
  const m=mk();
  tool.open(m.ctx,order());
  assert.deepEqual(tool.ingest(m.ctx,JSON.stringify(report())).errors,['TASK_NOT_DELEGATED:OPEN']);
  const retro=order({taskId:'T-0',origin:'RETROACTIVE_BOOTSTRAP',originNote:'Claude implemented the mechanism before it existed; this task was recorded afterwards.'});
  assert.equal(tool.open(m.ctx,retro).ok,true);
  const i=tool.ingest(m.ctx,JSON.stringify(report({taskId:'T-0',branch:'codex/widget'})));
  assert.equal(i.status,'REPORT_INGESTED');
  const s=tool.summary(m.ctx);
  assert.match(s.text,/RETROACTIVE_BOOTSTRAP - Claude implemented the mechanism before it existed/u);
  assert.match(s.text,/\[T-0\] preflight: NOT RECORDED/u);assert.match(s.text,/\[T-0\] delegation: NOT RECORDED/u);
});

test('storage must be outside the repository and never on git internals or another runtime directory',()=>{
  const dir=tmp(),repoRoot=path.join(dir,'repo');fs.mkdirSync(repoRoot);
  assert.throws(()=>tool.openLedger({root:path.join(repoRoot,'ledger'),repoRoot}),/STORAGE_INSIDE_REPOSITORY/u);
  assert.throws(()=>tool.openLedger({root:repoRoot,repoRoot}),/STORAGE_INSIDE_REPOSITORY/u);
  assert.throws(()=>tool.openLedger({root:dir,repoRoot}),/STORAGE_CONTAINS_REPOSITORY/u);
  assert.throws(()=>tool.openLedger({root:path.join(dir,'x','.git','ledger'),repoRoot}),/STORAGE_PATH_RESERVED/u);
  assert.throws(()=>tool.openLedger({root:path.join(dir,'.argos-runtime','ledger'),repoRoot}),/STORAGE_PATH_RESERVED/u);
  assert.throws(()=>tool.openLedger({root:'relative/ledger',repoRoot}),/STORAGE_PATH_NOT_ABSOLUTE/u);
  assert.throws(()=>tool.openLedger({root:path.join(ROOT,'ledger-inside-real-repo')}),/STORAGE_INSIDE_REPOSITORY/u);
  assert.equal(fs.existsSync(path.join(ROOT,'ledger-inside-real-repo')),false);
  assert.throws(()=>tool.assertOutsideRepository(path.join(ROOT,'out.md'),ROOT,'OUTPUT_INSIDE_REPOSITORY'),/OUTPUT_INSIDE_REPOSITORY/u);
  assert.match(tool.defaultRoot(),/Sinbad[\\/]participation-ledger$/u);
  assert.doesNotThrow(()=>tool.assertOutsideRepository(tool.defaultRoot()));
});

test('secrets never enter the ledger',()=>{
  const m=mk();
  for(const s of ['password: abcdefghijkl1234','token=ghp_'+'a'.repeat(36),'Authorization: Bearer '+'x'.repeat(30),'-----BEGIN PRIVATE KEY-----','sb_secret_'+'a'.repeat(20),'sk-'+'a'.repeat(30),'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop']){
    assert.ok(P.secretFinding(s),s);
    assert.equal(tool.open(m.ctx,order({context:s})).ok,false);
    assert.throws(()=>m.ledger.append({kind:'report.rejected',outcome:'rejected',now:at(50),body:{schema:'x',note:s}}),/SECRET_IN_BODY/u);
  }
  assert.equal(P.secretFinding('an ordinary sentence about tokens and passwords'),null);
  delegated(m);
  assert.ok(tool.ingest(m.ctx,JSON.stringify(report({lessons:['the key was sk-'+'b'.repeat(30)]}))).errors.some(e=>e.startsWith('SECRET_PATTERN')));
});

function git(cwd,args){const r=cp.spawnSync('git',['-c','user.name=t','-c','user.email=t@example.invalid','-c','commit.gpgsign=false',...args],{cwd,encoding:'utf8'});assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);return r.stdout.trim();}
test('the git observer reads head, dirt, ancestry, changed files and the branch tip locally',()=>{
  const dir=tmp();const repo=path.join(dir,'r');fs.mkdirSync(repo);
  git(repo,['init','-q']);fs.writeFileSync(path.join(repo,'a.txt'),'a');git(repo,['add','.']);git(repo,['commit','-q','-m','a']);
  const base=git(repo,['rev-parse','HEAD']);git(repo,['update-ref','refs/remotes/origin/main',base]);
  git(repo,['checkout','-q','-b','work']);fs.mkdirSync(path.join(repo,'src'));fs.writeFileSync(path.join(repo,'src','w.js'),'w');fs.writeFileSync(path.join(repo,'a.txt'),'a2');git(repo,['add','.']);git(repo,['commit','-q','-m','b']);
  const result=git(repo,['rev-parse','HEAD']);
  const obs=tool.gitObserver({repoRoot:repo});
  const o={baseSha:base,branch:'work'};
  fs.writeFileSync(path.join(repo,'dirty.txt'),'d');
  const head=obs.observeHead(o);
  assert.equal(head.available,true);assert.equal(head.headSha,base);assert.equal(head.baseShaExists,true);assert.ok(head.dirtyPaths.includes('dirty.txt'));
  assert.equal(obs.observeHead({baseSha:'9'.repeat(40),branch:'work'}).baseShaExists,false);
  const res=obs.observeResult(o,{resultingSha:result});
  assert.deepEqual([res.available,res.resultingShaExists,res.baseIsAncestor,res.branchTip],[true,true,true,result]);
  assert.deepEqual([...res.observedChangedFiles].sort(),['a.txt','src/w.js']);
  assert.equal(obs.observeResult(o,{resultingSha:'8'.repeat(40)}).resultingShaExists,false);
  assert.equal(obs.observeResult({baseSha:base,branch:'nope'},{resultingSha:result}).branchTip,null);
  assert.equal(obs.observeResult({baseSha:result,branch:'work'},{resultingSha:base}).baseIsAncestor,false);
  // a directory that is not a repository, or a missing base ref, is an unavailable observation
  assert.equal(tool.gitObserver({repoRoot:dir}).observeHead(o).available,false);
  assert.equal(tool.gitObserver({repoRoot:repo,baseRef:'origin/missing'}).observeHead(o).available,false);
  assert.deepEqual(tool.parseDirty(' M a.txt\0R  new.txt\0old.txt\0?? x.txt\0'),['a.txt','new.txt','old.txt','x.txt']);
  // end to end against the real git observer
  const ledger=tool.openLedger({root:path.join(dir,'ledger'),repoRoot:repo});
  const ctx={ledger,observer:tool.gitObserver({repoRoot:repo}),now:at(0)};
  fs.unlinkSync(path.join(repo,'dirty.txt'));
  assert.equal(tool.open(ctx,order({baseSha:base,branch:'work',expectedFiles:['a.txt','src/']})).ok,true);
  ctx.now=at(1);assert.equal(tool.preflight(ctx,'T-A').ok,true);
  ctx.now=at(2);assert.equal(tool.delegate(ctx,'T-A').ok,true);
  ctx.now=at(3);
  const done=tool.ingest(ctx,JSON.stringify(report({baseSha:base,resultingSha:result,branch:'work',changedFiles:['a.txt','src/w.js']})));
  assert.equal(done.status,'REPORT_INGESTED');
  assert.equal(done.verification.counts.VERIFIED,5);
});

test('the command line refuses bad input and prints the summary of an empty ledger',()=>{
  const dir=tmp(),root=path.join(dir,'ledger');
  const run=(...args)=>cp.spawnSync(process.execPath,[path.join(ROOT,'tools','sinbad-participation.js'),...args,'--root',root],{encoding:'utf8',cwd:ROOT});
  const bad=path.join(dir,'bad.json');fs.writeFileSync(bad,JSON.stringify(order({sinbadCapabilityAfter:''})));
  assert.equal(run('open','--order',bad).status,2);
  assert.equal(run('nonsense').status,1);
  assert.equal(run('delegate').status,1);
  const good=path.join(dir,'good.json');fs.writeFileSync(good,JSON.stringify(order()));
  const opened=run('open','--order',good);assert.equal(opened.status,0);assert.equal(JSON.parse(opened.stdout).status,'OPENED');
  assert.equal(run('delegate','--task','T-A').status,2);
  const s=run('summary');assert.equal(s.status,0);assert.match(s.stdout,/SINBAD Owner Work Summary/u);assert.match(s.stdout,/Add the widget/u);
  const inside=run('summary','--out',path.join(ROOT,'summary-should-not-exist.md'));assert.equal(inside.status,1);assert.equal(fs.existsSync(path.join(ROOT,'summary-should-not-exist.md')),false);
});

test('the gate is inert: pure module without I/O, no network or model, no writes into the repository, accepted components unchanged',()=>{
  const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
  const pure=read('sinbad-ai-core/participation/participation-v0.js'),toolSrc=read('tools/sinbad-participation.js');
  const requires=src=>[...src.matchAll(/require\(['"]([^'"]+)['"]\)/gu)].map(m=>m[1]).sort();
  assert.deepEqual(requires(pure),['node:crypto']);
  assert.deepEqual(requires(toolSrc),['../sinbad-ai-core/argos-event-shelf','../sinbad-ai-core/participation','node:child_process','node:fs','node:os','node:path']);
  for(const src of [pure,toolSrc]){
    assert.doesNotMatch(src,/node:(?:http|https|net|tls|dns|dgram)|\bfetch\(|XMLHttpRequest|WebSocket|Date\.now\(/u);
    // no string in either file names Engine Room, another state file or a live application file
    assert.doesNotMatch(src,/['"`][^'"`\n]*(?:engine-room|PROJECT2_STATE|ENGINE_ROOM|app\.js|sw\.js|index\.html)[^'"`\n]*['"`]/u);
  }
  assert.doesNotMatch(pure,/new Date\(/u);
  // read-only git: no subcommand that changes the repository, its remotes or its refs
  assert.doesNotMatch(toolSrc,/run\(\['(?:push|pull|fetch|commit|checkout|reset|clean|rebase|add|merge|tag|stash|branch|config|remote|gc|rm|mv)'/u);
  assert.doesNotMatch(pure,/\b(?:academy|gasm|zabit|akademi)\b/iu);
  // the ARGOS shelf this gate reuses and the accepted Project 2 components: pinned (LF-normalised sha256);
  // change only together with an Owner-accepted version bump
  const pin=f=>crypto.createHash('sha256').update(read(f).replace(/\r\n/gu,'\n')).digest('hex');
  const PINNED={
    'sinbad-ai-core/argos-event-shelf.js':'151410b2524a78038c8b71fed99ce8d207a6ce0cd871a79a4f979f83952fadfc',
    'sinbad-ai-core/sentinel/sentinel-v0.js':'ad2003f3dac02b5eabd88097b0d88acb6b59e9aedc8c70eca2fb13ea7cb1dda0',
    'sinbad-ai-core/gatekeeper/gatekeeper-v0.js':'6c84b525c69b76c58eddd6b0bab8571769f711cc6c6687d33d3e251034983c23',
    'sinbad-ai-core/copilot/copilot-v0.js':'efffa292d8e4323bbe7fcda2c611fa9d50c602b2b80a1a85ddbb516de68336fd',
    'sinbad-ai-core/pilot/pilot-v0.js':'646be899015112b7d8975bbc8236e17f4f0580f801436ee799bc30f110c3df7e',
    'sinbad-ai-core/chain/chain-v0.js':'cc668008a9a11040a8ffed0d2d4b1620511021eecf376c0ba5fc8c7aaed6b68b',
    'sinbad-ai-core/attest/attest-v0.js':'3949dabf002ebe3481fd467928236dbd06897b0c7eb03775d6dcb964829f8501'
  };
  for(const [file,hash] of Object.entries(PINNED))assert.equal(pin(file),hash,`${file} changed`);
});
