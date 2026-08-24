const test=require('node:test');
const assert=require('node:assert/strict');
const intent=require('../intent-engine.js');

test('detects navigation questions in Turkish',()=>{
  const result=intent.analyze('Akıntıya göre tutulacak rotayı hesapla');
  assert.equal(result.intent,'navigation');
  assert.equal(result.language,'tr');
  assert.ok(result.confidence>=0.8);
});

test('gives emergency language the highest priority',()=>{
  const result=intent.analyze('Mayday, gemi su alıyor; mevkim 40 kuzey');
  assert.equal(result.intent,'emergency');
  assert.ok(result.secondaryIntents.includes('vessel')||result.secondaryIntents.includes('navigation'));
});

test('recognizes separate expert domains',()=>{
  assert.equal(intent.analyze('SOLAS publication edition').intent,'publication');
  assert.equal(intent.analyze('Crew STCW certificate expiry').intent,'crew');
  assert.equal(intent.analyze('Belge kütüphanesinde harita ara').intent,'document');
  assert.equal(intent.analyze('Bana COLREG dersi öğret').intent,'publication');
});

test('returns general with explicit low confidence for unmatched text',()=>{
  const result=intent.analyze('Merhaba Sinbad');
  assert.equal(result.intent,'general');
  assert.equal(result.confidence,0.35);
});

test('does not classify a product identity as a Core training intent',()=>{
  const result=intent.analyze('academy');
  assert.equal(result.intent,'general');assert.equal(result.confidence,0.35);
});

test('does not mutate the published evidence',()=>{
  const result=intent.analyze('Passage plan and weather');
  assert.equal(Object.isFrozen(result),true);
  assert.equal(Object.isFrozen(result.evidence),true);
});

