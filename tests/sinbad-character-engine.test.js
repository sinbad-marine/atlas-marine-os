'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createCharacterEngine,STATES}=require('../sinbad-character-engine.js');

test('character engine exposes stable states',()=>{
  assert.deepEqual(STATES,['idle','listening','thinking','preparing-voice','presenting','speaking','laughing','walking','success','warning','error','voice-disabled','board-teaching']);
});

test('laugh is an explicit bounded reaction state',()=>{
  const engine=createCharacterEngine();const result=engine.dispatch('LAUGH');
  assert.equal(result.accepted,true);assert.equal(result.snapshot.state,'laughing');
  assert.equal(result.snapshot.emotion,'joyful');assert.equal(result.snapshot.gesture,'laugh');
});

test('character engine accepts the real open-palm pose and rejects invented gestures',()=>{
  const engine=createCharacterEngine();
  assert.equal(engine.setState('presenting',{gesture:'show-palm'}).snapshot.gesture,'show-palm');
  assert.equal(engine.setState('presenting',{gesture:'raise-left'}).snapshot.gesture,'raise-left');
  assert.equal(engine.setState('presenting',{gesture:'look-left'}).snapshot.gesture,'look-left');
  assert.equal(engine.setState('presenting',{gesture:'look-right'}).snapshot.gesture,'look-right');
  assert.equal(engine.setState('listening',{gesture:'listen-orient'}).snapshot.gesture,'listen-orient');
  assert.equal(engine.setState('listening',{gesture:'listen-follow'}).snapshot.gesture,'listen-follow');
  assert.equal(engine.setState('presenting',{gesture:'teleport'}).snapshot.gesture,'open-hand');
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
