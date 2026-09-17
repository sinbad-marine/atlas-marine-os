'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const t=require('../authority/task-context.js');
const context=changes=>({version:t.VERSION,taskId:'task-1',workflowRef:'workflow:alpha',surfaceRef:'surface:dashboard',principalRef:'principal:owner-1',authorityRefs:['grant-1'],evidenceScopeRef:'scope:alpha',stateSnapshotRef:'a'.repeat(64),language:'tr-TR',requestedAt:1000,expiresAt:61000,...changes});

test('snapshots an exact frozen task context and rejects drift',()=>{
  const c=t.snapshot(context());
  assert.ok(c);assert.equal(Object.isFrozen(c),true);assert.equal(Object.isFrozen(c.authorityRefs),true);assert.equal(Object.getPrototypeOf(c),Object.prototype);
  for(const bad of [context({extra:true}),context({version:'x'}),context({taskId:''}),context({authorityRefs:['a','a']}),context({stateSnapshotRef:'short'}),context({language:'turkish'}),context({expiresAt:1000}),context({expiresAt:1000+t.MAX_LIFETIME_MS+1}),context({requestedAt:-1}),null,[],Object.create(context())]){assert.equal(t.snapshot(bad),null);}
  const accessor=context();Object.defineProperty(accessor,'taskId',{get(){return 'task-1';},enumerable:true});assert.equal(t.snapshot(accessor),null);
  assert.ok(t.snapshot(context({stateSnapshotRef:null})));
});

test('expiry is fail closed for invalid contexts and clocks',()=>{
  assert.equal(t.isExpired(context(),60999),false);assert.equal(t.isExpired(context(),61000),true);
  assert.equal(t.isExpired(context({version:'x'}),0),true);assert.equal(t.isExpired(context(),'now'),true);
});

test('evidence from another scope is FOREIGN, never silently in scope',()=>{
  assert.equal(t.isolationCheck(context(),'scope:alpha').status,'IN_SCOPE');
  const foreign=t.isolationCheck(context(),'scope:beta');
  assert.equal(foreign.status,'FOREIGN_SCOPE');assert.equal(foreign.taskId,'task-1');assert.equal(Object.isFrozen(foreign),true);
  assert.equal(t.isolationCheck(context({version:'x'}),'scope:alpha').status,'INVALID');assert.equal(t.isolationCheck(context(),'').status,'INVALID');
});

test('carries no product identity and exports only inert helpers',()=>{
  assert.deepEqual(Object.keys(t),['VERSION','FIELDS','MAX_LIFETIME_MS','snapshot','isExpired','isolationCheck']);
  assert.equal(Object.isFrozen(t),true);
});
