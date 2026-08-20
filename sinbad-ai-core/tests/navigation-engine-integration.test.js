'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const adapter=require('../adapters/navigation-engine-adapter.js');
const loader=require('../adapters/installed-navigation-engine.js');

const ENGINE_INDEX=require.resolve('../engines/navigation/src/index.js');

function active(operations=['inverseRoute']){
  return {
    mode:'AUTHORIZED_EXECUTION',allowed:true,
    authorizationId:'nav-auth-001',approvedBy:'owner-admin-001',
    expiresAt:'2030-01-01T00:00:00Z',operations
  };
}

test('adapter and loader metadata do not activate navigation mathematics',()=>{
  delete require.cache[ENGINE_INDEX];
  assert.equal(require.cache[ENGINE_INDEX],undefined);
  assert.equal(loader.metadata().version,'0.2.0');
  assert.equal(require.cache[ENGINE_INDEX],undefined);
  assert.equal(adapter.descriptor().executionPolicy,'EXPLICIT_AUTHORIZATION_ONLY');
});

test('default adapter blocks execution without loading the engine',()=>{
  let loads=0;
  const instance=adapter.create({engineLoader(){loads++;return loader.load();}});
  const result=instance.execute('inverseRoute',{});
  assert.equal(result.status,'EXECUTION_BLOCKED');
  assert.equal(result.reason,'AUTHORIZATION_REQUIRED');
  assert.equal(result.security.navigationExecutionPerformed,false);
  assert.equal(loads,0);
});

test('unsupported and ungranted operations fail before engine loading',()=>{
  let loads=0;
  const instance=adapter.create({authorization:active(['inverseRoute']),clock:()=>Date.parse('2026-08-20T00:00:00Z'),engineLoader(){loads++;return loader.load();}});
  assert.equal(instance.execute('deleteRoute',{}).reason,'OPERATION_NOT_ALLOWED');
  assert.equal(instance.execute('directRoute',{}).reason,'OPERATION_NOT_AUTHORIZED');
  assert.equal(loads,0);
});

test('expired authorization fails closed without loading the engine',()=>{
  let loads=0;
  const instance=adapter.create({authorization:active(),clock:()=>Date.parse('2031-01-01T00:00:00Z'),engineLoader(){loads++;return loader.load();}});
  assert.equal(instance.execute('inverseRoute',{}).reason,'AUTHORIZATION_EXPIRED');
  assert.equal(loads,0);
});

test('explicit authorization executes the installed WGS84 engine and preserves warnings',()=>{
  const instance=adapter.create({authorization:active(),clock:()=>Date.parse('2026-08-20T00:00:00Z'),engineLoader:loader.load});
  const response=instance.execute('inverseRoute',{
    earthModel:'WGS84',lat1:0,lon1:0,lat2:0,lon2:1
  });
  assert.equal(response.status,'EXECUTED');
  assert.equal(response.result.metadata.earthModel,'WGS84');
  assert.ok(response.result.distanceNm>60&&response.result.distanceNm<61);
  assert.equal(response.security.corePlanOnlyPreserved,true);
  assert.ok(response.result.metadata.warnings.length>0);
});

test('adapter forwards explicit multi-argument navigation operations',()=>{
  const instance=adapter.create({authorization:active(['calculateDistanceRun']),clock:()=>Date.parse('2026-08-20T00:00:00Z'),engineLoader:loader.load});
  const response=instance.execute('calculateDistanceRun',[
    {value:18.52,unit:'km/h'},
    {value:30,unit:'min'}
  ]);
  assert.equal(response.status,'EXECUTED');
  assert.ok(Math.abs(response.result.distance.value-5)<1e-12);
  assert.equal(response.result.distance.unit,'NM');
});

test('authorization and adapter results are immutable',()=>{
  const instance=adapter.create({authorization:active(),clock:()=>Date.parse('2026-08-20T00:00:00Z'),engineLoader:loader.load});
  const response=instance.execute('inverseRoute',{earthModel:'WGS84',lat1:0,lon1:0,lat2:0,lon2:1});
  assert.equal(Object.isFrozen(response),true);
  assert.equal(Object.isFrozen(response.result),true);
  assert.throws(()=>{response.status='ALTERED';},TypeError);
});
