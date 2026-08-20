'use strict';
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
module.exports=freeze({
  version:'0.3.0',status:'PRO_STUDIO_REVIEW_AND_REVISION_FOUNDATION_ACCEPTED',scope:'AUTHENTIC_MODEL_PROPOSAL_TO_NO_DELETE_DERIVED_REVISION',
  inheritedFrom:'0.2.0',acceptedCapabilities:['EXACT_WORKSPACE_REVALIDATION','READ_ONLY_MODEL_PROPOSAL_DIFF','CREATE_UPDATE_UNCHANGED_PRESERVE_CLASSIFICATION','DELETION_ALWAYS_DENIED','SINGLE_USE_REVISION_WRITE_AUTHORIZATION','ATOMIC_DERIVED_REVISION_CREATION','ORIGINAL_WORKSPACE_BYTE_PRESERVATION','REVISION_EVIDENCE_RECORD'],
  prohibitedCapabilities:['GENERATED_CODE_EXECUTION','GENERATED_RUNTIME_TESTS','ORIGINAL_WORKSPACE_MUTATION','FILE_DELETION','AUTOMATIC_MERGE','CORE_OR_PRODUCTION_WRITE','REMOTE_NETWORK_ACCESS','LIVE_DEPLOYMENT_OR_PUBLISH'],
  humanGates:['MODEL_CALL','PROPOSAL_WRITE','SCRIPTLESS_PREVIEW_WRITE','DIFF_REVIEW','DERIVED_REVISION_WRITE','ANY_FUTURE_EXECUTION','ANY_FUTURE_ORIGINAL_MERGE','ANY_FUTURE_PUBLISH'],
  executionBlocker:{code:'NO_NETWORK_ISOLATING_CODE_SANDBOX',hostEvidence:{windowsSandbox:false,wslDistribution:false,docker:false,podman:false,vmcompute:false,nodeDenyNetworkPermission:false},decision:'KEEP_GENERATED_EXECUTION_BLOCKED'},
  evidence:{focusedSuite:'node --test sinbad-ai-core/tests/studio-*.test.js',fullSuite:'node --test sinbad-ai-core/tests/*.test.js tests/*.test.js'},
  completionMeaning:'Pro 0.3 is complete for authenticated read-only review and non-destructive derived revisions; it does not execute generated code or merge into originals.'
});
