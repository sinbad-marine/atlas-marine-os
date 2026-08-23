'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const persona=require('../world-brain/persona.js');
const taxonomy=require('../world-brain/knowledge-taxonomy.js');
const freshness=require('../world-brain/freshness-policy.js');
const pack=require('../world-brain/knowledge-pack.js');
const router=require('../world-brain/topic-router.js');

test('persona stays model-independent and requires honesty and source disclosure',()=>{
  const profile=persona.buildSystemProfile({language:'tr-TR',audience:'academy'});
  assert.equal(profile.identity.name,'Captain Sinbad');
  assert.equal(profile.responseContract.citeRetrievedSources,true);
  assert.equal(profile.responseContract.discloseSnapshotDate,true);
  assert.equal(profile.responseContract.admitUncertainty,true);
  assert.equal(Object.isFrozen(profile),true);
});

test('taxonomy covers broad world knowledge and marks volatile domains',()=>{
  assert.ok(taxonomy.DOMAINS.length>=20);
  assert.equal(taxonomy.getDomain('history').freshness,'stable');
  assert.equal(taxonomy.getDomain('politics').freshness,'live');
  assert.equal(taxonomy.getDomain('economics').highStakes,true);
  assert.equal(taxonomy.getDomain('unknown'),null);
});

test('freshness policy accepts durable knowledge but blocks old current affairs',()=>{
  const stable=freshness.evaluate({freshness:'stable',snapshotDate:'2020-01-01',now:'2026-08-23'});
  const politics=freshness.evaluate({freshness:'live',snapshotDate:'2026-08-20',now:'2026-08-23'});
  assert.equal(stable.status,freshness.STATES.CURRENT);
  assert.equal(stable.usable,true);
  assert.equal(politics.status,freshness.STATES.LIVE_REQUIRED);
  assert.equal(politics.usable,false);
  assert.match(freshness.disclosure(politics),/güncel kaynak gerektiriyor/);
});

test('undated offline knowledge fails closed',()=>{
  const result=freshness.evaluate({freshness:'mixed'});
  assert.equal(result.status,freshness.STATES.UNDATED);
  assert.equal(result.usable,false);
});

test('knowledge packs require an allowlisted license and complete identity',()=>{
  const bytes=Buffer.from('Open history knowledge.');
  const manifest={schemaVersion:pack.VERSION,packId:'history-core-tr',title:'History Core',domain:'history',language:'tr-TR',license:'CC-BY-4.0',source:'https://example.test/history',publisher:'Example Publisher',edition:'2026.1',snapshotDate:'2026-08-01',contentHash:pack.contentHash(bytes),tags:['history']};
  const result=pack.validate(manifest);
  assert.equal(result.pack.domain,'history');
  assert.equal(result.installable,true);
  assert.throws(()=>pack.validate({...manifest,license:'UNKNOWN'}),error=>error.code==='LICENSE_REJECTED');
  assert.throws(()=>pack.validate({...manifest,contentHash:'bad'}),error=>error.code==='PACK_INVALID');
});

test('topic router selects multiple relevant domains without invoking a model',()=>{
  const result=router.route('Osmanlı tarihi ve dönemin edebiyatı hakkında anlat');
  assert.deepEqual(result.map(item=>item.domain.id),['history','literature']);
  assert.equal(result[0].score,1);
  assert.equal(router.route('Bunu açıklar mısın?')[0].domain.id,'reference');
});
