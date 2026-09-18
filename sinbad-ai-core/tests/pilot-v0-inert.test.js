'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const component=require('../pilot/index.js');
const copilotComponent=require('../copilot/index.js');
const gatekeeperComponent=require('../gatekeeper/index.js');
const sentinelComponent=require('../sentinel/index.js');
const authority=require('../authority/index.js');
const {p}=require('./helpers/pilot-v0-builders.js');
const dir=path.join(__dirname,'..','pilot');
const sources=()=>fs.readdirSync(dir).map(file=>[file,fs.readFileSync(path.join(dir,file),'utf8')]);

test('Pilot v0 is inert: a recommendation only - no I/O, clock, randomness, network, model, state, execution, approval, grant or rewrite; not wired',()=>{
  const m=component.MANIFEST;
  assert.equal(m.status,'INERT_COMPONENT');assert.equal(m.role,'CONTROL_STATE_RECOMMENDER');assert.equal(m.recommendationOnly,true);
  for(const flag of ['performsIo','executes','approves','rewrites','keepsState','callsModel','grantsAuthority','runsOtherComponents'])assert.equal(m[flag],false,flag);
  assert.equal(m.authority,'NONE');assert.deepEqual([...m.wiredInto],[]);assert.equal(m.contracts,authority.MANIFEST.version);
  assert.deepEqual({...m.reads},{gatekeeperDecision:'sinbad-gatekeeper-decision/0-v1',copilotReview:'sinbad-copilot-review/0-v1'});
  assert.equal(Object.isFrozen(m),true);assert.deepEqual(Object.keys(component),['MANIFEST','pilot']);assert.equal(component.pilot,p);
  for(const [file,source] of sources()){
    assert.doesNotMatch(source,/require\(['"](?:node:)?(?:fs|http|https|net|child_process|worker_threads|dgram|os|vm|cluster|readline|tls|dns|crypto)['"]\)/u,`${file} must not import I/O, execution or crypto modules directly`);
    assert.doesNotMatch(source,/\bfetch\(|process\.env|process\.argv|setTimeout\(|setInterval\(|setImmediate\(|Date\.now\(|new Date\(|Math\.random\(/u,`${file} must not perform I/O, scheduling, clock reads or randomness`);
    assert.doesNotMatch(source,/academy|gasm|zabit|akademi/iu,`${file} must not embed product identity`);
    assert.doesNotMatch(source,/\bollama\b|\bqwen\b|31983|localhost/iu,`${file} must not reference a live runtime or model`);
    assert.doesNotMatch(source,/\bglobalThis\b|\bglobal\.|module\.exports\.\w+\s*=|\blet\s+\w+\s*=\s*(?:new Map|new Set|\[\]|\{\})\s*;?\s*$/mu,`${file} must not keep module-level mutable state`);
  }
});

test('Pilot v0 reads records and never runs the components that produce them',()=>{
  const source=fs.readFileSync(path.join(dir,'pilot-v0.js'),'utf8');
  // The only members of the other components it touches are their versions, status lists and verify functions.
  assert.deepEqual([...new Set(source.match(/\bgatekeeper\.\w+/gu))].sort(),['gatekeeper.DECISION_VERSION','gatekeeper.RULESET_VERSION','gatekeeper.VERSION','gatekeeper.verifyDecision']);
  assert.deepEqual([...new Set(source.match(/\bcopilot\.\w+/gu))].sort(),['copilot.CHECKERSET_VERSION','copilot.REVIEW_VERSION','copilot.STATUSES','copilot.VERSION','copilot.verifyReview']);
  assert.doesNotMatch(source,/\.observe\(|\.review\(|gatekeeper\.decide\(|gateContract\.decide\(/u);
  assert.deepEqual([...source.matchAll(/require\('([^']+)'\)/gu)].map(x=>x[1]).sort(),['../authority/copilot-verdict','../authority/exact','../authority/gate-decision','../authority/task-context','../copilot/copilot-v0','../gatekeeper/gatekeeper-v0','../sentinel/sentinel-v0']);
});

test('the accepted contracts, Sentinel v0, Gatekeeper v0 and Co-Pilot v0 are consumed unchanged, stay unwired and do not import Pilot v0',()=>{
  assert.equal(authority.MANIFEST.version,'sinbad-authority-contracts/1-v1');assert.equal(sentinelComponent.MANIFEST.modules.sentinel,'sinbad-sentinel/0-v1');assert.equal(gatekeeperComponent.MANIFEST.modules.gatekeeper,'sinbad-gatekeeper/0-v1');assert.equal(copilotComponent.MANIFEST.modules.copilot,'sinbad-copilot/0-v1');
  for(const m of [authority.MANIFEST,sentinelComponent.MANIFEST,gatekeeperComponent.MANIFEST,copilotComponent.MANIFEST])assert.deepEqual([...m.wiredInto],[]);
  for(const other of ['authority','sentinel','gatekeeper','copilot'])for(const file of fs.readdirSync(path.join(__dirname,'..',other)))assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'..',other,file),'utf8'),/\.\.\/pilot\b|(?<!co)pilot-v0/u,`${other}/${file} must not import Pilot v0`);
});

test('no live path or package surface imports Pilot v0',()=>{
  const root=path.join(__dirname,'..','..');
  const liveFiles=['app.js','academy-classroom-window.js','academy-owner-training.js','exam-review.js','sinbad-core.js','core-decision.js','bridge/sinbad-bridge.ps1','supabase/functions/sinbad-answer/index.ts','supabase/functions/academy-training/index.ts','supabase/functions/human-review/index.ts','tools/run-sinbad-benchmark.js'];
  for(const file of liveFiles){const full=path.join(root,file);if(!fs.existsSync(full))continue;assert.doesNotMatch(fs.readFileSync(full,'utf8'),/sinbad-ai-core\/pilot\b|(?<!co)pilot\/index|(?<!co)pilot-v0/u,`${file} must not wire Pilot v0`);}
  const manifest=require('../package.json');
  assert.equal(manifest.exports?.['./pilot'],undefined);assert.equal(Object.keys(manifest.exports||{}).some(key=>/pilot/iu.test(key)),false);assert.equal(Object.values(manifest.exports||{}).some(value=>/\/pilot\//u.test(String(value))),false);
  assert.equal(Object.keys(require('../')).some(key=>/^pilot|pilotv0|pilotDecision/iu.test(key)),false);
});

test('two decisions over the same input are identical and independent: no state survives a call',()=>{
  const {records,input,claim,draft}=require('./helpers/pilot-v0-builders.js');
  const blocked=input(records({draft:draft({claims:[claim('c1',{text:'PR #254 was merged as c506f21 and is VERIFIED.'})]})})),clean=input(records());
  const first=p.decide(clean);p.decide(blocked);p.decide(null);const again=p.decide(clean);
  assert.deepEqual(again,first);assert.equal(again.pilotDecisionDigest,first.pilotDecisionDigest);
});
