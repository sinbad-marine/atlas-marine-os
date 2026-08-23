'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const test=require('node:test');
const assert=require('node:assert/strict');

const source=fs.readFileSync('sinbad-speaker-identity.js','utf8');
function load(){const window={};vm.runInNewContext(source,{window,console,setInterval,clearInterval,Float32Array,Math,Date,Promise});return window.SinbadSpeakerIdentity}

test('voice identity compares derived acoustic vectors without retaining raw audio',()=>{
  const api=load(),sample=new Float32Array(2048);for(let i=0;i<sample.length;i++)sample[i]=Math.sin(i/11)*.08;
  const first=api._test.vector(sample),second=api._test.vector(sample);
  assert.equal(first.length,5);assert.equal(api._test.similarity(first,second),1);
  assert.doesNotMatch(source,/MediaRecorder|audio\/webm|audioChunks/);
});

test('speaker address never duplicates an identical title and name',()=>{
  const api=load();assert.equal(api.address({title:'Öğrenci',name:'Öğrenci'}),'Öğrenci');assert.equal(api.address({title:'Kaptan',name:'Varol'}),'Kaptan Varol');assert.equal(api.address(null),'');
});

test('identity monitoring is consent gated and uncertainty has a neutral fallback',()=>{
  assert.match(source,/if\(!consent\)throw new Error/);assert.match(source,/monitorIfConsented/);assert.match(source,/MATCH_THRESHOLD=.84/);assert.match(source,/active=null;return \{matched:false/);
});
