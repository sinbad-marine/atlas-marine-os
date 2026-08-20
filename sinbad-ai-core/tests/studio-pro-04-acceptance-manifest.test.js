const test=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../engines/studio/studio-pro-04-acceptance-manifest.js');
test('freezes the finite Pro 0.4 Docker test boundary',()=>{assert.equal(manifest.status,'PRO_STUDIO_DOCKER_TEST_SANDBOX_ACCEPTED');assert.equal(Object.isFrozen(manifest),true);for(const item of ['NETWORK_NONE','READ_ONLY_ROOT_FILESYSTEM','READ_ONLY_HOST_MOUNT','DROP_ALL_CAPABILITIES','NON_ROOT_USER','TIMEOUT_CONTAINER_CLEANUP'])assert.ok(manifest.acceptedCapabilities.includes(item),item);});
test('keeps general execution writes merge and publish prohibited',()=>{for(const item of ['GENERAL_COMMAND_EXECUTION','SHELL_INPUT','HOST_OR_CORE_WRITE','AUTOMATIC_MERGE','LIVE_DEPLOYMENT_OR_PUBLISH'])assert.ok(manifest.prohibitedCapabilities.includes(item),item);assert.match(manifest.completionMeaning,/does not grant general execution/u);});
