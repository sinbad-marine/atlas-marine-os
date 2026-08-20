const test=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../engines/studio/studio-pro-acceptance-manifest.js');
const proSession=require('../engines/studio/guided-pro-model-session.js');

test('freezes the finite honest Pro 0.2 acceptance scope',()=>{
  assert.equal(manifest.status,'PRO_STUDIO_LOCAL_MODEL_FOUNDATION_ACCEPTED');assert.equal(Object.isFrozen(manifest),true);assert.equal(Object.isFrozen(manifest.runtimeEvidence),true);
  for(const capability of ['LOOPBACK_ONLY_LOCAL_MODEL_PROTOCOL','STRICT_MODEL_ARTIFACT_JSON_VALIDATION','ISOLATED_UNTRUSTED_PROPOSAL_PERSISTENCE','SCRIPTLESS_MODEL_PREVIEW_PACKAGING'])assert.ok(manifest.acceptedCapabilities.includes(capability),capability);
  assert.equal(manifest.runtimeEvidence.probeResult,'PRO_MODEL_PROPOSAL_READY');assert.equal(manifest.runtimeEvidence.persisted,false);assert.equal(manifest.runtimeEvidence.portableClaim,false);
});
test('keeps execution remote access merge Core write and publish explicitly prohibited',()=>{
  for(const capability of ['GENERATED_CODE_EXECUTION','REMOTE_MODEL_OR_INTERNET_ACCESS','AUTOMATIC_PROPOSAL_MERGE','CORE_OR_PRODUCTION_WRITE','LIVE_DEPLOYMENT_OR_PUBLISH'])assert.ok(manifest.prohibitedCapabilities.includes(capability),capability);
  assert.equal(manifest.activationBlockers[0].code,'NO_NETWORK_ISOLATING_CODE_SANDBOX');assert.ok(manifest.activationBlockers[0].blocks.includes('GENERATED_RUNTIME_TESTS'));
});
test('accepted Pro API exposes no prohibited adapter',()=>{
  const session=proSession.create({transport:async()=>({statusCode:500,body:'{}'})});for(const field of ['run','execute','testCode','merge','writeCore','fetchRemote','connectRemote','open','publish','deploy','remove','overwrite'])assert.equal(field in session,false,field);
});
