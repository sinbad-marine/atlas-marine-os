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

test('honours an expert can-handle boundary',()=>{
  const registry=registryModule.create();
  registry.register({id:'coastal-expert',intents:['navigation'],canHandle:req=>req.context.area==='coastal'});
  assert.equal(registry.candidates('navigation',{context:{area:'ocean'}}).length,0);
});

