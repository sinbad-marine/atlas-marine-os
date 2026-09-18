'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const component=require('../attest/index.js');
const authority=require('../authority/index.js');
const {a,plain,recordsOf,attestInput,checkInput}=require('./helpers/attest-v0-builders.js');
const dir=path.join(__dirname,'..','attest');
const OTHERS=['authority','sentinel','gatekeeper','copilot','pilot','chain'];

test('Record Attestation v0 is inert: origin only - no I/O, clock, randomness, key generation or storage, network, model, state, approval, execution or grant; not wired',()=>{
  const m=component.MANIFEST;
  assert.equal(m.status,'INERT_COMPONENT');assert.equal(m.role,'RECORD_ORIGIN_ATTESTATION');assert.equal(m.originOnly,true);assert.equal(m.algorithm,'ED25519');
  for(const flag of ['performsIo','generatesKeys','storesKeys','executes','approves','keepsState','callsModel','grantsAuthority'])assert.equal(m[flag],false,flag);
  assert.equal(m.authority,'NONE');assert.deepEqual([...m.wiredInto],[]);assert.equal(m.contracts,authority.MANIFEST.version);assert.deepEqual([...m.attests],[...a.KIND_NAMES]);
  assert.equal(Object.isFrozen(m),true);assert.deepEqual(Object.keys(component),['MANIFEST','attest']);assert.equal(component.attest,a);
  for(const file of fs.readdirSync(dir)){
    const source=fs.readFileSync(path.join(dir,file),'utf8');
    // The signature primitive is the one platform module allowed, and only these four members of it.
    assert.doesNotMatch(source,/require\(['"](?:node:)?(?:fs|http|https|net|child_process|worker_threads|dgram|os|vm|cluster|readline|tls|dns)['"]\)/u,`${file} must not import I/O or execution modules`);
    assert.doesNotMatch(source,/generateKey|randomBytes|randomUUID|randomInt|getRandomValues|createCipher|createDecipher|pbkdf2|scrypt/u,`${file} must not generate keys, draw randomness or encrypt`);
    assert.doesNotMatch(source,/\bfetch\(|process\.env|process\.argv|setTimeout\(|setInterval\(|setImmediate\(|Date\.now\(|new Date\(|Math\.random\(/u,`${file} must not perform I/O, scheduling, clock reads or randomness`);
    assert.doesNotMatch(source,/academy|gasm|zabit|akademi/iu,`${file} must not embed product identity`);
    assert.doesNotMatch(source,/\bollama\b|\bqwen\b|31983|localhost/iu,`${file} must not reference a live runtime or model`);
    assert.doesNotMatch(source,/BEGIN [A-Z ]*PRIVATE KEY|\bglobalThis\b|\bglobal\./u,`${file} must not embed key material or reach for global state`);
  }
  const source=fs.readFileSync(path.join(dir,'attest-v0.js'),'utf8');
  assert.deepEqual([...source.matchAll(/require\('([^']+)'\)/gu)].map(x=>x[1]).sort(),['../authority/exact','../chain/chain-v0','../copilot/copilot-v0','../gatekeeper/gatekeeper-v0','../pilot/pilot-v0','../sentinel/sentinel-v0','node:crypto']);
  assert.match(source,/const \{createPrivateKey,createPublicKey,sign,verify\}=require\('node:crypto'\);/u);
  // It reads the other components' record formats and verify functions and never runs them.
  assert.doesNotMatch(source,/\.observe\(|\.review\(|\.decide\(|\.rehearse\(/u);
});

test('the accepted components are consumed unchanged, stay unwired and do not import the attestation component',()=>{
  for(const other of OTHERS){
    assert.deepEqual([...require(`../${other}/index.js`).MANIFEST.wiredInto],[],other);
    for(const file of fs.readdirSync(path.join(__dirname,'..',other)))assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'..',other,file),'utf8'),/\.\.\/attest\b|attest-v0/u,`${other}/${file} must not import Record Attestation v0`);
  }
});

test('no live path or package surface imports Record Attestation v0, and no key material is stored in the repository',()=>{
  const root=path.join(__dirname,'..','..');
  const liveFiles=['app.js','academy-classroom-window.js','academy-owner-training.js','exam-review.js','sinbad-core.js','core-decision.js','bridge/sinbad-bridge.ps1','supabase/functions/sinbad-answer/index.ts','supabase/functions/academy-training/index.ts','supabase/functions/human-review/index.ts','tools/run-sinbad-benchmark.js'];
  for(const file of liveFiles){const full=path.join(root,file);if(!fs.existsSync(full))continue;assert.doesNotMatch(fs.readFileSync(full,'utf8'),/sinbad-ai-core\/attest\b|attest\/index|attest-v0/u,`${file} must not wire Record Attestation v0`);}
  const manifest=require('../package.json');
  assert.equal(manifest.exports?.['./attest'],undefined);assert.equal(Object.keys(manifest.exports||{}).some(key=>/attest\b|attest-/iu.test(key)),false);assert.equal(Object.values(manifest.exports||{}).some(value=>/\/attest\//u.test(String(value))),false);
  assert.equal(Object.keys(require('../')).some(key=>/^attest|attestV0|derivePublicKey/iu.test(key)),false);
  // Test keys are derived from public labels at test time; the helper and the fixtures hold no seed, PEM or private key.
  for(const file of ['helpers/attest-v0-builders.js','fixtures/attest-v0/cases.json']){const text=fs.readFileSync(path.join(__dirname,file),'utf8');assert.doesNotMatch(text,/PRIVATE KEY|"seedHex"\s*:/u,file);}
});

test('no state survives a call and the inputs are never mutated',()=>{
  const R=recordsOf();const input=attestInput('GATEKEEPER_DECISION',R.GATEKEEPER_DECISION);const before=JSON.stringify(input);
  const first=a.attest(input);a.attest(null);a.check(null);const again=a.attest(input);assert.deepEqual(again,first);assert.equal(JSON.stringify(input),before);
  const checkIn=checkInput(plain(first.envelope),R.GATEKEEPER_DECISION);const checkBefore=JSON.stringify(checkIn);
  const c1=a.check(checkIn);a.check(checkInput(plain(first.envelope),R.PILOT_DECISION));const c2=a.check(checkIn);assert.deepEqual(c2,c1);assert.equal(JSON.stringify(checkIn),checkBefore);
});
