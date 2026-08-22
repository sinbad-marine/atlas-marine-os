const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');

const manifest=JSON.parse(fs.readFileSync('professor-phase-1-freeze.json','utf8'));
const sha256=file=>crypto.createHash('sha256').update(Buffer.from(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),'utf8')).digest('hex');

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

test('Professor Phase 1 frozen files match their recorded hashes',()=>{
  for(const [file,expected] of Object.entries(manifest.files)){
    assert.equal(sha256(file),expected,`${file} changed after the Phase 1 reality check`);
  }
});

test('freeze record states important Phase 1 exclusions without overclaiming',()=>{
  const record=fs.readFileSync('docs/SINBAD_PROFESSOR_PHASE_1_FREEZE.md','utf8');
  assert.match(record,/not a claim that the complete Professor engine is finished/);
  assert.match(record,/Adaptive student model/);
  assert.match(record,/Guaranteed source visual for every question/);
  assert.match(record,/immutable Git tag/);
});
