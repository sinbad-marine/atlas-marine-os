'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const edge=fs.readFileSync('supabase/functions/sinbad-answer/index.ts','utf8');

test('cloud AI returns a separate semantic spoken teaching summary instead of forcing the browser to clip the written answer',()=>{
  assert.match(edge,/const SPOKEN_SUMMARY_MARKER = '<<<SPOKEN_SUMMARY>>>';/);
  assert.match(edge,/3 to 6 complete sentences and roughly 60 to 110 words/);
  assert.match(edge,/Do not merely copy the first characters/);
  assert.match(edge,/return json\(\{ answer, spokenSummary, sources,/);
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
  assert.match(edge,/title\.includes\(term\) \? 1 : 0/);
  assert.match(edge,/b\.score - a\.score/);
  assert.match(edge,/\.in\('knowledge_id', titleMatches\.map/);
  assert.match(edge,/title\.includes\(term\) \? 3 : 0/);
  assert.match(edge,/APPROVED PRIVATE LIBRARY SOURCES/);
});

test('server title lookup expands bounded multilingual maritime aliases',()=>{
  assert.match(edge,/const TITLE_ALIASES/);
  assert.match(edge,/classification: \['klas'/);
  assert.match(edge,/construction: \['inşa', 'insa'/);
  assert.match(edge,/ships: \['gemi', 'gemileri'/);
  assert.match(edge,/const expandedTitleTerms = titleTerms\(queryTerms\)/);
  assert.match(edge,/for \(const term of expandedTitleTerms\.slice\(0, 18\)\)/);
});
