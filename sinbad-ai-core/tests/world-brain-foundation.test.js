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
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');

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

test('live Bridge routes durable questions to loopback Kiwix and blocks stale or high-risk evidence',()=>{
  const bridge=fs.readFileSync('bridge/sinbad-bridge.ps1','utf8');
  assert.match(bridge,/\[string\]\$KiwixUrl = 'http:\/\/127\.0\.0\.1:8181'/);
  assert.match(bridge,/function Get-KiwixKnowledge/);
  assert.match(bridge,/books\.filter\.lang=tur/);
  assert.match(bridge,/BLOCKED_STALE_OR_HIGH_RISK/);
  assert.match(bridge,/offline-world-rag/);
  assert.match(bridge,/KIWIX_LOOPBACK_ONLY/);
  assert.match(bridge,/stream=\$false; think=\$true/);
  assert.match(bridge,/function Invoke-QwenFinalAnswerRetry/);
  assert.match(bridge,/\$draftLimit = 6000/);
  assert.match(bridge,/finalAnswerRetryUsed=\$finalAnswerRetryUsed/);
  assert.match(bridge,/answer=\$answer/);
  assert.doesNotMatch(bridge,/answer=\$result\.message\.thinking/);
  assert.doesNotMatch(bridge,/answer=\$privateDraft/);
  assert.doesNotMatch(bridge,/--address=(?:all|ipv4|ipv6)/);
});

test('Qwen empty-final recovery is bounded and never returns private thinking',()=>{
  const bridge=fs.readFileSync('bridge/sinbad-bridge.ps1','utf8');
  const start=bridge.indexOf('function Invoke-QwenFinalAnswerRetry');
  const end=bridge.indexOf('\nfunction Invoke-SinbadLocalAi',start);
  const retry=bridge.slice(start,end);
  assert.match(retry,/Substring\(\$privateDraft\.Length - \$draftLimit\)/);
  assert.match(retry,/num_ctx=8192; num_predict=1024/);
  assert.match(retry,/\$retryResult\.message\.content/);
  assert.doesNotMatch(retry,/return .*thinking/);
  assert.doesNotMatch(retry,/answer=\$boundedDraft/);
});

