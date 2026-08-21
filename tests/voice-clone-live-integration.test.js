'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const bridge=fs.readFileSync('bridge/sinbad-bridge.ps1','utf8');
const openCpnClient=fs.readFileSync('bridge/opencpn-rest-client.js','utf8');
const worker=fs.readFileSync('bridge/xtts-worker.py','utf8');
const app=fs.readFileSync('app.js','utf8');
const serviceWorker=fs.readFileSync('sw.js','utf8');
const visualizer=fs.readFileSync('sinbad-route-visualizer.js','utf8');

test('voice clone uses a loopback bridge endpoint and never accepts a client reference path',()=>{
  assert.match(bridge,/127\.0\.0\.1/);
  assert.match(bridge,/POST'.*\/ai\/tts/s);
  assert.match(bridge,/XttsSpeakerWav/);
  assert.doesNotMatch(app,/speaker_wav|speakerWav|referenceAudio|XttsSpeakerWav/);
  assert.match(app,/fetch\(`\$\{SINBAD_BRIDGE_URL\}\/ai\/tts`/);
  assert.match(app,/JSON\.stringify\(\{text:chunks\[index\],language:sinbadState\.language\}\)/);
});

test('persistent worker binds loopback, caches the Yasemin latent and bounds requests',()=>{
  assert.match(worker,/ThreadingHTTPServer\(\("127\.0\.0\.1"/);
  assert.match(worker,/get_conditioning_latents/);
  assert.match(worker,/GPT_COND_LATENT = gpt_cond_latent/);
  assert.match(worker,/SPEAKER_EMBEDDING = speaker_embedding/);
  assert.match(worker,/len\(text\) > 240/);
  assert.match(worker,/self\.path != "\/status"/);
  assert.match(worker,/self\.path != "\/synthesize"/);
  assert.match(worker,/with SYNTH_LOCK/);
  assert.match(bridge,/contentLength -gt 8192/);
  assert.match(bridge,/text\.Length -gt 800/);
  assert.match(bridge,/XttsBusy/);
  assert.match(bridge,/Start-XttsWorkerIfNeeded/);
  assert.match(bridge,/Sinbad\\xtts-venv\\Scripts\\python\.exe/);
  assert.match(bridge,/\$xttsWorkerUrl\/synthesize/);
  assert.match(bridge,/XTTS_ORIGIN_DENIED/);
  assert.match(bridge,/documents=\$documents\.ToArray\(\)/);
});

test('frontend requests sentence chunks, plays only the latest cloned wav and fails closed',()=>{
  assert.match(app,/new AbortController\(\)/);
  assert.match(app,/splitSinbadCloneChunks\(cleanText\)/);
  assert.match(app,/150000/);
  assert.match(app,/new Audio\(objectUrl\)/);
  assert.doesNotMatch(app,/speakSinbadFallback\(cleanText\)/);
  assert.match(app,/sinbadVoiceAbort!==controller/);
  assert.match(app,/AbortError.*!timedOut/);
  assert.match(app,/standard voice disabled/);
  assert.match(app,/standart sese ge.ilmedi/);
  assert.match(app,/URL\.revokeObjectURL/);
  assert.match(app,/speakSinbad\(text,onVoiceReady\)/);
  assert.match(app,/preservesPitch=false/);
  assert.match(app,/playbackRate=1\.04/);
  assert.match(app,/volume=\.92/);
  assert.match(app,/let pendingChunk=loadChunk\(0\)/);
  assert.match(app,/pendingChunk=index\+1<chunks\.length\?loadChunk\(index\+1\):null/);
  assert.match(app,/speakSinbad\(answer,\(\)=>addSinbadMessage\('sinbad',answer\)\)/);
  assert.doesNotMatch(app,/onvoiceschanged=.*speakSinbad\(text\)/);
  assert.match(app,/if\(sinbadVoiceObjectUrl===objectUrl\)/);
  assert.match(serviceWorker,/sinbad-marine-v8\.20\.11-offline-map-r3-persistent-xtts-worker/);
});

test('OpenCPN-first route transfer is bounded to the verified local bridge',()=>{
  assert.match(app,/SINBAD_BRIDGE_URL}\/routes\/open/);
  assert.match(app,/isOpenCpnRequest/);
  assert.match(app,/openCalculatedRouteInOpenCpn\(route,explicitOpenCpn\)/);
  assert.match(visualizer,/function toGpx/);
  assert.match(bridge,/OPENCPN_ORIGIN_DENIED/);
  assert.match(bridge,/GPX_REQUEST_TOO_LARGE/);
  assert.doesNotMatch(bridge,/Start-Process\s+-FilePath\s+\$OpenCpnExecutable\s+-ArgumentList/);
  assert.match(bridge,/Send-RouteToOpenCpn/);
  assert.match(bridge,/importRequired=\(-not \[bool\]\$transfer\.imported\)/);
  assert.match(bridge,/Start-Process -FilePath \$OpenCpnExecutable/);
  assert.match(bridge,/OPENCPN_NOT_INSTALLED/);
  assert.match(openCpnClient,/\/api\/rx_object/);
  assert.match(openCpnClient,/activate:'1'/);
  assert.match(openCpnClient,/rejectUnauthorized:false/);
});
