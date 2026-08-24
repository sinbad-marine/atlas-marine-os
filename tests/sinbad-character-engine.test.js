'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createCharacterEngine,STATES,GAZES}=require('../sinbad-character-engine.js');

test('character engine exposes stable states',()=>{
  assert.deepEqual(STATES,['idle','listening','thinking','preparing-voice','presenting','speaking','laughing','walking','success','warning','error','voice-disabled','board-teaching']);
});

test('laugh is an explicit bounded reaction state',()=>{
  const engine=createCharacterEngine();const result=engine.dispatch('LAUGH');
  assert.equal(result.accepted,true);assert.equal(result.snapshot.state,'laughing');
  assert.equal(result.snapshot.emotion,'joyful');assert.equal(result.snapshot.gesture,'laugh');
});

test('character engine accepts verified poses and fails closed for invented gestures',()=>{
  const engine=createCharacterEngine();
  assert.equal(engine.setState('presenting',{gesture:'show-palm'}).snapshot.gesture,'show-palm');
  assert.equal(engine.setState('presenting',{gesture:'raise-left'}).snapshot.gesture,'raise-left');
  assert.equal(engine.setState('presenting',{gesture:'show-both-hands'}).snapshot.gesture,'show-both-hands');
  assert.equal(engine.setState('presenting',{gesture:'wave-right'}).snapshot.gesture,'wave-right');
  assert.equal(engine.setState('presenting',{gesture:'wave-right-away'}).snapshot.gesture,'wave-right-away');
  assert.equal(engine.setState('presenting',{gesture:'look-left'}).snapshot.gesture,'look-left');
  assert.equal(engine.setState('presenting',{gesture:'look-right'}).snapshot.gesture,'look-right');
  assert.equal(engine.setState('presenting',{gesture:'shake-head-left'}).snapshot.gesture,'shake-head-left');
  assert.equal(engine.setState('presenting',{gesture:'shake-head-right'}).snapshot.gesture,'shake-head-right');
  assert.equal(engine.setState('presenting',{gesture:'nod-up'}).snapshot.gesture,'nod-up');
  assert.equal(engine.setState('listening',{gesture:'listen-orient'}).snapshot.gesture,'listen-orient');
  assert.equal(engine.setState('listening',{gesture:'listen-follow'}).snapshot.gesture,'listen-follow');
  const before=engine.getSnapshot();
  const rejected=engine.setState('presenting',{gesture:'teleport'});
  assert.equal(rejected.accepted,false);assert.equal(rejected.reason,'UNKNOWN_GESTURE');assert.equal(engine.getSnapshot(),before);
});

test('character detail boundary accepts verified gazes and rejects malformed values without mutation',()=>{
  const engine=createCharacterEngine();assert.deepEqual(GAZES,['audience','thought','path','board','palm','left-palm']);
  assert.equal(engine.setState('presenting',{gesture:'show-palm',gaze:'palm'}).accepted,true);
  const before=engine.getSnapshot();
  for(const [detail,reason] of [[{gaze:'offstage'},'UNKNOWN_GAZE'],[{emotion:'furious'},'UNKNOWN_EMOTION'],[{boardText:42},'INVALID_BOARD_TEXT'],[[], 'INVALID_DETAIL']]){
    const result=engine.setState('presenting',detail);assert.equal(result.accepted,false);assert.equal(result.reason,reason);assert.equal(engine.getSnapshot(),before);
  }
  const accessor={};Object.defineProperty(accessor,'gesture',{get(){throw new Error('must not run');},enumerable:true});
  assert.equal(engine.setState('presenting',accessor).reason,'INVALID_DETAIL_ACCESSOR');assert.equal(engine.getSnapshot(),before);
});

test('board erase contact is a verified bounded character pose',()=>{
  const result=createCharacterEngine().dispatch('TEACH_AT_BOARD',{boardText:'',gesture:'write-contact',gaze:'board'});
  assert.equal(result.accepted,true);assert.equal(result.snapshot.gesture,'write-contact');
});

test('board writing lift remains a verified engine gesture',()=>{
  const result=createCharacterEngine().dispatch('TEACH_AT_BOARD',{boardText:'090',gesture:'write-lift',gaze:'board'});
  assert.equal(result.accepted,true);assert.equal(result.snapshot.gesture,'write-lift');
});

test('character engine preserves the three real idle micro-poses',()=>{
  const engine=createCharacterEngine();
  for(const gesture of ['idle-breathe','idle-look-left','idle-look-right'])assert.equal(engine.setState('idle',{gesture}).snapshot.gesture,gesture);
});

test('walk is an explicit interruptible performance state',()=>{
  const engine=createCharacterEngine();const result=engine.dispatch('WALK');assert.equal(result.accepted,true);assert.equal(result.snapshot.state,'walking');assert.equal(result.snapshot.gesture,'walk');assert.equal(result.snapshot.canInterrupt,true);
});

test('speech is interruptible',()=>{
  const engine=createCharacterEngine();
  assert.equal(engine.dispatch('AUDIO_STARTED').accepted,true);
  assert.equal(engine.getSnapshot().gesture,'explain');
  assert.equal(engine.getSnapshot().canInterrupt,true);
  assert.equal(engine.dispatch('INTERRUPT').snapshot.state,'listening');
});

test('unknown events fail closed without mutation',()=>{
  const engine=createCharacterEngine();
  const before=engine.getSnapshot();
  const result=engine.dispatch('RUN_ARBITRARY_ANIMATION');
  assert.equal(result.accepted,false);
  assert.equal(result.reason,'UNKNOWN_EVENT');
  assert.equal(engine.getSnapshot(),before);
});

test('board text is bounded',()=>{
  const result=createCharacterEngine().dispatch('TEACH_AT_BOARD',{boardText:'A'.repeat(700)});
  assert.equal(result.snapshot.gesture,'point-board');
  assert.equal(result.snapshot.gaze,'board');
  assert.equal(result.snapshot.boardText.length,500);
});

test('subscription snapshots are immutable and ordered',()=>{
  const engine=createCharacterEngine();
  const seen=[];const unsubscribe=engine.subscribe(value=>seen.push(value));
  engine.dispatch('LISTEN_STARTED');unsubscribe();engine.dispatch('THINK_STARTED');
  assert.deepEqual(seen.map(value=>value.sequence),[0,1]);
  assert.throws(()=>{seen[1].state='error';},TypeError);
});
