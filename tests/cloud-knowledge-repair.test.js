'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const edge=fs.readFileSync('supabase/functions/sinbad-answer/index.ts','utf8');

test('cloud AI returns a separate semantic spoken teaching summary instead of forcing the browser to clip the written answer',()=>{
  assert.match(edge,/const SPOKEN_SUMMARY_MARKER = '<<<SPOKEN_SUMMARY>>>';/);
  assert.match(edge,/For simple or conversational questions use 1 or 2 short sentences/);
  assert.match(edge,/Never introduce Atlas Marine, advertise the platform/);
  assert.match(edge,/Do not merely copy the first characters/);
  assert.match(edge,/return json\(\{ answer: deliveredAnswer, spokenSummary: deliveredSpokenSummary, sources: responseSources,/);
  assert.match(app,/sinbadModelSpokenSummary=String\(trustedAiData\.spokenSummary\|\|''\)\.trim\(\)/);
});

test('cloud document centre can locate older source files by title',()=>{
  assert.match(html,/id="cloudFileSearch"/);
  assert.match(html,/id="searchCloudFiles"/);
  assert.match(app,/query=query\.ilike\('title',`%\$\{search\.replace/);
  assert.match(app,/\$\('searchCloudFiles'\)\?\.addEventListener\('click',loadCloudFiles\)/);
});

test('authorized owner can rebuild AI chunks from an existing cloud document',()=>{
  assert.match(app,/async function repairCloudDocumentKnowledge\(documentId,bucket,path,filename\)/);
  assert.match(app,/cloudClient\.storage\.from\(bucket\)\.download\(path\)/);
  assert.match(app,/extractDocumentText\(file/);
  assert.match(app,/saveDocumentKnowledge\(documentId,file,text,bucket\)/);
  assert.match(app,/class="btn cloud-repair-knowledge"/);
  assert.match(app,/if\(k\)repairCloudDocumentKnowledge/);
});

test('named-source misses recover through title-matched knowledge chunks',()=>{
  assert.match(app,/metni \(\?:yer almad/);
  assert.match(app,/from\('document_knowledge'\).*ilike\('title'/s);
  assert.match(app,/\.in\('knowledge_id',titleMatches\.map/);
  assert.match(app,/titleMatches\.length/);
});

test('server RAG resolves named publications by title before synthesis',()=>{
  assert.match(edge,/from\('document_knowledge'\)[\s\S]*?ilike\('title'/);
  assert.match(edge,/sourceTitleScore\(String\(row\.title \|\| ''\), retrievalQuestion, expandedTitleTerms\)/);
  assert.match(edge,/b\.score - a\.score/);
  assert.match(edge,/\.in\('knowledge_id', titleMatches\.map/);
  assert.match(edge,/namedSourceBonus \+ queryTerms\.reduce/);
  assert.match(edge,/APPROVED PRIVATE LIBRARY \$\{canAccessPrivateSources \? 'SOURCES' : 'EXCERPTS \(IDENTITY RESTRICTED\)'\}/);
  assert.match(edge,/\[PRIVATE_EXCERPT_\$\{index \+ 1\}\]/);
});

test('an explicitly named publication is locked before generic session-title matches',()=>{
  assert.match(edge,/const normalizedSourceName =/);
  assert.match(edge,/normalizedQuestion\.includes\(normalizedTitle\)/);
  assert.match(edge,/exactNamedSource \? 1000 : 0/);
  assert.match(edge,/exactNamedTitleMatches\.length \? exactNamedTitleMatches : scoredTitleMatches/);
  assert.match(app,/function normalizeSinbadSourceName\(value\)/);
  assert.match(app,/const exactNamedTitleMatches=scoredTitleMatches\.filter/);
  assert.match(app,/exactNamedTitleMatches\.length\?exactNamedTitleMatches:scoredTitleMatches/);
});

test('server title lookup expands bounded multilingual maritime aliases',()=>{
  assert.match(edge,/const TITLE_ALIASES/);
  assert.match(edge,/classification: \['klas'/);
  assert.match(edge,/construction: \['inşa', 'insa'/);
  assert.match(edge,/ships: \['gemi', 'gemileri'/);
  assert.match(edge,/const expandedTitleTerms = titleTerms\(queryTerms\)/);
  assert.match(edge,/Promise\.all\(expandedTitleTerms\.slice\(0, 18\)\.map/);
  assert.match(edge,/Promise\.all\(queryTerms\.slice\(0, 5\)\.map/);
});

test('simple greetings return immediately without retrieval or an advertising monologue',()=>{
  assert.match(edge,/const isSimpleGreeting =/);
  assert.match(edge,/Selam Kaptan, sizi dinliyorum\./);
  assert.match(edge,/mode: 'local-greeting'/);
  assert.ok(edge.indexOf('if (isSimpleGreeting(question))')<edge.indexOf('const expandedTitleTerms = titleTerms(queryTerms)'));
});

test('visual teaching requests return only verified indexed PDF pages',()=>{
  assert.match(edge,/const wantsSourceVisuals =/);
  assert.match(edge,/const pageForChunk =/);
  assert.ok(edge.includes('const pagePattern = /\\[Page\\s+(\\d+)\\]/gi;'));
  assert.match(edge,/sources\.filter\(\(source: any\) => source\.documentId && source\.page && \/pdf\/i\.test/);
  assert.match(edge,/kind: 'pdf-page'/);
  assert.match(edge,/VERIFIED SOURCE PAGE VISUALS/);
  assert.match(edge,/return json\(\{ answer: deliveredAnswer, spokenSummary: deliveredSpokenSummary, sources: responseSources, visuals,/);
});

test('Sinbad renders source visuals as authenticated on-demand PDF pages',()=>{
  assert.match(app,/function sinbadVisualCards\(visuals=\[\]\)/);
  assert.match(app,/data-document-id="\$\{esc\(visual\.documentId\)\}"/);
  assert.match(app,/async function openSinbadSourceVisual\(button\)/);
  assert.match(app,/from\('documents'\).*eq\('workspace_id',selectedWorkspaceId\).*eq\('id',documentId\)/s);
  assert.match(app,/storage\.from\(documentRow\.bucket_id\)\.download\(documentRow\.object_path\)/);
  assert.match(app,/view\.pdf\.getPage\(view\.page\)/);
  assert.match(app,/page\.render\(\{canvasContext:view\.canvas\.getContext\('2d'\),viewport\}\)/);
});

test('source visual viewer supports pagination, zoom, fullscreen and keyboard navigation',()=>{
  assert.match(app,/function createSinbadSourceViewer\(view,\{dialog=false\}=\{\}\)/);
  assert.match(app,/function openSinbadSourceDialog\(sourceView\)/);
  assert.match(app,/Önceki sayfa/);assert.match(app,/Sonraki sayfa/);assert.match(app,/Yakınlaştırmayı sıfırla/);
  assert.match(app,/event\.key==='ArrowLeft'/);assert.match(app,/event\.key==='ArrowRight'/);assert.match(app,/dialog\.showModal\(\)/);
});
