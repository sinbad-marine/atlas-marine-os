const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');

const manifest=JSON.parse(fs.readFileSync('professor-phase-2-freeze.json','utf8'));
const reality=JSON.parse(fs.readFileSync('professor-phase-2-reality-check.json','utf8'));
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),'utf8').digest('hex');

test('Professor Phase 2 freeze records the approved bounded GO decision',()=>{
  assert.equal(manifest.schemaVersion,'sinbad-professor-phase-2-freeze/v1');
  assert.equal(manifest.decision,'GO');
  assert.equal(manifest.status,'FROZEN');
  assert.equal(manifest.verification.tests.failed,0);
  assert.equal(manifest.verification.browser.failed,0);
  assert.equal(reality.decision,'GO_FOR_FREEZE_REVIEW');
  assert.equal(reality.freezeApplied,false);
});

test('Professor Phase 2 frozen files match the accepted reality-check hashes',()=>{
  assert.deepEqual(manifest.files,reality.candidateFiles);
  for(const [file,expected] of Object.entries(manifest.files)){
    assert.equal(sha256(file),expected,`${file} changed after the Phase 2 freeze`);
  }
});

test('Phase 2 freeze states external dependencies and material exclusions honestly',()=>{
  const record=fs.readFileSync('docs/SINBAD_PROFESSOR_PHASE_2_FREEZE.md','utf8');
  assert.match(record,/does not claim/);
  assert.match(record,/valid Atlas\/Supabase session/);
  assert.match(record,/Final maritime curriculum/);
  assert.match(record,/rigged 3D instructor/);
  assert.match(record,/new branch\/version/);
});