test('Qwen fast final path is bounded, neutralizes ChatML injection and returns only post-thinking content',()=>{
  const bridge=fs.readFileSync('bridge/sinbad-bridge.ps1','utf8');
  const start=bridge.indexOf('function Convert-ToSafeQwenChatText');
  const end=bridge.indexOf('\nfunction Invoke-SinbadLocalAi',start);
  const fast=bridge.slice(start,end);
  assert.match(fast,/Replace\('<\|im_start\|>'/);
  assert.match(fast,/Replace\('<\|im_end\|>'/);
  assert.match(fast,/api\/generate/);
  assert.match(fast,/raw=\$true/);
  assert.match(fast,/num_ctx=8192; num_predict=512/);
  assert.match(fast,/LastIndexOf\(\$closingTag/);
  assert.match(fast,/Substring\(\$closingIndex \+ \$closingTag\.Length\)/);
  assert.match(fast,/FAST_FINAL_BOUNDARY_VIOLATION/);
  assert.doesNotMatch(fast,/answer=\$raw/);
});

test('ordinary fast turns use the bounded final path while deep turns retain separated thinking',()=>{
  const bridge=fs.readFileSync('bridge/sinbad-bridge.ps1','utf8');
  const start=bridge.indexOf('function Invoke-SinbadLocalAi');
  const end=bridge.indexOf('\nif (Test-Path -LiteralPath $indexPath)',start);
  const runtime=bridge.slice(start,end);
  assert.match(runtime,/if \(\$selection\.tier -eq 'fast'\)/);
  assert.match(runtime,/Invoke-QwenFastFinalAnswer \$selection \$messages/);
  assert.match(runtime,/fastFinalPathUsed=\$fastFinalPathUsed/);
  assert.match(runtime,/\$predictBudget = if \(\$selection\.tier -eq 'fast'\) \{ 1024 \} else \{ 2048 \}/);
  assert.match(runtime,/think=\$true/);
});

test('stable direct questions bypass irrelevant library and Kiwix retrieval on the fast path',()=>{
  const bridge=fs.readFileSync('bridge/sinbad-bridge.ps1','utf8');
  const classifierStart=bridge.indexOf('function Test-SinbadDirectFastQuestion');
  const runtimeStart=bridge.indexOf('function Invoke-SinbadLocalAi',classifierStart);
  const classifier=bridge.slice(classifierStart,runtimeStart);
  const runtimeEnd=bridge.indexOf('\nif (Test-Path -LiteralPath $indexPath)',runtimeStart);
  const runtime=bridge.slice(runtimeStart,runtimeEnd);
  assert.match(classifier,/Length -gt 120/);
  assert.match(classifier,/merhaba\|selam/);
  assert.match(classifier,/hello\|hi/);
  assert.match(classifier,/kaç eder\|nedir\|sonucu/);
  assert.match(runtime,/\$directFastQuestion = Test-SinbadDirectFastQuestion \$question/);
  assert.match(runtime,/if \(\$directFastQuestion\) \{ '' \} else \{ Get-LocalLibraryContext \$question \}/);
  assert.match(runtime,/state='NOT_REQUIRED'/);
  assert.match(runtime,/reason='stable-direct-question'/);
});

test('greetings and bounded arithmetic use an instant deterministic answer without model reasoning',()=>{
  const bridge=fs.readFileSync('bridge/sinbad-bridge.ps1','utf8');
  const resolverStart=bridge.indexOf('function Resolve-SinbadDirectStableAnswer');
  const runtimeStart=bridge.indexOf('function Invoke-SinbadLocalAi',resolverStart);
  const resolver=bridge.slice(resolverStart,runtimeStart);
  const runtimeEnd=bridge.indexOf('\nif (Test-Path -LiteralPath $indexPath)',runtimeStart);
  const runtime=bridge.slice(runtimeStart,runtimeEnd);
  assert.match(resolver,/System\.Data\.DataTable/);
  assert.match(resolver,/Replace\('×','\*'\).*Replace\('÷','\/'\)/);
  assert.match(resolver,/Merhaba kaptan/);
  assert.match(resolver,/Hello, Captain/);
  assert.match(resolver,/Hallo, Kapitän/);
  assert.match(runtime,/\$stableAnswer = Resolve-SinbadDirectStableAnswer \$question/);
  assert.match(runtime,/model='sinbad-deterministic-core'/);
  assert.match(runtime,/modelTier='instant'/);
  assert.match(runtime,/mode='offline-deterministic'/);
  assert.match(runtime,/reasons=@\('stable-direct-answer'\)/);
});

test('fast answer system prompt remains concise while preserving safety and source qualifications',()=>{
  const bridge=fs.readFileSync('bridge/sinbad-bridge.ps1','utf8');
  const start=bridge.indexOf('function Invoke-QwenFastFinalAnswer');
  const end=bridge.indexOf('\nfunction Test-SinbadDirectFastQuestion',start);
  const fast=bridge.slice(start,end);
  assert.match(fast,/Reply directly, accurately and concisely in the user language/);
  assert.match(fast,/Keep supplied source qualifications and cite their titles/);
  assert.match(fast,/Never reveal private reasoning/);
  assert.match(fast,/Never take external actions/);
});

test('local AI transport is UTF-8 loopback-only and preserves HTTP failures',()=>{
  const bridge=fs.readFileSync('bridge/sinbad-bridge.ps1','utf8');
  const start=bridge.indexOf('function Invoke-LocalJsonPost');
  const end=bridge.indexOf('\nfunction Write-HttpResponse',start);
  const transport=bridge.slice(start,end);
  assert.match(transport,/LOCAL_AI_ENDPOINT_DENIED/);
  assert.match(transport,/StringContent.*Encoding\]::UTF8/);
  assert.match(transport,/IsSuccessStatusCode/);
  assert.doesNotMatch(transport,/curl\.exe/);
});

function routeQwen(question,options={}){
  const router=fs.realpathSync('bridge/qwen-tier-router.ps1').replaceAll("'","''");
  const payload=Buffer.from(JSON.stringify({question,...options}),'utf8').toString('base64');
  const script=`. '${router}'; $p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}'))|ConvertFrom-Json; Select-SinbadModelTier -Question $p.question -HistoryCount ([int]$p.historyCount) -EvidenceLength ([int]$p.evidenceLength) -RequestedDepth ([string]$p.depth) -FastModel 'qwen3:4b' -DeepModel 'qwen3:14b' -AvailableModels @('qwen3:4b','qwen3:14b') | ConvertTo-Json -Depth 6 -Compress`;
  const run=spawnSync('pwsh',['-NoProfile','-Command',script],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  return JSON.parse(run.stdout.trim());
}

test('two-tier Qwen router keeps ordinary offline questions on the fast local model',()=>{
  const result=routeQwen('Osmanlı İmparatorluğu hangi yüzyılda kuruldu?');
  assert.equal(result.tier,'fast');
  assert.equal(result.model,'qwen3:4b');
  assert.deepEqual(result.reasons,['default-fast-path']);
});

test('two-tier Qwen router sends explicit deep technical work to the deep local model',()=>{
  const result=routeQwen('Bu rota planını risk değerlendirmesiyle derinlemesine analiz et.',{depth:'deep',evidenceLength:8000,historyCount:9});
  assert.equal(result.tier,'deep');
  assert.equal(result.model,'qwen3:14b');
  assert.ok(result.complexityScore>=2);
});

test('two-tier Qwen router records a safe fallback when the preferred model is unavailable',()=>{
  const router=fs.realpathSync('bridge/qwen-tier-router.ps1').replaceAll("'","''");
  const script=`. '${router}'; Select-SinbadModelTier -Question 'Kısa soru' -FastModel 'qwen3:4b' -DeepModel 'qwen3:14b' -AvailableModels @('qwen3:14b') | ConvertTo-Json -Depth 6 -Compress`;
  const run=spawnSync('pwsh',['-NoProfile','-Command',script],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const result=JSON.parse(run.stdout.trim());
  assert.equal(result.model,'qwen3:14b');
  assert.equal(result.fallbackUsed,true);
  assert.ok(result.reasons.includes('preferred-model-unavailable'));
});
