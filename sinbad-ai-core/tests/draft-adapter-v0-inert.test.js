'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const component=require('../adapter/index.js');
const authority=require('../authority/index.js');
const chainComponent=require('../chain/index.js');
const {d,input}=require('./helpers/draft-adapter-v0-builders.js');
const dir=path.join(__dirname,'..','adapter');
const OTHERS=['authority','sentinel','gatekeeper','copilot','pilot','chain','attest'];

test('Draft Adapter v0 is inert: no I/O, clock, randomness, network, model, state, interpretation, rewriting, execution, approval or grant; not wired',()=>{
  const m=component.MANIFEST;
  assert.equal(m.status,'INERT_COMPONENT');assert.equal(m.role,'FREE_TEXT_TO_STRUCTURED_DRAFT');
  for(const flag of ['performsIo','interprets','rewrites','executes','approves','keepsState','callsModel','grantsAuthority'])assert.equal(m[flag],false,flag);
  assert.equal(m.authority,'NONE');assert.deepEqual([...m.wiredInto],[]);assert.equal(m.contracts,authority.MANIFEST.version);assert.equal(m.feeds,chainComponent.MANIFEST.modules.input);
  assert.equal(Object.isFrozen(m),true);assert.deepEqual(Object.keys(component),['MANIFEST','adapter']);assert.equal(component.adapter,d);
  for(const file of fs.readdirSync(dir)){
    const source=fs.readFileSync(path.join(dir,file),'utf8');
    assert.doesNotMatch(source,/require\(['"](?:node:)?(?:fs|http|https|net|child_process|worker_threads|dgram|os|vm|cluster|readline|tls|dns|crypto)['"]\)/u,`${file} must not import I/O, execution or crypto modules directly`);
    assert.doesNotMatch(source,/\bfetch\(|process\.env|process\.argv|setTimeout\(|setInterval\(|setImmediate\(|Date\.now\(|new Date\(|Math\.random\(/u,`${file} must not perform I/O, scheduling, clock reads or randomness`);
    assert.doesNotMatch(source,/academy|gasm|zabit|akademi/iu,`${file} must not embed product identity`);
    assert.doesNotMatch(source,/\bollama\b|\bqwen\b|\bopenai\b|31983|localhost/iu,`${file} must not reference a live runtime or model`);
    assert.doesNotMatch(source,/\bglobalThis\b|\bglobal\./u,`${file} must not reach for global state`);
  }
  const source=fs.readFileSync(path.join(dir,'draft-adapter-v0.js'),'utf8');
  assert.deepEqual([...source.matchAll(/require\('([^']+)'\)/gu)].map(x=>x[1]).sort(),['../authority/evidence-set','../authority/exact','../authority/task-context','../gatekeeper/gatekeeper-v0','../sentinel/sentinel-v0','./disclaimer-screen']);
  // It uses the gate's draft parser and Sentinel's hash, limits and pattern; it never runs either.
  assert.deepEqual([...new Set(source.match(/\bgatekeeper\.\w+/gu))],['gatekeeper.draft']);assert.deepEqual([...new Set(source.match(/\bsentinel\.\w+/gu))].sort(),['sentinel.MAX_CLAIMS','sentinel.SPECIFIC_VALUE']);
  assert.doesNotMatch(source,/\.observe\(|\.review\(|\.decide\(|\.rehearse\(|\.attest\(|\.check\(/u);
  // It never marks a sentence as reported speech: that would relax the checks on it.
  assert.doesNotMatch(source,/'REPORTED'/u);
});

test('the accepted components are consumed unchanged, stay unwired and do not import the adapter',()=>{
  for(const other of OTHERS){
    assert.deepEqual([...require(`../${other}/index.js`).MANIFEST.wiredInto],[],other);
    for(const file of fs.readdirSync(path.join(__dirname,'..',other)))assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'..',other,file),'utf8'),/\.\.\/adapter\b|draft-adapter/u,`${other}/${file} must not import Draft Adapter v0`);
  }
});

test('no live path or package surface imports Draft Adapter v0',()=>{
  const root=path.join(__dirname,'..','..');
  const liveFiles=['app.js','academy-classroom-window.js','academy-owner-training.js','exam-review.js','sinbad-core.js','core-decision.js','bridge/sinbad-bridge.ps1','supabase/functions/sinbad-answer/index.ts','supabase/functions/academy-training/index.ts','supabase/functions/human-review/index.ts','tools/run-sinbad-benchmark.js'];
  for(const file of liveFiles){const full=path.join(root,file);if(!fs.existsSync(full))continue;assert.doesNotMatch(fs.readFileSync(full,'utf8'),/sinbad-ai-core\/adapter\b|adapter\/index|draft-adapter/u,`${file} must not wire Draft Adapter v0`);}
  const manifest=require('../package.json');
  assert.equal(manifest.exports?.['./adapter'],undefined);assert.equal(Object.keys(manifest.exports||{}).some(key=>/draft-adapter|^\.\/adapter$/iu.test(key)),false);assert.equal(Object.values(manifest.exports||{}).some(value=>/\/adapter\/|draft-adapter/u.test(String(value))),false);
  assert.equal(Object.keys(require('../')).some(key=>/draftAdapter|adaptDraft/iu.test(key)),false);
});

test('no state survives a call and the input is never mutated',()=>{
  const clean=input('The ISM Code requires a safety management system [S1].'),other=input('PR #254 was merged as c506f21.');const before=JSON.stringify([clean,other]);
  const first=d.adapt(clean);d.adapt(other);d.adapt(null);const again=d.adapt(clean);assert.deepEqual(again,first);assert.equal(JSON.stringify([clean,other]),before);assert.equal(Object.isFrozen(clean.passages[0]),false);
});
