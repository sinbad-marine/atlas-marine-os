'use strict';const test=require('node:test');const assert=require('node:assert/strict');const api=require('../argos-health-contracts.js');const H='b'.repeat(64),AT='2026-09-01T10:00:00.000Z',UNTIL='2026-09-01T10:30:00.000Z',NOW='2026-09-01T10:10:00.000Z';function observation(component,state='HEALTHY',reasonCode=null){return api.observe({component,state,observedAt:AT,validUntil:UNTIL,reasonCode,evidenceHash:H});}
test('normalizes immutable content-free health evidence',()=>{const value=observation('BRIDGE');assert.equal(value.status,'ARGOS_HEALTH_OBSERVED');assert.equal(Object.hasOwn(value,'payload'),false);assert.ok(Object.isFrozen(value));});
test('complete healthy evidence permits a healthy assessment',()=>{const result=api.assess(api.COMPONENTS.map(x=>observation(x)),NOW);assert.equal(result.status,'ARGOS_SYSTEM_HEALTHY');assert.equal(result.components.length,api.COMPONENTS.length);});
test('missing optional evidence degrades while missing release-critical evidence blocks',()=>{const optional=api.COMPONENTS.filter(x=>x!=='GITHUB').map(x=>observation(x));assert.equal(api.assess(optional,NOW).status,'ARGOS_SYSTEM_DEGRADED');const critical=api.COMPONENTS.filter(x=>x!=='TEST_SUITE').map(x=>observation(x));assert.equal(api.assess(critical,NOW).status,'ARGOS_RELEASE_HEALTH_BLOCKED');});
test('expired degraded unavailable duplicate and hostile evidence fail closed',()=>{assert.equal(api.assess(api.COMPONENTS.map(x=>observation(x)),'2026-09-01T10:31:00.000Z').status,'ARGOS_RELEASE_HEALTH_BLOCKED');assert.equal(observation('BRIDGE','UNAVAILABLE','BRIDGE_OFFLINE').state,'UNAVAILABLE');assert.equal(api.observe({component:'BRIDGE',state:'HEALTHY',observedAt:AT,validUntil:UNTIL,reasonCode:'fake',evidenceHash:H}).status,'ARGOS_HEALTH_OBSERVATION_BLOCKED');const one=observation('BRIDGE');assert.equal(api.assess([one,one],NOW).status,'ARGOS_HEALTH_BLOCKED');});
test('health contracts cannot call networks repair services or release',()=>{for(const key of ['fetch','repair','restart','deploy','release','mutate'])assert.equal(api[key],undefined);});

test('assessment revalidates malformed serialized evidence and never treats invalid expiry as healthy',()=>{
  for(const patch of [{validUntil:'invalid'},{observedAt:'invalid'},{state:'INVENTED'},{evidenceHash:'fake'},{reasonCode:'contradiction'},{validUntil:'2026-09-02T10:30:00.000Z'},{observedAt:'2026-09-01T10:20:00.000Z'},{extra:true}]){
    const values=api.COMPONENTS.map(x=>({...observation(x)}));
    Object.assign(values[0],patch);
    assert.equal(api.assess(values,NOW).status,'ARGOS_HEALTH_BLOCKED',JSON.stringify(patch));
  }
});

test('assessment rejects getters without invoking them and supports valid JSON round trips',()=>{
  let reads=0;
  const item={...observation('APPLICATION')};
  Object.defineProperty(item,'validUntil',{enumerable:true,get(){reads++;throw Error('must not execute');}});
  assert.equal(api.assess([item],NOW).status,'ARGOS_HEALTH_BLOCKED');
  assert.equal(reads,0);
  assert.equal(api.assess(JSON.parse(JSON.stringify(api.COMPONENTS.map(x=>observation(x)))),NOW).status,'ARGOS_SYSTEM_HEALTHY');
});
