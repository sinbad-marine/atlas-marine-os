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
  assert.equal(plan.routable,false);
  assert.equal(plan.planningRoutable,true);
  assert.equal(plan.routes[0].expertId,'future-navigation');
  assert.equal(plan.routes[0].requiresVerifiedSources,true);
});

test('reports a missing expert instead of inventing a result',()=>{
  const {router}=setup();
  const plan=router.plan({analysis:{intent:'crew',secondaryIntents:[],confidence:.9},safety:{}});
  assert.equal(plan.routable,false);
  assert.equal(plan.planningRoutable,false);
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
  assert.equal(plan.executionAllowed,false);
  assert.equal(plan.executionBlockedReason,'ENGINE_PORT_GATE_REQUIRED');
  assert.deepEqual(plan.executionBlockedReasons,['ENGINE_PORT_GATE_REQUIRED']);
  assert.equal(plan.planVersion,'sinbad-expert-route-plan/2-v1');
});

test('safety can block execution without erasing the routing plan',()=>{
  const {router}=setup();
  const plan=router.plan({analysis:{intent:'navigation',confidence:.9},safety:{blockedFromAutonomousAction:true}});
  assert.equal(plan.routes.length,1);
  assert.equal(plan.routable,false);
  assert.equal(plan.planningRoutable,false);
  assert.equal(plan.blockedBySafety,true);
  assert.equal(plan.executionBlockedReason,'SAFETY_POLICY_BLOCKED');
  assert.deepEqual(plan.executionBlockedReasons,['SAFETY_POLICY_BLOCKED','ENGINE_PORT_GATE_REQUIRED']);
});

test('expertise gaps take precedence over the permanent port gate',()=>{
  const {router}=setup();const plan=router.plan({analysis:{intent:'crew',confidence:.9},safety:{}});
  assert.equal(plan.executionAllowed,false);assert.equal(plan.executionBlockedReason,'EXPERTISE_GAPS_PRESENT');
  assert.deepEqual(plan.executionBlockedReasons,['EXPERTISE_GAPS_PRESENT','ENGINE_PORT_GATE_REQUIRED']);assert.ok(Object.isFrozen(plan.executionBlockedReasons));
});

test('empty routes expose NO_ROUTES and never become routable',()=>{
  const plan=routerModule.create(registryModule.create()).plan({analysis:{intent:'general',confidence:.9},safety:{}});
  assert.equal(plan.routable,false);assert.equal(plan.planningRoutable,false);assert.equal(plan.executionAllowed,false);
  assert.deepEqual(plan.executionBlockedReasons,['NO_ROUTES','ENGINE_PORT_GATE_REQUIRED']);
});

test('every plan keeps the engine-port gate present and last',()=>{
  const {router}=setup();for(const input of [{analysis:{intent:'navigation',confidence:.9},safety:{}},{analysis:{intent:'crew',confidence:.9},safety:{}},{analysis:{intent:'navigation',confidence:.9},safety:{blockedFromAutonomousAction:true}}]){const plan=router.plan(input);assert.equal(plan.executionBlockedReasons.at(-1),'ENGINE_PORT_GATE_REQUIRED');assert.equal(plan.executionAllowed,false);}
});

test('deduplicates one expert selected for several intents',()=>{
  const registry=registryModule.create();
  registry.register({id:'combined-expert',intents:['navigation','passage']});
  const router=routerModule.create(registry);
  const plan=router.plan({analysis:{intent:'navigation',secondaryIntents:['passage'],confidence:.9},safety:{}});
  assert.equal(plan.routes.length,1);
  assert.equal(plan.multiExpert,false);
});

