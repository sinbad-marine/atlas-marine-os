const test=require('node:test');
const assert=require('node:assert/strict');
const planner=require('../sinbad-viseme-planner.js');

test('maps Turkish and English speech characters to bounded mouth families',()=>{
  assert.equal(planner.VISEME_VERSION,'sinbad-viseme-planner/1');
  for(const character of ['m','b','p'])assert.equal(planner.frameForCharacter(character),'closed');
  for(const character of ['o','ö','u','ü','w'])assert.equal(planner.frameForCharacter(character),'round');
  for(const character of ['a','e','ı','i'])assert.equal(planner.frameForCharacter(character),'wide');
  assert.equal(planner.frameForCharacter('s'),'open');
});

test('builds a compressed immutable viseme sequence from the spoken token',()=>{
  const result=planner.sequenceForToken('Merhaba');
  assert.equal(result.accepted,true);
  assert.deepEqual(result.frames,['closed','wide','open','wide','closed','wide']);
  assert.equal(Object.isFrozen(result.frames),true);
  assert.equal(Object.isFrozen(result),true);
});

test('selects the real word at a speech boundary and rotates only within its own visemes',()=>{
  const first=planner.visemeForBoundary({text:'Sinbad okula gidiyor',charIndex:7,step:0});
  const second=planner.visemeForBoundary({text:'Sinbad okula gidiyor',charIndex:7,step:1});
  assert.equal(first.token,'okula');
  assert.equal(first.frame,'round');
  assert.equal(second.frame,'open');
  assert.equal(planner.visemeForBoundary({text:'⚓ okula',charIndex:3,step:0}).token,'okula');
});

test('fails closed for malformed boundaries and unbounded tokens',()=>{
  assert.equal(planner.visemeForBoundary({text:'Sinbad',charIndex:-1}).reason,'EMPTY_TOKEN');
  assert.equal(planner.visemeForBoundary({text:'Sinbad',charIndex:0,step:-1}).reason,'INVALID_STEP');
  assert.equal(planner.sequenceForToken('a'.repeat(65)).reason,'TOKEN_TOO_LONG');
});
