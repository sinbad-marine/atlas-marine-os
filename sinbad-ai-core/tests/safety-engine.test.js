const test=require('node:test');
const assert=require('node:assert/strict');
const intent=require('../intent-engine.js');
const safety=require('../safety-engine.js');

test('blocks autonomous action during an emergency',()=>{
  const result=safety.assess(intent.analyze('Mayday, yangın var'));
  assert.equal(result.risk,'critical');
  assert.equal(result.blockedFromAutonomousAction,true);
  assert.ok(result.gates.some(item=>item.code==='EMERGENCY_HUMAN_COMMAND'&&item.blocking));
});

test('marks operational navigation calculations high risk',()=>{
  const result=safety.assess(intent.analyze('Tutulacak rotayı hesapla'));
  assert.equal(result.risk,'high');
  assert.equal(result.requiresHumanApproval,true);
  assert.equal(result.requiresIndependentVerification,true);
});

test('requires authoritative live data without pretending to have it',()=>{
  const result=safety.assess(intent.analyze('Bugünkü hava ve liman durumu nedir?'));
  assert.equal(result.needsLiveData,true);
  assert.ok(result.gates.some(item=>item.code==='LIVE_DATA_REQUIRED'));
});

test('keeps ordinary informational questions low risk',()=>{
  const result=safety.assess(intent.analyze('Merhaba Sinbad'));
  assert.equal(result.risk,'low');
  assert.equal(result.gates.length,0);
});

test('returns immutable safety gates and warning messages',()=>{
  const result=safety.assess(intent.analyze('Rota hesapla'));
  const warnings=safety.warningMessages(result);
  assert.equal(Object.isFrozen(result.gates),true);
  assert.equal(Object.isFrozen(warnings),true);
  assert.ok(warnings.length>0);
});

