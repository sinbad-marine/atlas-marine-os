'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const e=require('../authority/evidence-set.js');
const t=require('../authority/task-context.js');
const h=c=>c.repeat(64);
const item=changes=>({evidenceId:'ev-1',sourceClass:'REPOSITORY',locatorRef:'git:main:docs/state.json',contentHash:h('b'),observedAt:900,scopeRef:'scope:alpha',...changes});
const set=changes=>({version:e.VERSION,setId:'set-1',taskRef:'task-1',items:[item(),item({evidenceId:'ev-2',sourceClass:'MODEL_MEMORY',locatorRef:'memory:1',contentHash:h('c')}),item({evidenceId:'ev-3',sourceClass:'LIVE_SYSTEM',locatorRef:'http://127.0.0.1/status',contentHash:h('d'),scopeRef:'scope:beta'})],retrievedAt:1000,...changes});
const map=entries=>({version:e.MAP_VERSION,mapId:'map-1',taskRef:'task-1',entries});
const context={version:t.VERSION,taskId:'task-1',workflowRef:'workflow:alpha',surfaceRef:'surface:x',principalRef:'principal:p',authorityRefs:[],evidenceScopeRef:'scope:alpha',stateSnapshotRef:null,language:'en',requestedAt:1000,expiresAt:2000};

test('evidence sets and maps are exact, frozen and identity-unique',()=>{
  const s=e.snapshot(set());assert.ok(s);assert.equal(Object.isFrozen(s.items[0]),true);
  assert.equal(e.snapshot(set({items:[item(),item()]})),null);
  assert.equal(e.snapshot(set({items:[item({sourceClass:'nope'})]})),null);
  assert.equal(e.snapshot(set({items:[item({contentHash:'x'})]})),null);
  assert.equal(e.snapshot(set({extra:1})),null);
  assert.ok(e.mapSnapshot(map([{claimId:'c1',evidenceIds:['ev-1']}])));
  assert.equal(e.mapSnapshot(map([{claimId:'c1',evidenceIds:['ev-1']},{claimId:'c1',evidenceIds:[]}])),null);
  assert.equal(e.mapSnapshot(map([{claimId:'c1',evidenceIds:['ev-1','ev-1']}])),null);
  assert.equal(e.contains(set(),'ev-1'),true);assert.equal(e.contains(set(),'ev-9'),false);
});

test('verifyMap binds every claim to identified observed evidence or reports exactly why not',()=>{
  const result=e.verifyMap(map([{claimId:'bound',evidenceIds:['ev-1']},{claimId:'unbound',evidenceIds:[]},{claimId:'unknown',evidenceIds:['ev-9']},{claimId:'memory',evidenceIds:['ev-2']}]),set());
  assert.equal(result.status,'MAP_UNBOUND');
  assert.deepEqual(result.claims.map(c=>[c.claimId,c.status]),[['bound','BOUND'],['unbound','UNBOUND'],['unknown','UNKNOWN_EVIDENCE'],['memory','UNSUPPORTED_NON_AUTHORITATIVE']]);
  assert.deepEqual([...result.claims[2].missing],['ev-9']);
  assert.equal(e.verifyMap(map([{claimId:'bound',evidenceIds:['ev-1','ev-2']}]),set()).status,'MAP_BOUND');
  assert.equal(Object.isFrozen(result),true);
});

test('task mismatch and invalid inputs are MAP_INVALID, never partially bound',()=>{
  assert.equal(e.verifyMap(map([]),set({taskRef:'task-2'})).reasonCode,'TASK_MISMATCH');
  assert.equal(e.verifyMap({},set()).reasonCode,'MAP_INVALID');
  assert.equal(e.verifyMap(map([]),{}).reasonCode,'SET_INVALID');
  assert.equal(e.verifyMap(map([]),set()).status,'MAP_BOUND');
});

test('foreign-scope evidence is identified against the task context',()=>{
  assert.deepEqual([...e.foreignItems(set(),context)],['ev-3']);
  assert.deepEqual([...e.foreignItems({},context)],[]);
  assert.deepEqual([...e.foreignItems(set(),{...context,version:'x'})],['ev-1','ev-2','ev-3']);
});
