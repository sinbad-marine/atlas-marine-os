'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const component=require('../chain/index.js');
const pilotComponent=require('../pilot/index.js');
const copilotComponent=require('../copilot/index.js');
const gatekeeperComponent=require('../gatekeeper/index.js');
const sentinelComponent=require('../sentinel/index.js');
const authority=require('../authority/index.js');
const {k,pass,input,supported,invention}=require('./helpers/chain-v0-builders.js');
const dir=path.join(__dirname,'..','chain');

test('Offline Chain v0 is inert: offline only - no I/O, clock, randomness, network, model, state, drafting, delivery, execution, approval or grant; not wired',()=>{
  const m=component.MANIFEST;
  assert.equal(m.status,'INERT_COMPONENT');assert.equal(m.role,'OFFLINE_COMPOSITION');assert.equal(m.offlineOnly,true);
  for(const flag of ['performsIo','producesDrafts','delivers','executes','approves','keepsState','callsModel','grantsAuthority'])assert.equal(m[flag],false,flag);
  assert.equal(m.authority,'NONE');assert.deepEqual([...m.wiredInto],[]);assert.equal(m.contracts,authority.MANIFEST.version);
  assert.deepEqual([...m.composes],[sentinelComponent.MANIFEST.version,copilotComponent.MANIFEST.version,gatekeeperComponent.MANIFEST.version,pilotComponent.MANIFEST.version]);
  assert.equal(Object.isFrozen(m),true);assert.deepEqual(Object.keys(component),['MANIFEST','chain']);assert.equal(component.chain,k);
  for(const file of fs.readdirSync(dir)){
    const source=fs.readFileSync(path.join(dir,file),'utf8');
    assert.doesNotMatch(source,/require\(['"](?:node:)?(?:fs|http|https|net|child_process|worker_threads|dgram|os|vm|cluster|readline|tls|dns|crypto)['"]\)/u,`${file} must not import I/O, execution or crypto modules directly`);
    assert.doesNotMatch(source,/\bfetch\(|process\.env|process\.argv|setTimeout\(|setInterval\(|setImmediate\(|Date\.now\(|new Date\(|Math\.random\(/u,`${file} must not perform I/O, scheduling, clock reads or randomness`);
    assert.doesNotMatch(source,/academy|gasm|zabit|akademi/iu,`${file} must not embed product identity`);
    assert.doesNotMatch(source,/\bollama\b|\bqwen\b|31983|localhost/iu,`${file} must not reference a live runtime or model`);
    assert.doesNotMatch(source,/\bglobalThis\b|\bglobal\./u,`${file} must not reach for global state`);
  }
  assert.deepEqual([...fs.readFileSync(path.join(dir,'chain-v0.js'),'utf8').matchAll(/require\('([^']+)'\)/gu)].map(x=>x[1]).sort(),['../authority/exact','../copilot/copilot-v0','../gatekeeper/gatekeeper-v0','../pilot/pilot-v0','../sentinel/sentinel-v0']);
});

test('the accepted components are consumed unchanged, stay unwired and do not import the chain',()=>{
  assert.equal(sentinelComponent.MANIFEST.modules.sentinel,'sinbad-sentinel/0-v1');assert.equal(gatekeeperComponent.MANIFEST.modules.gatekeeper,'sinbad-gatekeeper/0-v1');assert.equal(copilotComponent.MANIFEST.modules.copilot,'sinbad-copilot/0-v1');assert.equal(pilotComponent.MANIFEST.modules.pilot,'sinbad-pilot/0-v1');
  for(const m of [authority.MANIFEST,sentinelComponent.MANIFEST,gatekeeperComponent.MANIFEST,copilotComponent.MANIFEST,pilotComponent.MANIFEST])assert.deepEqual([...m.wiredInto],[]);
  // Pilot v0 still runs nothing itself: composing it here did not change what it is.
  assert.equal(pilotComponent.MANIFEST.runsOtherComponents,false);
  for(const other of ['authority','sentinel','gatekeeper','copilot','pilot'])for(const file of fs.readdirSync(path.join(__dirname,'..',other)))assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'..',other,file),'utf8'),/\.\.\/chain\b|chain-v0/u,`${other}/${file} must not import the chain`);
});

test('no live path or package surface imports Offline Chain v0',()=>{
  const root=path.join(__dirname,'..','..');
  const liveFiles=['app.js','academy-classroom-window.js','academy-owner-training.js','exam-review.js','sinbad-core.js','core-decision.js','bridge/sinbad-bridge.ps1','supabase/functions/sinbad-answer/index.ts','supabase/functions/academy-training/index.ts','supabase/functions/human-review/index.ts','tools/run-sinbad-benchmark.js'];
  for(const file of liveFiles){const full=path.join(root,file);if(!fs.existsSync(full))continue;assert.doesNotMatch(fs.readFileSync(full,'utf8'),/sinbad-ai-core\/chain\b|chain\/index|chain-v0|offline-chain/u,`${file} must not wire Offline Chain v0`);}
  const manifest=require('../package.json');
  assert.equal(manifest.exports?.['./chain'],undefined);assert.equal(Object.keys(manifest.exports||{}).some(key=>/chain/iu.test(key)),false);assert.equal(Object.values(manifest.exports||{}).some(value=>/\/chain\//u.test(String(value))),false);
  assert.equal(Object.keys(require('../')).some(key=>/offlineChain|chainV0|rehearse/iu.test(key)),false);
});

test('no state survives a rehearsal and the inputs are never mutated',()=>{
  const clean=input({passes:[pass(supported(1))]}),loop=input({passes:[pass(invention(1)),pass(supported(2))]});
  const before=JSON.stringify([clean,loop]);
  const first=k.rehearse(clean);k.rehearse(loop);k.rehearse(null);const again=k.rehearse(clean);
  assert.deepEqual(again,first);assert.equal(JSON.stringify([clean,loop]),before);
  assert.equal(Object.isFrozen(clean),false);assert.equal(Object.isFrozen(clean.passes[0].draft),false);
});
