'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createCharacterEngine,STATES}=require('../sinbad-character-engine.js');

test('character engine exposes stable states',()=>{
  assert.deepEqual(STATES,['idle','listening','thinking','preparing-voice','speaking','laughing','success','warning','error','voice-disabled','board-teaching']);
});

test('laugh is an explicit bounded reaction state',()=>{
  const engine=createCharacterEngine();const result=engine.dispatch('LAUGH');
  assert.equal(result.accepted,true);assert.equal(result.snapshot.state,'laughing');
  assert.equal(result.snapshot.emotion,'joyful');assert.equal(result.snapshot.gesture,'laugh');
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
