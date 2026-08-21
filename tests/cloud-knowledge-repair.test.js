'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');

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
