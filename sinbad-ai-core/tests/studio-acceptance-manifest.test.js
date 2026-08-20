const test=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../engines/studio/studio-acceptance-manifest.js');
const guidedSession=require('../engines/studio/guided-studio-session.js');

test('publishes a deeply immutable finite Studio 0.1 acceptance boundary',()=>{
  assert.equal(manifest.status,'OFFLINE_STUDIO_FOUNDATION_ACCEPTED');
  assert.equal(manifest.scope,'LOCAL_OFFLINE_DRAFT_AND_SCRIPTLESS_PREVIEW');
  assert.equal(Object.isFrozen(manifest),true);assert.equal(Object.isFrozen(manifest.acceptedCapabilities),true);
  assert.ok(manifest.acceptedCapabilities.includes('FINITE_GUIDED_WORKFLOW'));
  assert.ok(manifest.limitations.includes('DETERMINISTIC_TEMPLATES_NOT_A_LOCAL_LLM'));
});

test('acceptance boundary keeps every dangerous capability explicitly prohibited',()=>{
  for(const capability of ['GENERATED_CODE_EXECUTION','SHELL_OR_COMMAND_EXECUTION','NETWORK_OR_EXTERNAL_MODEL_ACCESS','CORE_OR_PRODUCTION_WRITE','LIVE_DEPLOYMENT_OR_PUBLISH','OVERWRITE_OR_DESTRUCTIVE_DELETE'])assert.ok(manifest.prohibitedCapabilities.includes(capability),capability);
  for(const gate of ['SANDBOX_SOURCE_WRITE','SCRIPTLESS_PREVIEW_WRITE','LOCAL_PREVIEW_OPEN','ANY_FUTURE_EXECUTION','ANY_FUTURE_NETWORK_OR_MODEL_USE','ANY_FUTURE_PUBLISH'])assert.ok(manifest.humanGates.includes(gate),gate);
});

test('accepted guided API still exposes none of the prohibited adapters',()=>{
  const session=guidedSession.create({approvedBase:process.cwd()});
  for(const field of ['run','execute','shell','command','fetch','connect','open','render','publish','deploy','overwrite','remove','writeCore'])assert.equal(field in session,false,field);
});
