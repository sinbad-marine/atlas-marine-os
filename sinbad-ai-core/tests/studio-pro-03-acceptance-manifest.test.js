const test=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../engines/studio/studio-pro-03-acceptance-manifest.js');
const planner=require('../engines/studio/model-proposal-diff-planner.js');
const writer=require('../engines/studio/model-proposal-revision-writer.js');
test('freezes the finite Pro 0.3 no-delete acceptance scope',()=>{assert.equal(manifest.status,'PRO_STUDIO_REVIEW_AND_REVISION_FOUNDATION_ACCEPTED');assert.equal(Object.isFrozen(manifest),true);assert.equal(Object.isFrozen(manifest.executionBlocker.hostEvidence),true);for(const item of ['READ_ONLY_MODEL_PROPOSAL_DIFF','DELETION_ALWAYS_DENIED','ATOMIC_DERIVED_REVISION_CREATION','ORIGINAL_WORKSPACE_BYTE_PRESERVATION'])assert.ok(manifest.acceptedCapabilities.includes(item),item);});
test('records the host isolation blocker and keeps execution closed',()=>{assert.equal(manifest.executionBlocker.code,'NO_NETWORK_ISOLATING_CODE_SANDBOX');assert.equal(manifest.executionBlocker.decision,'KEEP_GENERATED_EXECUTION_BLOCKED');for(const item of ['GENERATED_CODE_EXECUTION','GENERATED_RUNTIME_TESTS','ORIGINAL_WORKSPACE_MUTATION','FILE_DELETION','AUTOMATIC_MERGE','LIVE_DEPLOYMENT_OR_PUBLISH'])assert.ok(manifest.prohibitedCapabilities.includes(item),item);});
test('accepted review and revision APIs expose no prohibited capability',()=>{for(const api of [planner.create(),writer.create()])for(const field of ['run','execute','testCode','delete','remove','overwriteOriginal','mergeOriginal','writeCore','fetch','publish','deploy'])assert.equal(field in api,false,field);});
