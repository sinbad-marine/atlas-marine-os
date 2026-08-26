'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createCharacterEngine}=require('../sinbad-character-engine.js');
const {createImprovisationDirector,gestureCapabilityForRequest,recordVerifiedGesture}=require('../sinbad-performance-director.js');

test('character state machine remains bounded and immutable through 20,000 transitions',()=>{
  const engine=createCharacterEngine();
  const events=['READY','LISTEN_STARTED','THINK_STARTED','TEXT_PRESENTED','AUDIO_STARTED','LAUGH','WALK','TURN_SUCCEEDED','WARNING','ERROR','TEACH_AT_BOARD'];
  for(let index=0;index<20000;index++){
    const result=engine.dispatch(events[index%events.length],{boardText:`bounded-${index}`});
    assert.equal(result.accepted,true);assert.equal(Object.isFrozen(result.snapshot),true);
  }
  const snapshot=engine.getSnapshot();
  assert.equal(snapshot.sequence,20000);assert.ok(snapshot.boardText.length<=500);
  const rejected=engine.dispatch('INVENTED_RUNTIME_EVENT');
  assert.equal(rejected.accepted,false);assert.equal(rejected.snapshot,snapshot);
});

test('improvisation stays valid through 5,000 selections without consecutive visual repetition',()=>{
  let sample=0;
  const director=createImprovisationDirector({entropy:()=>((sample++%97)+.5)/97});
  let previous=null;
  for(let index=0;index<5000;index++){
    const selected=director.choose('explanation','soak-session');
    assert.equal(selected.accepted,true);assert.ok(selected.cue.variantId);assert.ok(selected.cue.motionProfile);
    if(previous)assert.notEqual(`${selected.cue.variantId}:${selected.cue.motionProfile}`,previous);
    previous=`${selected.cue.variantId}:${selected.cue.motionProfile}`;
  }
});

test('unregistered capability attacks fail closed across 5,000 requests',()=>{
  for(let index=0;index<5000;index++){
    const result=gestureCapabilityForRequest({accepted:true,supported:true,action:`invented-${index}`,cue:{gesture:'rest'}});
    assert.deepEqual(result,{accepted:false,reason:'UNREGISTERED_GESTURE_CAPABILITY'});
  }
});

test('verified body memory remains capped after 1,000 movements',()=>{
  const actions=['show-palm','wave','look-left','nod'];let history=[];
  for(let index=0;index<1000;index++){
    const recorded=recordVerifiedGesture(history,actions[index%actions.length],{limit:4});
    assert.equal(recorded.accepted,true);history=[...recorded.history];assert.ok(history.length<=4);
  }
  assert.deepEqual(history,['show-palm','wave','look-left','nod']);
});
