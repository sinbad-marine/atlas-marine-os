const test=require('node:test');
const assert=require('node:assert/strict');
const {PERFORMANCES,CUE_SEQUENCES,cueAt,speechModeForDecision,createPerformanceDirector}=require('../sinbad-performance-director.js');

test('board teaching performance is bounded, immutable and alternates board with audience',()=>{
  const cues=PERFORMANCES['board-teaching'];assert.equal(cues.length,4);assert.ok(Object.isFrozen(cues));
  assert.deepEqual(cues.map(cue=>cue.gaze),['board','audience','board','audience']);assert.ok(cues.at(-1).at<=5000);
});

test('director emits the first cue immediately and schedules a finite performance',()=>{
  const scheduled=[],seen=[],director=createPerformanceDirector({setTimeout:(fn,ms)=>{scheduled.push({fn,ms});return scheduled.length;},clearTimeout:()=>{}});
  const result=director.play('board-teaching',cue=>seen.push(cue));assert.equal(result.accepted,true);assert.equal(result.cueCount,4);assert.equal(seen.length,1);assert.deepEqual(scheduled.map(item=>item.ms),[1500,3000,4500]);
});

test('cancel invalidates stale cues and reduced motion emits one cue only',()=>{
  const scheduled=[],seen=[],director=createPerformanceDirector({setTimeout:fn=>{scheduled.push(fn);return scheduled.length;},clearTimeout:()=>{}});
  director.play('board-teaching',cue=>seen.push(cue));director.cancel();scheduled.forEach(fn=>fn());assert.equal(seen.length,1);
  const reduced=[];const result=director.play('board-teaching',cue=>reduced.push(cue),{reducedMotion:true});assert.equal(result.cueCount,1);assert.equal(reduced.length,1);
});

test('unknown performances and invalid emitters fail closed',()=>{
  const director=createPerformanceDirector();assert.equal(director.play('dance',()=>{}).reason,'UNKNOWN_PERFORMANCE');assert.equal(director.play('board-teaching',null).reason,'INVALID_EMITTER');
});

test('real speech boundaries resolve to a deterministic bounded gesture sequence',()=>{
  assert.ok(Object.isFrozen(CUE_SEQUENCES.speaking));
  assert.deepEqual([0,1,2,3,4].map(index=>cueAt('speaking',index).cue.gesture),['explain','open-hand','explain','nod','explain']);
  assert.equal(cueAt('dance',0).reason,'UNKNOWN_CUE_SEQUENCE');assert.equal(cueAt('speaking',-1).reason,'INVALID_CUE_INDEX');
});

test('real recognition activity maps to restrained listening cues',()=>{
  assert.deepEqual([0,1,2,3].map(index=>cueAt('listening',index).cue.gesture),['listen-lean','listen-lean','hold','nod']);
  assert.deepEqual([0,1,2,3].map(index=>cueAt('listening',index).cue.energy),[.28,.46,.62,.34]);
});

test('structured Core decisions select conservative speech performance modes',()=>{
  assert.equal(speechModeForDecision({intent:'emergency',emergency:true,risk:'critical'}),'caution');
  assert.equal(speechModeForDecision({intent:'navigation',risk:'medium'}),'instructional');
  assert.equal(speechModeForDecision({intent:'general',risk:'low'}),'warm');
  assert.equal(speechModeForDecision(null),'warm');
  assert.equal(cueAt('speaking-caution',0).cue.emotion,'concerned');
});
