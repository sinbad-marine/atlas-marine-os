'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const bridge=fs.readFileSync('bridge/sinbad-bridge.ps1','utf8');
const app=fs.readFileSync('app.js','utf8');
const serviceWorker=fs.readFileSync('sw.js','utf8');

test('voice clone uses a loopback bridge endpoint and never accepts a client reference path',()=>{
  assert.match(bridge,/127\.0\.0\.1/);
  assert.match(bridge,/POST'.*\/ai\/tts/s);
  assert.match(bridge,/XttsSpeakerWav/);
  assert.doesNotMatch(app,/speaker_wav|speakerWav|referenceAudio|XttsSpeakerWav/);
  assert.match(app,/fetch\(`\$\{SINBAD_BRIDGE_URL\}\/ai\/tts`/);
  assert.match(app,/JSON\.stringify\(\{text:cleanText,language:sinbadState\.language\}\)/);
});

test('bridge bounds requests, serializes synthesis and erases temporary output',()=>{
  assert.match(bridge,/contentLength -gt 8192/);
  assert.match(bridge,/text\.Length -gt 800/);
  assert.match(bridge,/XttsBusy/);
  assert.match(bridge,/Remove-Item -LiteralPath \$outputPath/);
  assert.match(bridge,/\$exitCode = \$LASTEXITCODE/);
  assert.match(bridge,/\$ErrorActionPreference = 'Continue'/);
  assert.match(bridge,/\$ErrorActionPreference = \$previousErrorAction/);
  assert.match(bridge,/Remove-Item -LiteralPath \$diagnosticPath/);
  assert.match(bridge,/XTTS_ORIGIN_DENIED/);
  assert.match(bridge,/documents=\$documents\.ToArray\(\)/);
});

test('frontend plays cloned wav with timeout and browser fallback',()=>{
  assert.match(app,/new AbortController\(\)/);
  assert.match(app,/120000/);
  assert.match(app,/new Audio\(sinbadVoiceObjectUrl\)/);
  assert.match(app,/speakSinbadFallback\(cleanText\)/);
  assert.match(app,/URL\.revokeObjectURL/);
  assert.match(app,/speakSinbad\(text,onVoiceReady\)/);
  assert.match(app,/preservesPitch=false/);
  assert.match(app,/playbackRate=1\.04/);
  assert.match(app,/volume=\.92/);
  assert.match(app,/addSinbadMessage\('sinbad',answer\);\s*speakSinbad\(answer\)/);
  assert.doesNotMatch(app,/speakSinbad\(answer,/);
  assert.doesNotMatch(app,/onvoiceschanged=.*speakSinbad\(text\)/);
  assert.match(serviceWorker,/sinbad-marine-v8\.20\.9-core-gate-clone-conversation/);
});
