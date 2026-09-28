'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');

const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const manifestPath='assets/console-art/documents-compliance-owner-selections-v1/OWNER_VISUAL_LOCK.json';
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const release=fs.readFileSync('tools/build-pages-artifact.js','utf8');
const contract=JSON.parse(fs.readFileSync('config/ui-design-contract.json','utf8'));

test('Documents and Compliance Owner selection C remains byte-for-byte locked',()=>{
  assert.equal(manifest.status,'OWNER_APPROVED_LOCKED');
  assert.equal(manifest.ownerChoice,'C');
  assert.equal(manifest.artistLanguage,'johannes-vermeer');
  assert.equal(manifest.languageBaseline,'en');
  assert.equal(manifest.immutable,true);
  for(const [name,asset] of Object.entries(manifest.assets)){
    const path=`assets/console-art/documents-compliance-owner-selections-v1/${asset.path}`;
    assert.equal(sha256(fs.readFileSync(path)),asset.sha256,name);
    assert.match(release,new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&'),'u'),name);
  }
});

test('Documents and Compliance keeps the selected register composition truthful',()=>{
  const landing=html.match(/<section id="documents-compliance"[\s\S]*?<\/section>\s*<section id="technical-systems"/u)?.[0]||'';
  assert.match(landing,/class="workspace documents-compliance-page"/u);
  assert.match(landing,/No verified records loaded/u);
  assert.match(landing,/SINBAD will not infer compliance from missing evidence/u);
  assert.equal((landing.match(/class="dc-function-card"/gu)||[]).length,4);
  for(const id of ['cloud-documents','documents','knowledge','document-submissions'])assert.match(landing,new RegExp(`data-open="${id}"`,'u'),id);
  assert.doesNotMatch(landing,/data-open="(?:charts|publications)"/u);
  assert.doesNotMatch(landing,/Safety Management Certificate|International Ship Security Certificate|1\s*[–-]\s*8 of 8/u);
  assert.match(app,/parent==='documents-compliance'\?'vermeer'/u);
});

test('Documents and Compliance lock is represented in the UI contract',()=>{
  const baseline=contract.approvedVisualBaselines.documentsCompliance;
  const lock=contract.ownerVisualLocks.documentsComplianceLanding;
  assert.equal(baseline.ownerChoice,'C');
  assert.equal(baseline.sha256,manifest.assets.hero.sha256);
  assert.equal(lock.ownerChoice,'C');
  assert.deepEqual(lock.functionalCards,manifest.functionalCards);
  assert.deepEqual(lock.forbiddenDuplications,manifest.forbiddenDuplications);
});
