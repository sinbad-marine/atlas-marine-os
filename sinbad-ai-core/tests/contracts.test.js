const test=require('node:test');
const assert=require('node:assert/strict');
const contracts=require('../contracts.js');
const manifest=require('../manifest.js');

test('publishes a stable Phase 1 manifest',()=>{
  assert.equal(manifest.phase,1);
  assert.equal(manifest.domainLogicPolicy,'external-experts-only');
  assert.deepEqual(manifest.layers,['intent','safety','context','orchestrator']);
});

test('normalizes immutable decisions',()=>{
  const value=contracts.decision({intent:'navigation',risk:'high',confidence:2,requiresHumanApproval:true});
  assert.equal(value.intent,'navigation');
  assert.equal(value.confidence,1);
  assert.equal(value.requiresHumanApproval,true);
  assert.equal(Object.isFrozen(value),true);
});

test('falls back to safe contract values',()=>{
  const value=contracts.result({handled:true,decision:{intent:'unknown',risk:'unknown'}});
  assert.equal(value.decision.intent,'general');
  assert.equal(value.decision.risk,'low');
  assert.deepEqual(value.warnings,[]);
});

