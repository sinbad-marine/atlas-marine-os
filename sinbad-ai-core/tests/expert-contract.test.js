const test=require('node:test');
const assert=require('node:assert/strict');
const contract=require('../experts/expert-contract.js');

test('normalizes a clean future expert interface',()=>{
  const expert=contract.normalize({id:'navigation-math',intents:['navigation'],capabilities:['cpa','rhumb-line']});
  assert.equal(expert.id,'navigation-math');
  assert.deepEqual(expert.intents,['navigation']);
  assert.equal(Object.hasOwn(expert,'execute'),false);
  assert.equal(Object.isFrozen(expert),true);
});

test('rejects every legacy execute field before an expert can be registered',()=>{
  assert.throws(()=>contract.normalize({id:'legacy-expert',intents:['general'],execute(){}}),/execute callbacks are forbidden/);
  assert.throws(()=>contract.normalize({id:'legacy-null',intents:['general'],execute:null}),/execute callbacks are forbidden/);
});

test('rejects malformed or intent-less experts',()=>{
  assert.throws(()=>contract.normalize({id:'Navigation Math',intents:['navigation']}));
  assert.throws(()=>contract.normalize({id:'navigation-math',intents:[]}));
});

