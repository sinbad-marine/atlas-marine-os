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

test('permanently rejects executable expert callbacks and accessors',()=>{
  assert.throws(()=>contract.normalize({id:'callback-expert',intents:['navigation'],execute(){}}),/callbacks are forbidden/);
  assert.throws(()=>contract.normalize({id:'predicate-expert',intents:['navigation'],canHandle(){return true;}}),/callbacks are forbidden/);
  const hostile={id:'accessor-expert',intents:['navigation']};
  Object.defineProperty(hostile,'execute',{get(){throw new Error('must not run');},enumerable:true});
  assert.throws(()=>contract.normalize(hostile),/forbidden/);
});

test('rejects non-plain inputs and keeps normalized records immutable',()=>{
  assert.throws(()=>contract.normalize(Object.assign(Object.create(null),{id:'odd-expert',intents:['navigation']})),/plain object/);
  const expert=contract.normalize({id:'sealed-expert',intents:['navigation']});
  assert.equal(Object.isFrozen(expert),true);
  assert.throws(()=>Object.defineProperty(expert,'execute',{value(){}}));
  assert.equal(Object.hasOwn(expert,'execute'),false);
});

test('rejects unknown fields and functions under any field name',()=>{
  assert.throws(()=>contract.normalize({id:'unknown-field',intents:['navigation'],pluginState:true}),/allowlisted/);
  assert.throws(()=>contract.normalize({id:'hidden-function',intents:['navigation'],name(){}}),/functions are forbidden/);
});

test('rejects coercive nested intent and capability values without invocation',()=>{
  let calls=0;const hostile={toString(){calls+=1;return 'navigation';}};
  assert.throws(()=>contract.normalize({id:'coercive-intent',intents:[hostile]}),/must be strings/);
  assert.throws(()=>contract.normalize({id:'coercive-capability',intents:['navigation'],capabilities:[hostile]}),/must be strings/);
  assert.equal(calls,0);
});

