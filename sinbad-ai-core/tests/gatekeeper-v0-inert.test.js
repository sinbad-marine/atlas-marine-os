'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const component=require('../gatekeeper/index.js');
const sentinelComponent=require('../sentinel/index.js');
const authority=require('../authority/index.js');
const {g,input,draft,claim}=require('./helpers/gatekeeper-v0-builders.js');
const dir=path.join(__dirname,'..','gatekeeper');

test('Gatekeeper v0 is inert: no I/O, clock, randomness, network, model, state, delivery, enforcement or authority; not wired',()=>{
  const m=component.MANIFEST;
  assert.equal(m.status,'INERT_COMPONENT');assert.equal(m.role,'DETERMINISTIC_GATE');assert.equal(m.stage,'POST');
  for(const flag of ['performsIo','executes','delivers','enforces','keepsState','callsModel','grantsAuthority'])assert.equal(m[flag],false,flag);
  assert.equal(m.authority,'NONE');assert.deepEqual([...m.wiredInto],[]);assert.equal(m.contracts,authority.MANIFEST.version);assert.equal(m.observationEngine,sentinelComponent.MANIFEST.version);
  assert.equal(Object.isFrozen(m),true);assert.deepEqual(Object.keys(component),['MANIFEST','gatekeeper']);assert.equal(component.gatekeeper,g);
  for(const file of fs.readdirSync(dir)){
    const source=fs.readFileSync(path.join(dir,file),'utf8');
    assert.doesNotMatch(source,/require\(['"](?:node:)?(?:fs|http|https|net|child_process|worker_threads|dgram|os|vm|cluster|readline|tls|dns|crypto)['"]\)/u,`${file} must not import I/O, execution or crypto modules directly`);
    assert.doesNotMatch(source,/\bfetch\(|process\.env|process\.argv|setTimeout\(|setInterval\(|setImmediate\(|Date\.now\(|new Date\(|Math\.random\(/u,`${file} must not perform I/O, scheduling, clock reads or randomness`);
    assert.doesNotMatch(source,/academy|gasm|zabit|akademi/iu,`${file} must not embed product identity`);
    assert.doesNotMatch(source,/\bollama\b|\bqwen\b|31983|localhost/iu,`${file} must not reference a live runtime or model`);
  }
});

test('the accepted Phase 3.1 contracts and the merged Sentinel v0 are consumed unchanged',()=>{
  assert.deepEqual(authority.MANIFEST.modules,{authorityModel:'sinbad-authority-model/1-v1',claimLabels:'sinbad-claim-labels/1-v1',taskContext:'sinbad-task-context/1-v1',evidenceSet:'sinbad-evidence-set/1-v1',evidenceMap:'sinbad-evidence-map/1-v1',copilotVerdict:'sinbad-copilot-verdict/1-v1',gateDecision:'sinbad-gate-decision/1-v1'});
  assert.equal(sentinelComponent.MANIFEST.modules.sentinel,'sinbad-sentinel/0-v1');assert.equal(sentinelComponent.MANIFEST.modules.ruleset,'sinbad-sentinel-ruleset/0-v1');
  assert.deepEqual([...authority.MANIFEST.wiredInto],[]);assert.deepEqual([...sentinelComponent.MANIFEST.wiredInto],[]);
});

test('no live path or package surface imports Gatekeeper v0',()=>{
  const root=path.join(__dirname,'..','..');
  const liveFiles=['app.js','academy-classroom-window.js','academy-owner-training.js','exam-review.js','sinbad-core.js','core-decision.js','bridge/sinbad-bridge.ps1','supabase/functions/sinbad-answer/index.ts','supabase/functions/academy-training/index.ts','supabase/functions/human-review/index.ts','tools/run-sinbad-benchmark.js'];
  for(const file of liveFiles){const full=path.join(root,file);if(!fs.existsSync(full))continue;assert.doesNotMatch(fs.readFileSync(full,'utf8'),/sinbad-ai-core\/gatekeeper|gatekeeper\/index|gatekeeper-v0|sinbad-ai-core\/sentinel/u,`${file} must not wire Gatekeeper v0`);}
  const manifest=require('../package.json');
  assert.equal(manifest.exports?.['./gatekeeper'],undefined);assert.equal(JSON.stringify(manifest).includes('gatekeeper'),false);
  assert.equal(Object.keys(require('../')).some(key=>/gatekeeper|sentinel/iu.test(key)),false);
});

test('decide never throws on hostile input and always yields a sealed, fail-closed record',()=>{
  const throwing={};Object.defineProperty(throwing,'version',{get(){throw new Error('boom');},enumerable:true});
  const proxy=new Proxy(input(),{ownKeys(){throw new Error('boom');}});
  const cyclic=input();cyclic.draft=draft({claims:[claim('c')]});cyclic.draft.claims[0].evidenceIds=cyclic.draft.claims;
  for(const hostile of [throwing,proxy,cyclic,Symbol('x'),()=>{},new Date(0),42,'text',[]]){
    let d;assert.doesNotThrow(()=>{d=g.decide(hostile);});assert.equal(d.outcome,'BLOCK');assert.equal(d.failClosed,true);assert.equal(g.verifyDecision(d),true);
  }
});
