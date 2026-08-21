const test=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../engines/studio/studio-pro-acceptance-manifest.js');
const proSession=require('../engines/studio/guided-pro-model-session.js');

test('freezes the finite honest Pro 0.3.5 acceptance scope',()=>{
  assert.equal(manifest.status,'PRO_STUDIO_LOCAL_MODEL_FOUNDATION_ACCEPTED');assert.equal(Object.isFrozen(manifest),true);assert.equal(Object.isFrozen(manifest.runtimeEvidence),true);
  for(const capability of ['LOOPBACK_ONLY_LOCAL_MODEL_PROTOCOL','STRICT_MODEL_ARTIFACT_JSON_VALIDATION','ISOLATED_UNTRUSTED_PROPOSAL_PERSISTENCE','SCRIPTLESS_MODEL_PREVIEW_PACKAGING','DIGEST_PINNED_OLLAMA_ISOLATION_PLAN','NETWORKLESS_OLLAMA_CONTAINER_PROBE'])assert.ok(manifest.acceptedCapabilities.includes(capability),capability);
  assert.match(manifest.runtimeEvidence.modelDigest,/^sha256:[a-f0-9]{64}$/u);assert.equal(manifest.runtimeEvidence.licensePresent,true);assert.equal(manifest.runtimeEvidence.quantization,'Q4_K_M');assert.equal(manifest.runtimeEvidence.persisted,false);assert.equal(manifest.runtimeEvidence.executed,false);assert.equal(manifest.runtimeEvidence.published,false);assert.equal(manifest.runtimeEvidence.portableClaim,false);
  assert.deepEqual(manifest.runtimeEvidence.evaluationHistory.map(item=>item.result),['LOOPBACK_MODEL_TIMEOUT','STATIC_POLICY_VIOLATION','PRO_MODEL_PROPOSAL_READY']);
  assert.equal(manifest.runtimeEvidence.successfulEvaluation.authority,'DATA_ONLY');assert.equal(manifest.runtimeEvidence.successfulEvaluation.schemaValidated,true);assert.equal(manifest.runtimeEvidence.successfulEvaluation.staticPolicyValidated,true);assert.match(manifest.runtimeEvidence.successfulEvaluation.manifestHash,/^sha256:[a-f0-9]{64}$/u);
  assert.match(manifest.runtimeEvidence.containerImage,/^ollama\/ollama@sha256:[a-f0-9]{64}$/u);assert.equal(manifest.runtimeEvidence.containerImagePresentLocally,true);assert.deepEqual(manifest.runtimeEvidence.containerProbe,{result:'ISOLATION_PROBE_PASSED',runtimeVersion:'0.32.6',modelVisible:true,network:'NONE',rootFilesystem:'READ_ONLY',modelMount:'READ_ONLY',user:'65532:65532',modelInferencePerformed:false,containerRemoved:true});
  assert.deepEqual(manifest.runtimeEvidence.containerInferenceAttempt,{calls:1,retried:false,modelLoaded:true,peakObservedMemory:'9.161GiB',peakObservedCpu:'402.34%',networkIo:'0B/0B',result:'TERMINATED_WITHOUT_OUTPUT',exitCode:137,outputPersisted:false,containerRemoved:true});
  assert.equal(manifest.runtimeEvidence.lowResourceCandidate.model,'qwen3:4b');assert.match(manifest.runtimeEvidence.lowResourceCandidate.digest,/^sha256:[a-f0-9]{64}$/u);assert.equal(manifest.runtimeEvidence.lowResourceCandidate.license,'Apache-2.0');assert.equal(manifest.runtimeEvidence.lowResourceCandidate.downloaded,true);assert.deepEqual(manifest.runtimeEvidence.lowResourceCandidate.containerInferenceAttempt,{calls:1,retried:false,modelLoaded:true,loadSeconds:52.72,peakObservedMemory:'2.679GiB',peakObservedCpu:'392.77%',networkIo:'0B/0B',result:'TERMINATED_WITHOUT_OUTPUT',exitCode:137,outputPersisted:false,containerRemoved:true});
});
test('keeps execution remote access merge Core write and publish explicitly prohibited',()=>{
  for(const capability of ['GENERATED_CODE_EXECUTION','REMOTE_MODEL_OR_INTERNET_ACCESS','AUTOMATIC_PROPOSAL_MERGE','CORE_OR_PRODUCTION_WRITE','LIVE_DEPLOYMENT_OR_PUBLISH'])assert.ok(manifest.prohibitedCapabilities.includes(capability),capability);
  assert.equal(manifest.activationBlockers[0].code,'LOCAL_MODEL_CONTAINER_CPU_INFERENCE_DID_NOT_COMPLETE');assert.ok(manifest.activationBlockers[0].blocks.includes('UNATTENDED_MODEL_INFERENCE'));
});
test('accepted Pro API exposes no prohibited adapter',()=>{
  const session=proSession.create({transport:async()=>({statusCode:500,body:'{}'})});for(const field of ['run','execute','testCode','merge','writeCore','fetchRemote','connectRemote','open','publish','deploy','remove','overwrite'])assert.equal(field in session,false,field);
});
