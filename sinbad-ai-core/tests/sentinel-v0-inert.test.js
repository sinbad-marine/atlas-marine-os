'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const component=require('../sentinel/index.js');
const authority=require('../authority/index.js');
const gate=require('../authority/gate-decision.js');
const copilot=require('../authority/copilot-verdict.js');
const {s,ITEMS,set,claim,input}=require('./helpers/sentinel-v0-builders.js');
const dir=path.join(__dirname,'..','sentinel');

test('Sentinel v0 is inert: no I/O, no scheduling, no network, no model, no state, no authority, not wired',()=>{
  const m=component.MANIFEST;
  assert.equal(m.status,'INERT_COMPONENT');assert.equal(m.role,'OBSERVER');assert.equal(m.performsIo,false);assert.equal(m.executes,false);assert.equal(m.decides,false);assert.equal(m.keepsState,false);assert.equal(m.callsModel,false);assert.equal(m.authority,'NONE');
  assert.deepEqual([...m.wiredInto],[]);assert.equal(m.contracts,authority.MANIFEST.version);assert.equal(Object.isFrozen(m),true);
  assert.deepEqual(Object.keys(component),['MANIFEST','sentinel']);assert.equal(component.sentinel,s);
  for(const file of fs.readdirSync(dir)){
    const source=fs.readFileSync(path.join(dir,file),'utf8');
    assert.doesNotMatch(source,/require\(['"](?:node:)?(?:fs|http|https|net|child_process|worker_threads|dgram|os|vm|cluster|readline|tls|dns)['"]\)/u,`${file} must not import I/O or execution modules`);
    assert.doesNotMatch(source,/\bfetch\(|process\.env|process\.argv|setTimeout\(|setInterval\(|setImmediate\(|Date\.now\(|new Date\(|Math\.random\(/u,`${file} must not perform I/O, scheduling, clock reads or randomness`);
    assert.doesNotMatch(source,/academy|gasm|zabit|akademi/iu,`${file} must not embed product identity`);
    assert.doesNotMatch(source,/\bollama\b|\bqwen\b|31983|localhost/iu,`${file} must not reference a live runtime or model`);
  }
});

test('the Phase 3.1 contracts are consumed unchanged: their sources on disk match the accepted module versions',()=>{
  assert.deepEqual(authority.MANIFEST.modules,{authorityModel:'sinbad-authority-model/1-v1',claimLabels:'sinbad-claim-labels/1-v1',taskContext:'sinbad-task-context/1-v1',evidenceSet:'sinbad-evidence-set/1-v1',evidenceMap:'sinbad-evidence-map/1-v1',copilotVerdict:'sinbad-copilot-verdict/1-v1',gateDecision:'sinbad-gate-decision/1-v1'});
  assert.equal(authority.MANIFEST.status,'INERT_CONTRACTS');assert.deepEqual([...authority.MANIFEST.wiredInto],[]);
});

test('no live path or package surface imports Sentinel v0',()=>{
  const root=path.join(__dirname,'..','..');
  const liveFiles=['app.js','academy-classroom-window.js','academy-owner-training.js','exam-review.js','sinbad-core.js','core-decision.js','bridge/sinbad-bridge.ps1','supabase/functions/sinbad-answer/index.ts','supabase/functions/academy-training/index.ts','supabase/functions/human-review/index.ts','tools/run-sinbad-benchmark.js'];
  for(const file of liveFiles){const full=path.join(root,file);if(!fs.existsSync(full))continue;assert.doesNotMatch(fs.readFileSync(full,'utf8'),/sinbad-ai-core\/sentinel|sentinel\/index|sentinel-v0/u,`${file} must not wire Sentinel v0`);}
  const manifest=require('../package.json');
  assert.equal(manifest.exports?.['./sentinel'],undefined);assert.equal(JSON.stringify(manifest).includes('sentinel'),false);
  const rootEntry=require('../');assert.equal(Object.keys(rootEntry).some(key=>/sentinel/iu.test(key)),false);
});

test('Sentinel signals are shaped for the accepted contracts: flags validate as verdict warnings and rule results as gate rules; consuming them is not done here',()=>{
  const r=s.observe(input({evidenceSet:set([ITEMS.repo,ITEMS.foreign]),claims:[claim('c1',{text:'merged as #254'}),claim('c2',{evidenceIds:['ev-repo']})]}));
  for(const f of r.flags)assert.deepEqual(copilot.warning({...f,evidenceIds:[...f.evidenceIds]}),f);
  for(const x of r.ruleResults)assert.deepEqual(gate.rule({...x}),x);
  // Shape compatibility only: the decision below is a test-local demonstration, not a Sentinel capability.
  const d=gate.decide({decisionId:'demo',taskRef:r.taskRef,stage:'POST',rules:r.ruleResults.map(x=>({...x})),verdict:null,protectedAction:false,decidedAt:r.observedAt});
  assert.equal(d.outcome,'BLOCK');assert.deepEqual([...d.attribution.deterministicRuleIds],['SENTINEL.NO_UNSUPPORTED_SPECIFICS','SENTINEL.RESERVED_TERMS_BOUND','SENTINEL.EVIDENCE_IN_SCOPE','SENTINEL.CLAIMS_SUPPORTED']);
  assert.equal(r.decides,false);
});
