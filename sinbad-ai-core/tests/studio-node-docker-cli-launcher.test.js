const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const launcherModule=require('../engines/studio/node-docker-cli-launcher.js');

test('rejects forged Docker launch requests before process creation',async()=>{let calls=0;const launcher=launcherModule.create({spawn(){calls++;}});await assert.rejects(launcher.launch({args:['run']}),/AUTHENTIC_DOCKER_LAUNCH_REQUEST_REQUIRED/);assert.equal(calls,0);});
test('launcher exposes no shell command or publishing surface',()=>{const launcher=launcherModule.create();for(const field of ['run','execute','shell','command','fetch','pull','push','publish','deploy'])assert.equal(field in launcher,false);assert.equal(launcher.MODE,'AUTHENTIC_DOCKER_CLI_LAUNCH_ONLY');});
