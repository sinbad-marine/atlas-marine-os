const test=require('node:test');
const assert=require('node:assert/strict');
const auditModule=require('../orchestrator/audit-log.js');

test('creates ordered immutable audit entries',()=>{
  const audit=auditModule.create({now:()=> '2026-08-10T12:00:00.000Z'});
  audit.append('intent','intent-engine','passed','navigation',{confidence:.9});
  audit.append('safety','safety-engine','passed','high');
  const entries=audit.snapshot();
  assert.deepEqual(entries.map(x=>x.sequence),[1,2]);
  assert.equal(entries[0].engine,'intent-engine');
  assert.equal(Object.isFrozen(entries[0]),true);
  assert.equal(Object.isFrozen(entries),true);
});

