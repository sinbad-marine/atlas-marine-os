const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const planModule=require('../engines/studio/docker-model-isolation-plan.js');

test('creates an inert digest-pinned networkless model isolation plan',()=>{
  const modelRoot=path.resolve('C:/synthetic/.ollama/models'),plan=planModule.create({model:'qwen3:14b',modelRoot});
  assert.equal(plan.status,'DOCKER_MODEL_ISOLATION_PLAN_READY');assert.match(plan.image,/^ollama\/ollama@sha256:[a-f0-9]{64}$/u);assert.match(plan.modelDigest,/^sha256:[a-f0-9]{64}$/u);
  assert.deepEqual(plan.policy.publishedPorts,[]);assert.equal(plan.policy.network,'NONE');assert.equal(plan.policy.rootFilesystem,'READ_ONLY');assert.equal(plan.policy.modelMount,'READ_ONLY');assert.equal(plan.policy.coreMount,'NONE');assert.equal(plan.policy.workspaceMount,'NONE');
  assert.deepEqual({authority:plan.authority,containerStarted:plan.containerStarted,modelCalled:plan.modelCalled,filesystemRead:plan.filesystemRead,filesystemWrite:plan.filesystemWrite,networkUsed:plan.networkUsed},{authority:'PLAN_ONLY',containerStarted:false,modelCalled:false,filesystemRead:false,filesystemWrite:false,networkUsed:false});
  assert.equal(Object.isFrozen(plan),true);assert.equal(Object.isFrozen(plan.policy),true);assert.equal(Object.isFrozen(plan.mounts),true);
});

test('rejects unpinned models and ambiguous model roots',()=>{
  assert.throws(()=>planModule.create({model:'other',modelRoot:'C:/synthetic/.ollama/models'}),/PINNED_LOCAL_MODEL/);
  for(const modelRoot of ['', '.', 'relative/models', 'C:/synthetic/.ollama/blobs'])assert.throws(()=>planModule.create({model:'qwen3:14b',modelRoot}),/MODELS_ROOT/);
});

test('exposes no Docker launcher model caller writer or publisher',()=>{
  for(const field of ['run','start','launch','exec','call','generate','write','mount','publish','deploy','pull','download'])assert.equal(field in planModule,false,field);
});
