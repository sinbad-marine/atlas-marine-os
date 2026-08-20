'use strict';
const VERSION='0.2.0';
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
module.exports=freeze({
  version:VERSION,status:'PRO_STUDIO_LOCAL_MODEL_FOUNDATION_ACCEPTED',scope:'AUTHORIZED_LOOPBACK_MODEL_TO_ISOLATED_SCRIPTLESS_PREVIEW',
  acceptedCapabilities:['LOOPBACK_ONLY_LOCAL_MODEL_PROTOCOL','SINGLE_USE_MODEL_CALL_AUTHORIZATION','BOUNDED_NODE_LOOPBACK_HTTP_TRANSPORT','STRICT_MODEL_ARTIFACT_JSON_VALIDATION','STATIC_POLICY_REUSE','ISOLATED_UNTRUSTED_PROPOSAL_PERSISTENCE','SCRIPTLESS_MODEL_PREVIEW_PACKAGING','SINGLE_USE_MODEL_PREVIEW_WRITE','FINITE_GUIDED_PRO_WORKFLOW'],
  prohibitedCapabilities:['GENERATED_CODE_EXECUTION','REMOTE_MODEL_OR_INTERNET_ACCESS','AUTOMATIC_PROPOSAL_MERGE','CORE_OR_PRODUCTION_WRITE','AUTOMATIC_BROWSER_OPEN','LIVE_DEPLOYMENT_OR_PUBLISH','OVERWRITE_OR_DESTRUCTIVE_DELETE'],
  humanGates:['ONE_LOOPBACK_MODEL_CALL','ISOLATED_PROPOSAL_WRITE','SCRIPTLESS_MODEL_PREVIEW_WRITE','LOCAL_PREVIEW_OPEN','ANY_FUTURE_EXECUTION','ANY_FUTURE_MERGE_OR_PUBLISH'],
  runtimeEvidence:{observedAt:'2026-08-21',runtime:'Ollama',model:'qwen3:14b',modelSize:'9.3 GB',processorObserved:'100% CPU',probeResult:'PRO_MODEL_PROPOSAL_READY',probeArtifact:'web/index.html',persisted:false,published:false,portableClaim:false},
  activationBlockers:[{code:'NO_NETWORK_ISOLATING_CODE_SANDBOX',detail:'Node 24 permission flags on this host do not provide a deny-network gate and Docker/Podman is unavailable.',blocks:['GENERATED_CODE_EXECUTION','GENERATED_RUNTIME_TESTS']}],
  evidence:{focusedSuite:'node --test sinbad-ai-core/tests/studio-*.test.js',fullSuite:'node --test sinbad-ai-core/tests/*.test.js tests/*.test.js'},
  completionMeaning:'Pro 0.2 is complete for authorized local-model drafting, validation, isolated persistence and scriptless preview only.'
});
