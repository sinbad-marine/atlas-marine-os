const test=require('node:test');
const assert=require('node:assert/strict');
const registryModule=require('../experts/expert-registry.js');
const routerModule=require('../experts/expert-router.js');

function setup(){
  const registry=registryModule.create();
  registry.register({id:'future-navigation',intents:['navigation'],capabilities:['math'],priority:80,minConfidence:.7,requiresVerifiedSources:true});
  registry.register({id:'future-weather',intents:['passage'],capabilities:['weather-context'],priority:70,minConfidence:.6});
  return {registry,router:routerModule.create(registry)};
}

test('routes a confident intent to a declared expert interface',()=>{
  const {router}=setup();
  const plan=router.plan({analysis:{intent:'navigation',secondaryIntents:[],confidence:.9},safety:{}});
  assert.equal(plan.routable,true);
  assert.equal(plan.routes[0].expertId,'future-navigation');
  assert.equal(plan.routes[0].requiresVerifiedSources,true);
});

test('reports a missing expert instead of inventing a result',()=>{
  const {router}=setup();
  const plan=router.plan({analysis:{intent:'crew',secondaryIntents:[],confidence:.9},safety:{}});
  assert.equal(plan.routable,false);
  assert.equal(plan.gaps[0].reason,'EXPERT_NOT_AVAILABLE');
  assert.match(plan.notice,/no expert result may be invented/);
});

test('refuses routing when global confidence is insufficient',()=>{
  const {router}=setup();
  const plan=router.plan({analysis:{intent:'navigation',confidence:.4},safety:{}});
  assert.equal(plan.routes.length,0);
  assert.equal(plan.gaps[0].reason,'LOW_CONFIDENCE');
});

test('reports when an expert requires higher confidence',()=>{
  const {router}=setup();
  const plan=router.plan({analysis:{intent:'navigation',confidence:.65},safety:{}});
  assert.equal(plan.gaps[0].reason,'EXPERT_CONFIDENCE_TOO_LOW');
});

test('supports a multi-expert routing plan',()=>{
  const {router}=setup();
  const plan=router.plan({analysis:{intent:'navigation',secondaryIntents:['passage'],confidence:.9},safety:{}});
  assert.equal(plan.multiExpert,true);
  assert.deepEqual(plan.routes.map(x=>x.expertId),['future-navigation','future-weather']);
  assert.equal(plan.executionAllowed,true);
});

test('safety can block execution without erasing the routing plan',()=>{
  const {router}=setup();
  const plan=router.plan({analysis:{intent:'navigation',confidence:.9},safety:{blockedFromAutonomousAction:true}});
  assert.equal(plan.routes.length,1);
  assert.equal(plan.routable,false);
  assert.equal(plan.blockedBySafety,true);
});

test('deduplicates one expert selected for several intents',()=>{
  const registry=registryModule.create();
  registry.register({id:'combined-expert',intents:['navigation','passage']});
  const router=routerModule.create(registry);
  const plan=router.plan({analysis:{intent:'navigation',secondaryIntents:['passage'],confidence:.9},safety:{}});
  assert.equal(plan.routes.length,1);
  assert.equal(plan.multiExpert,false);
});

