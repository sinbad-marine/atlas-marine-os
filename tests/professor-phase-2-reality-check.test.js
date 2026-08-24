const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');

const record=JSON.parse(fs.readFileSync('professor-phase-2-reality-check.json','utf8'));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),'utf8').digest('hex');

test('Phase 2 reality check is a freeze candidate, not an applied freeze',()=>{
  assert.equal(record.record,'sinbad-professor-phase-2-reality-check/v1');
  assert.equal(record.decision,'GO_FOR_FREEZE_REVIEW');
  assert.equal(record.freezeApplied,false);
  assert.ok(record.capabilities.length>=12);
  assert.ok(record.capabilities.every(item=>['working','partial','draft','absent'].includes(item.status)));
});

test('candidate hashes bind the exact locally tested Professor files',()=>{
  for(const [file,expected] of Object.entries(record.candidateFiles)){
    assert.equal(fs.existsSync(file),true,`${file} is missing`);
    assert.equal(hash(file),expected,`${file} changed after reality check`);
  }
});

test('reality check states material exclusions and inherited live dependency honestly',()=>{
  const exclusions=record.explicitExclusions.join('\n');
  assert.match(exclusions,/Final maritime curriculum/);
  assert.match(exclusions,/Certification/);
  assert.match(exclusions,/Cloud-synchronized/);
  assert.match(exclusions,/3D rigged embodied instructor/);
  const live=record.capabilities.find(item=>item.id==='live-model-answer-and-source-visuals');
  assert.equal(live.status,'partial');
  assert.match(live.note,/requires a valid Atlas\/Supabase session/);
  assert.equal(fs.existsSync(record.frozenPhase1Dependency),true);
});
