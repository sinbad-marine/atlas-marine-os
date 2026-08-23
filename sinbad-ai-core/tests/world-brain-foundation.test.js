'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const persona=require('../world-brain/persona.js');
const taxonomy=require('../world-brain/knowledge-taxonomy.js');
const freshness=require('../world-brain/freshness-policy.js');
const pack=require('../world-brain/knowledge-pack.js');
const router=require('../world-brain/topic-router.js');
const catalogModule=require('../world-brain/knowledge-catalog.js');
const sources=require('../world-brain/source-catalog.js');
const profiles=require('../world-brain/content-profiles.js');
const acquisition=require('../world-brain/acquisition-plan.js');
const kiwix=require('../world-brain/kiwix-search-provider.js');

function manifestFor(bytes,overrides={}){
  return {schemaVersion:pack.VERSION,packId:'history-core-tr',title:'History Core',domain:'history',language:'tr-TR',license:'CC-BY-4.0',source:'https://example.test/history',publisher:'Example Publisher',edition:'2026.1',snapshotDate:'2026-08-01',contentHash:pack.contentHash(bytes),tags:['history'],...overrides};
}

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
  const manifest=manifestFor(bytes);
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

test('catalog installs immutable packs idempotently and rejects changed content',()=>{
  let tick=0;const catalog=catalogModule.create({now:()=>`2026-08-23T00:00:0${tick++}.000Z`});
  const bytes=Buffer.from('Open history knowledge.');
  const manifest=manifestFor(bytes);
  assert.equal(catalog.install(manifest,bytes).status,'INSTALLED');
  assert.equal(catalog.install(manifest,bytes).status,'ALREADY_INSTALLED');
  assert.equal(catalog.snapshot().packs.length,1);
  assert.throws(()=>catalog.install(manifest,Buffer.from('changed')),error=>error.code==='PACK_HASH_MISMATCH');
  assert.throws(()=>catalog.remove('history-core-tr'),error=>error.code==='PACK_REMOVAL_NOT_AUTHORIZED');
});

test('catalog answer plan keeps stable knowledge and blocks stale current affairs',()=>{
  const catalog=catalogModule.create({now:()=> '2026-08-23T00:00:00.000Z'});
  const history=Buffer.from('History corpus');
  const news=Buffer.from('News corpus');
  catalog.install(manifestFor(history,{contentHash:pack.contentHash(history)}),history);
  catalog.install(manifestFor(news,{packId:'media-news-tr',title:'News Snapshot',domain:'media',source:'https://example.test/news',snapshotDate:'2026-08-10',contentHash:pack.contentHash(news),tags:['news']}),news);
  const historyPlan=catalog.plan('Osmanlı tarihi nedir?',{now:'2026-08-23'});
  const newsPlan=catalog.plan('Bugünün haber ve magazin gündemi nedir?',{now:'2026-08-23'});
  assert.equal(historyPlan.eligible.length,1);
  assert.equal(newsPlan.eligible.length,0);
  assert.equal(newsPlan.requiresLiveSource,true);
});

test('upstream source catalog is deny-by-default and records rights and freshness',()=>{
  assert.ok(sources.SOURCES.length>=5);
  for(const source of sources.SOURCES){
    assert.equal(source.enabled,false);
    assert.ok(source.license);
    assert.ok(source.updateCadence);
    assert.ok(source.officialCatalog.startsWith('https://'));
  }
  assert.equal(sources.getSource('kiwix-wikipedia-tr-mini').recommendedProfile,'light');
  assert.equal(sources.getSource('project-gutenberg-curated').requiresPerItemLicense,true);
});

test('unsafe bulk enabling and unlicensed image sources fail closed',()=>{
  const perItem={...sources.getSource('wikimedia-curated-visuals'),enabled:true};
  assert.throws(()=>sources.validateSource(perItem),/cannot be globally enabled/);
  const unsafe={...sources.getSource('kiwix-wikipedia-tr-mini'),enabled:true,containsImages:true,imageLicensePolicy:'NONE'};
  assert.throws(()=>sources.validateSource(unsafe),/image license policy/);
});

test('content profiles scale from a small offline brain to a curated academy',()=>{
  assert.deepEqual(profiles.listProfiles().map(item=>item.id),['light','standard','academy','archive']);
  assert.equal(profiles.getProfile('academy').images,'curated-and-attributed');
  assert.equal(profiles.getProfile('missing'),null);
});

test('initial Turkish offline artifact is pinned but cannot download without exact approval',()=>{
  const plan=acquisition.build();
  assert.equal(plan.state,acquisition.STATES.AWAITING_APPROVAL);
  assert.equal(plan.artifact.reportedSize,'124M');
  assert.equal(plan.safety.downloadStarted,false);
  assert.match(plan.artifact.url,/^https:\/\/download\.kiwix\.org\//);
  assert.throws(()=>acquisition.approve(plan,'yes'),/exact artifact confirmation/);
  const approved=acquisition.approve(plan,`DOWNLOAD:${plan.artifact.fileName}`);
  assert.equal(approved.state,acquisition.STATES.APPROVED);
  assert.equal(approved.safety.downloadStarted,false);
});

test('Kiwix search provider is loopback-only and uses the documented XML search API',()=>{
  const url=kiwix.searchUrl('http://127.0.0.1:8181/','Osmanlı tarihi',{pageLength:99});
  assert.match(url,/127\.0\.0\.1:8181\/search/);
  assert.match(url,/pattern=Osmanl%C4%B1\+tarihi/);
  assert.match(url,/pageLength=20/);
  assert.match(url,/format=xml/);
  assert.throws(()=>kiwix.searchUrl('https://example.com/','test'),/loopback-only/);
});
