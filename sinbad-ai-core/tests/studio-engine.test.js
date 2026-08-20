const test=require('node:test');
const assert=require('node:assert/strict');
const studio=require('../engines/studio/studio-engine.js');

test('creates a deterministic multi-domain Studio plan without performing work',()=>{
  const input={instruction:'Responsive bir web sayfası ve ona bağlı masaüstü programı ile SVG animasyon hazırla',projectName:'Sinbad Creator',audience:'captains',acceptanceCriteria:'tests pass'};
  const first=studio.plan(input),second=studio.plan(input);
  assert.deepEqual(first,second);
  assert.equal(first.status,'STUDIO_PLAN_READY');
  assert.deepEqual(first.domains,['web','software','animation']);
  assert.equal(first.project.proposedWorkspace,'studio-workspaces/sinbad-creator');
  assert.deepEqual(first.execution,{allowed:false,performed:false});
  assert.deepEqual(first.network,{allowed:false,performed:false});
  assert.deepEqual(first.writes,{allowed:false,performed:false});
  assert.ok(Object.isFrozen(first));
});

test('asks focused questions when the request has no Studio domain',()=>{
  const result=studio.plan({instruction:'Bana yardımcı ol'});
  assert.equal(result.status,'CLARIFICATION_REQUIRED');
  assert.equal(result.domains.length,0);
  assert.ok(result.questions.length>=2);
});

test('normalizes hostile controls and bounds instruction length',()=>{
  const result=studio.plan({instruction:`web\u200Bsite\u0000 ${'x'.repeat(20000)}`});
  assert.equal(result.instruction.length,studio.MAX_INSTRUCTION_LENGTH);
  assert.equal(/[\u0000\u200B]/u.test(result.instruction),false);
  assert.deepEqual(result.domains,['web']);
});

test('requires approval for production Core destructive external secret and purchase requests',()=>{
  const result=studio.plan({instruction:'Web programını canlıya deploy et, Core’a yaz, eski dosyayı sil, Gemini cloud API key ve ödeme aboneliği kullan'});
  assert.equal(result.status,'APPROVAL_REQUIRED');
  assert.deepEqual(result.gates,[
    'LIVE_PUBLISH_REQUIRES_APPROVAL','CORE_WRITE_REQUIRES_APPROVAL','DESTRUCTIVE_ACTION_REQUIRES_APPROVAL',
    'EXTERNAL_DATA_REQUIRES_APPROVAL','SECRET_OR_IDENTITY_DATA_BLOCKED','PURCHASE_REQUIRES_APPROVAL'
  ]);
  assert.equal(result.execution.allowed,false);
  assert.equal(result.network.allowed,false);
  assert.equal(result.writes.allowed,false);
});

test('exposes no execution network or filesystem adapter',()=>{
  assert.deepEqual(Object.keys(studio).sort(),['MAX_INSTRUCTION_LENGTH','MODE','VERSION','plan']);
  assert.equal('execute' in studio,false);
  assert.equal('write' in studio,false);
  assert.equal('fetch' in studio,false);
});
