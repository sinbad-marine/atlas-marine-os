'use strict';
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
module.exports=freeze({
  version:'0.4.0',status:'PRO_STUDIO_DOCKER_TEST_SANDBOX_ACCEPTED',scope:'VERIFIED_SOFTWARE_TEST_EXECUTION_ONLY',inheritedFrom:'0.3.0',
  acceptedCapabilities:['PINNED_NODE_IMAGE','AUTHENTIC_SINGLE_USE_TEST_AUTHORIZATION','EXACT_WORKSPACE_REVALIDATION','VERIFIED_TEST_FILE_ALLOWLIST','NETWORK_NONE','READ_ONLY_ROOT_FILESYSTEM','READ_ONLY_HOST_MOUNT','DROP_ALL_CAPABILITIES','NO_NEW_PRIVILEGES','NON_ROOT_USER','CPU_MEMORY_PID_TIMEOUT_LIMITS','BOUNDED_OUTPUT','TIMEOUT_CONTAINER_CLEANUP'],
  prohibitedCapabilities:['GENERAL_COMMAND_EXECUTION','SHELL_INPUT','PACKAGE_INSTALL_DURING_RUN','WEB_OR_ANIMATION_SCRIPT_EXECUTION','HOST_OR_CORE_WRITE','FILE_DELETION','REMOTE_NETWORK_ACCESS','AUTOMATIC_MERGE','LIVE_DEPLOYMENT_OR_PUBLISH'],
  humanGates:['EXACT_VERIFIED_TEST_RUN','ANY_FUTURE_RUNTIME_EXPANSION','ANY_FUTURE_MERGE','ANY_FUTURE_PUBLISH'],
  runtimeEvidence:{wsl:'2.7.12.0',dockerDesktop:'4.87.0',dockerEngine:'29.7.2',image:'node@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32',isolationProbe:'ISOLATION_TEST_PASS',integrationTest:'studio-docker-sandbox-integration.test.js'},
  completionMeaning:'Pro 0.4 can run only verified Studio software tests in a pinned, networkless, read-only Docker sandbox after an exact single-use approval. It does not grant general execution, host writes, merge or publication.'
});
