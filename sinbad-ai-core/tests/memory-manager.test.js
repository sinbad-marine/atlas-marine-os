const test=require('node:test');
const assert=require('node:assert/strict');
const managerModule=require('../memory/memory-manager.js');

test('separates four memory regions',()=>{
  let time=Date.parse('2026-08-10T10:00:00Z');
  const memory=managerModule.create({now:()=>time});
  memory.rememberSession('Current conversation subject');
  memory.rememberPersistent('Prefers short answers',{explicitConsent:true});
  memory.setOperational('position','40N 026E',{ttlMs:60000});
  memory.setPreference('units','nautical');
  const state=memory.snapshot();
  assert.equal(state.session.length,1);
  assert.equal(state.persistent.length,1);
  assert.equal(state.operational.length,1);
  assert.equal(state.preferences.length,1);
});

test('expires operational context and clears it with the session',()=>{
  let time=1000;const memory=managerModule.create({now:()=>time});
  memory.setOperational('ais-target','target A',{ttlMs:100});
  time=1101;
  assert.equal(memory.snapshot().operational.length,0);
  memory.rememberSession('temporary');memory.clearSession();
  assert.equal(memory.snapshot().session.length,0);
});

test('blocks unsupported preference keys',()=>{
  const memory=managerModule.create();
  assert.equal(memory.setPreference('passport','123').accepted,false);
});

