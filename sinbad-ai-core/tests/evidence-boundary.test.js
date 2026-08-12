const test=require('node:test');
const assert=require('node:assert/strict');
const boundary=require('../memory/evidence-boundary.js');

test('labels memory as advisory context only',()=>{
  const item=boundary.labelMemory({id:'s1',value:'Last discussed route'});
  assert.equal(item.authority,'advisory');
  assert.equal(item.mayReplaceOfficialSource,false);
  assert.match(item.warning,/not a verified maritime source/);
});

test('keeps verified sources separate from memory',()=>{
  const groups=boundary.partition([
    {id:'m1',kind:'persistent',value:'User note'},
    {content:'Official notice',provenance:{authority:'authoritative',sourceId:'ntm-1'}}
  ]);
  assert.equal(groups.memory.length,1);
  assert.equal(groups.verified.length,1);
  assert.equal(groups.verified[0].sourceId,'ntm-1');
});

test('refuses to label advisory material as verified',()=>{
  assert.throws(()=>boundary.labelVerifiedSource({content:'memory',provenance:{authority:'advisory'}}));
});

