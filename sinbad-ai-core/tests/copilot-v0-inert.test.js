'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const component=require('../copilot/index.js');
const gatekeeperComponent=require('../gatekeeper/index.js');
const sentinelComponent=require('../sentinel/index.js');
const authority=require('../authority/index.js');
const {c,input,draft,claim}=require('./helpers/copilot-v0-builders.js');
const dir=path.join(__dirname,'..','copilot');

test('Co-Pilot v0 is inert: no I/O, clock, randomness, network, model, state, rewrite, approval or authority; not wired',()=>{
  const m=component.MANIFEST;
  assert.equal(m.status,'INERT_COMPONENT');assert.equal(m.role,'DETERMINISTIC_CHECKER');
  for(const flag of ['performsIo','executes','decides','rewrites','approves','keepsState','callsModel','grantsAuthority'])assert.equal(m[flag],false,flag);
  assert.equal(m.authority,'NONE');assert.deepEqual([...m.wiredInto],[]);assert.equal(m.contracts,authority.MANIFEST.version);assert.equal(m.observationEngine,sentinelComponent.MANIFEST.version);
  assert.equal(Object.isFrozen(m),true);assert.deepEqual(Object.keys(component),['MANIFEST','copilot']);assert.equal(component.copilot,c);
  for(const file of fs.readdirSync(dir)){
    const source=fs.readFileSync(path.join(dir,file),'utf8');
    assert.doesNotMatch(source,/require\(['"](?:node:)?(?:fs|http|https|net|child_process|worker_threads|dgram|os|vm|cluster|readline|tls|dns|crypto)['"]\)/u,`${file} must not import I/O, execution or crypto modules directly`);
    assert.doesNotMatch(source,/\bfetch\(|process\.env|process\.argv|setTimeout\(|setInterval\(|setImmediate\(|Date\.now\(|new Date\(|Math\.random\(/u,`${file} must not perform I/O, scheduling, clock reads or randomness`);
    assert.doesNotMatch(source,/academy|gasm|zabit|akademi/iu,`${file} must not embed product identity`);
    assert.doesNotMatch(source,/\bollama\b|\bqwen\b|31983|localhost/iu,`${file} must not reference a live runtime or model`);
    // The checker layer is independent of the gate it informs.
    assert.doesNotMatch(source,/gatekeeper/iu,`${file} must not import or reference the gate`);
  }
});

test('the accepted Phase 3.1 contracts, Sentinel v0 and Gatekeeper v0 are consumed unchanged and stay unwired',()=>{
  assert.equal(authority.MANIFEST.modules.copilotVerdict,'sinbad-copilot-verdict/1-v1');assert.equal(sentinelComponent.MANIFEST.modules.sentinel,'sinbad-sentinel/0-v1');assert.equal(gatekeeperComponent.MANIFEST.modules.gatekeeper,'sinbad-gatekeeper/0-v1');
  for(const m of [authority.MANIFEST,sentinelComponent.MANIFEST,gatekeeperComponent.MANIFEST])assert.deepEqual([...m.wiredInto],[]);
  for(const other of ['gatekeeper','sentinel','authority'])for(const file of fs.readdirSync(path.join(__dirname,'..',other)))assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'..',other,file),'utf8'),/require\(['"][^'"]*copilot(?:-v0|\/index)?['"]\)|\.\.\/copilot/u,`${other}/${file} must not import Co-Pilot v0`);
});

test('no live path or package surface imports Co-Pilot v0',()=>{
  const root=path.join(__dirname,'..','..');
  const liveFiles=['app.js','academy-classroom-window.js','academy-owner-training.js','exam-review.js','sinbad-core.js','core-decision.js','bridge/sinbad-bridge.ps1','supabase/functions/sinbad-answer/index.ts','supabase/functions/academy-training/index.ts','supabase/functions/human-review/index.ts','tools/run-sinbad-benchmark.js'];
  for(const file of liveFiles){const full=path.join(root,file);if(!fs.existsSync(full))continue;assert.doesNotMatch(fs.readFileSync(full,'utf8'),/sinbad-ai-core\/copilot|copilot\/index|copilot-v0/u,`${file} must not wire Co-Pilot v0`);}
  const manifest=require('../package.json');
  assert.equal(manifest.exports?.['./copilot'],undefined);assert.equal(JSON.stringify(manifest).toLowerCase().includes('copilot'),false);
  assert.equal(Object.keys(require('../')).some(key=>/copilot|co-pilot/iu.test(key)),false);
});

test('review never throws on hostile input and always yields a sealed, fail-closed record without a verdict',()=>{
  const throwing={};Object.defineProperty(throwing,'version',{get(){throw new Error('boom');},enumerable:true});
  const proxy=new Proxy(input(),{ownKeys(){throw new Error('boom');}});
  const cyclic=input();cyclic.draft=draft({claims:[claim('c')]});cyclic.draft.claims[0].evidenceIds=cyclic.draft.claims;
  for(const hostile of [throwing,proxy,cyclic,Symbol('x'),()=>{},new Date(0),42,'text',[]]){
    let r;assert.doesNotThrow(()=>{r=c.review(hostile);});assert.equal(r.status,'BLOCKED');assert.equal(r.failClosed,true);assert.equal(r.verdict,null);assert.equal(c.verifyReview(r),true);
  }
});
