'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const authority=require('../authority/index.js');
const dir=path.join(__dirname,'..','authority');

test('the authority contracts are inert: no I/O, no execution, no wiring, no authority',()=>{
  assert.equal(authority.MANIFEST.status,'INERT_CONTRACTS');assert.equal(authority.MANIFEST.performsIo,false);assert.equal(authority.MANIFEST.executes,false);assert.equal(authority.MANIFEST.authority,'NONE');
  assert.deepEqual([...authority.MANIFEST.wiredInto],[]);assert.equal(Object.isFrozen(authority.MANIFEST),true);
  for(const file of fs.readdirSync(dir)){
    const source=fs.readFileSync(path.join(dir,file),'utf8');
    assert.doesNotMatch(source,/require\(['"](?:node:)?(?:fs|http|https|net|child_process|worker_threads|dgram|os|vm)['"]\)/u,`${file} must not import I/O or execution modules`);
    assert.doesNotMatch(source,/\bfetch\(|process\.env|setTimeout\(|setInterval\(/u,`${file} must not perform I/O or scheduling`);
    assert.doesNotMatch(source,/academy|gasm|zabit|akademi/iu,`${file} must not embed product identity`);
  }
});

test('no live path or package surface imports the authority contracts yet',()=>{
  const root=path.join(__dirname,'..','..');
  const liveFiles=['app.js','academy-classroom-window.js','academy-owner-training.js','exam-review.js','sinbad-core.js','bridge/sinbad-bridge.ps1','supabase/functions/sinbad-answer/index.ts','supabase/functions/academy-training/index.ts','supabase/functions/human-review/index.ts'];
  for(const file of liveFiles){const full=path.join(root,file);if(!fs.existsSync(full))continue;assert.doesNotMatch(fs.readFileSync(full,'utf8'),/sinbad-ai-core\/authority|authority\/index|authority\/gate-decision|authority\/copilot-verdict/u,`${file} must not wire the contracts`);}
  assert.equal(require('../package.json').exports?.['./authority'],undefined);
});

test('module versions are declared once and exported through the index',()=>{
  assert.deepEqual(Object.keys(authority),['MANIFEST','authorityModel','claimLabels','taskContext','evidenceSet','copilotVerdict','gateDecision']);
  assert.equal(authority.MANIFEST.modules.gateDecision,authority.gateDecision.VERSION);
  assert.equal(authority.MANIFEST.modules.evidenceMap,authority.evidenceSet.MAP_VERSION);
});
