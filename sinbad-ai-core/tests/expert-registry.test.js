const test=require('node:test');
const assert=require('node:assert/strict');
const registryModule=require('../experts/expert-registry.js');

test('registers and ranks experts without executing them',()=>{
  const registry=registryModule.create();
  registry.register({id:'basic-nav',intents:['navigation'],priority:10});
  registry.register({id:'advanced-nav',intents:['navigation'],priority:90});
  assert.deepEqual(registry.candidates('navigation').map(x=>x.id),['advanced-nav','basic-nav']);
  assert.equal(Object.hasOwn(registry.get('advanced-nav'),'execute'),false);
});

test('rejects legacy executable expert records fail-closed',()=>{
  const registry=registryModule.create();
  assert.throws(()=>registry.register({id:'legacy-nav',intents:['navigation'],execute(){}}),/execute callbacks are forbidden/);
  assert.equal(registry.list().length,0);
});

test('rejects duplicate expert registrations',()=>{
  const registry=registryModule.create();
  registry.register({id:'weather-expert',intents:['passage']});
  assert.throws(()=>registry.register({id:'weather-expert',intents:['navigation']}));
});

test('rejects executable can-handle predicates at registration',()=>{
  const registry=registryModule.create();
  assert.throws(()=>registry.register({id:'coastal-expert',intents:['navigation'],canHandle:()=>true}),/callbacks are forbidden/);
  assert.equal(registry.list().length,0);
});

test('rejects executable expert callbacks before they can enter registry state',()=>{
  const registry=registryModule.create();let calls=0;
  assert.throws(()=>registry.register({id:'active-expert',intents:['navigation'],execute(){calls+=1;}}),/callbacks are forbidden/);
  assert.equal(calls,0);assert.equal(registry.get('active-expert'),null);
});

test('legacy request metadata cannot widen or execute candidate selection',()=>{
  const registry=registryModule.create();registry.register({id:'static-expert',intents:['navigation']});
  assert.throws(()=>registry.candidates('navigation',{canHandle(){throw new Error('must not run');}}),/forbidden/);
  const candidates=registry.candidates('navigation',{context:{area:'ocean'}});
  assert.deepEqual(candidates.map(item=>item.id),['static-expert']);assert.equal(Object.hasOwn(candidates[0],'execute'),false);assert.equal(Object.hasOwn(candidates[0],'canHandle'),false);
});

