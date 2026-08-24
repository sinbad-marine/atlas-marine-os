const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');

const manifest=JSON.parse(fs.readFileSync('professor-phase-1-freeze.json','utf8'));
const FREEZE_TAG='sinbad-professor-phase-1-v1';
const normalize=text=>text.replace(/\r\n/g,'\n');
const taggedFile=file=>execFileSync('git',['show',`${FREEZE_TAG}:${file}`],{encoding:'utf8'});
const sha256Text=text=>crypto.createHash('sha256').update(Buffer.from(normalize(text),'utf8')).digest('hex');

test('Professor Phase 1 freeze records a bounded GO decision',()=>{
  assert.equal(manifest.schemaVersion,'sinbad-professor-freeze/v1');
  assert.equal(manifest.realityCheck,'CORE_REALITY_CHECK_V1');
  assert.equal(manifest.decision,'GO');
  assert.equal(manifest.status,'FROZEN');
  assert.equal(manifest.edgeFunction.status,'ACTIVE');
  assert.equal(manifest.edgeFunction.verifyJwt,true);
  assert.equal(manifest.verification.tests.failed,0);
  assert.equal(manifest.verification.browser.failed,0);
});

test('Professor Phase 1 manifest remains identical to the immutable tag',()=>{
  assert.equal(
    normalize(fs.readFileSync('professor-phase-1-freeze.json','utf8')),
    normalize(taggedFile('professor-phase-1-freeze.json')),
    'the Phase 1 freeze record must not be rewritten',
  );
});

test('Professor Phase 1 tagged files match their recorded hashes',()=>{
  for(const [file,expected] of Object.entries(manifest.files)){
    assert.equal(sha256Text(taggedFile(file)),expected,`${file} differs inside the immutable Phase 1 tag`);
  }
});

test('freeze record states important Phase 1 exclusions without overclaiming',()=>{
  const record=fs.readFileSync('docs/SINBAD_PROFESSOR_PHASE_1_FREEZE.md','utf8');
  assert.match(record,/not a claim that the complete Professor engine is finished/);
  assert.match(record,/Adaptive student model/);
  assert.match(record,/Guaranteed source visual for every question/);
  assert.match(record,/immutable Git tag/);
});
