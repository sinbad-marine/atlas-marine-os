'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../sinbad-core.js');
require('../sinbad-navigation.js');
const assistant=require('../sinbad-navigation-assistant.js');

test('routes an explicit classroom navigation calculation directly to the engine',async()=>{
  const expert=assistant.createExpert({engine:globalThis.SinbadNavigation,language:'tr-TR'});
  const result=await core.orchestrate('15 knot hızla 2 saatte kaç deniz mili giderim?',{
    experts:{navigation:expert}
  });
  assert.equal(result.handled,true);
  assert.equal(result.expert,'navigation');
  assert.match(result.answer,/SEYİR MOTORU/);
  assert.match(result.answer,/30\.00 deniz mili/);
  assert.deepEqual(result.sources,['Sinbad Navigation Engine v0.2.0']);
  assert.equal(result.executionPerformed,false);
});

test('asks for missing navigation inputs instead of inventing them',async()=>{
  const expert=assistant.createExpert({engine:globalThis.SinbadNavigation,language:'tr-TR'});
  const result=await core.orchestrate('Mesafe ve hız hesabı yap',{
    experts:{navigation:expert}
  });
  assert.equal(result.handled,true);
  assert.match(result.answer,/ikisinin|ikisini/i);
});

test('does not invoke navigation mathematics for a non-navigation question',async()=>{
  let calls=0;
  const expert=assistant.createExpert({engine:{answer(){calls++;return 'unexpected';}}});
  const result=await core.orchestrate('Merhaba',{
    experts:{navigation:expert}
  });
  assert.equal(result.handled,false);
  assert.equal(calls,0);
});
