const test=require('node:test');
const assert=require('node:assert/strict');
const contract=require('../experts/expert-contract.js');

test('normalizes a clean future expert interface',()=>{
  const expert=contract.normalize({id:'navigation-math',intents:['navigation'],capabilities:['cpa','rhumb-line']});
  assert.equal(expert.id,'navigation-math');
  assert.deepEqual(expert.intents,['navigation']);
  assert.equal(expert.execute,null);
  assert.equal(Object.isFrozen(expert),true);
});

test('rejects malformed or intent-less experts',()=>{
  assert.throws(()=>contract.normalize({id:'Navigation Math',intents:['navigation']}));
  assert.throws(()=>contract.normalize({id:'navigation-math',intents:[]}));
});

