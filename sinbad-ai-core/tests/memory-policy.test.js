const test=require('node:test');
const assert=require('node:assert/strict');
const policy=require('../memory/policy.js');

test('requires explicit consent for durable memory',()=>{
  assert.equal(policy.persistentDecision('Captain prefers concise answers').reason,'EXPLICIT_CONSENT_REQUIRED');
});

test('rejects sensitive and temporary durable memories',()=>{
  assert.equal(policy.persistentDecision('Passport 12345',{explicitConsent:true}).reason,'SENSITIVE_DATA');
  assert.equal(policy.persistentDecision('Current position 40N 026E',{explicitConsent:true}).reason,'TEMPORARY_DATA');
});

test('rejects operational and safety-critical durable memories',()=>{
  assert.equal(policy.persistentDecision('Course to steer 120',{explicitConsent:true,category:'operational'}).reason,'TEMPORARY_DATA');
  assert.equal(policy.persistentDecision('Mayday fire response',{explicitConsent:true}).reason,'SAFETY_CRITICAL_DATA');
});

test('allows a consented non-sensitive durable preference note',()=>{
  assert.equal(policy.persistentDecision('Use concise explanations',{explicitConsent:true}).allowed,true);
});

test('never upgrades memory provenance to authoritative',()=>{
  const value=policy.provenance({sourceType:'memory',authority:'authoritative',sourceId:'m1'});
  assert.equal(value.authority,'advisory');
});

