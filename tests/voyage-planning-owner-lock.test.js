'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');

const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const canonicalCrlfBytes=bytes=>Buffer.from(bytes.toString('utf8').replace(/\r\n?/gu,'\n').replace(/\n/gu,'\r\n'),'utf8');
const manifestPath='assets/console-art/voyage-planning-owner-selections-v1/OWNER_VISUAL_LOCK.json';
const manifestBytes=fs.readFileSync(manifestPath);
const manifest=JSON.parse(manifestBytes);
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const release=fs.readFileSync('tools/build-pages-artifact.js','utf8');
const contract=JSON.parse(fs.readFileSync('config/ui-design-contract.json','utf8'));

test('Voyage Planning Owner selections remain byte-for-byte locked',()=>{
  assert.equal(sha256(canonicalCrlfBytes(manifestBytes)),'a596dbd7cefb486c229ad005c2f9262b503dc733cdfcbb79e610d8f41647c3a8');
  assert.equal(manifest.status,'OWNER_APPROVED_LOCKED');
  assert.equal(manifest.artistLanguage,'leonardo-da-vinci');
  assert.equal(manifest.languageBaseline,'en');
  assert.equal(manifest.immutable,true);
  assert.deepEqual(manifest.selectionOrder,['A','C','C','B','C','C','A','B']);
  for(const [key,layer] of Object.entries(manifest.layers)){
    assert.equal(sha256(fs.readFileSync(layer.asset)),layer.sha256,key);
    assert.match(html,new RegExp(layer.asset.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&'),'u'),key);
    assert.match(release,new RegExp(layer.asset.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&'),'u'),key);
  }
});

test('Voyage Planning exposes the approved Da Vinci page hierarchy',()=>{
  const landing=html.match(/<section id="voyage-navigation"[\s\S]*?<\/section>/u)?.[0]||'';
  assert.match(landing,/data-master="da-vinci"/u);
  assert.match(landing,/data-owner-selections="A-C-C-B-C-C-A-B"/u);
  assert.equal((landing.match(/voyage-function-card/gu)||[]).length,7);
  for(const id of ['routes','navigation-plot','location-intelligence','publications','resources','enc-viewer','charts'])assert.match(landing,new RegExp(`data-open="${id}"`,'u'),id);
  for(const [key,layer] of Object.entries(manifest.layers)){
    const id=new URL(`https://sinbad.invalid${layer.route}`).searchParams.get('workspace');
    const opening=html.match(new RegExp(`<section id=\"${id}\"[^>]*>`,'u'))?.[0]||'';
    if(id==='voyage-navigation')assert.match(opening,/data-owner-selections="A-C-C-B-C-C-A-B"/u,key);
    else assert.match(opening,new RegExp(`data-owner-selection=\"${layer.selection}\"`,'u'),key);
  }
  assert.match(app,/parent==='voyage-navigation'\?'da-vinci'/u);
});

test('Voyage Planning uses English as the source UI language',()=>{
  assert.match(html,/<html lang="en">/u);
  assert.match(app,/appLanguage=localStorage\.getItem\('atlas_app_language'\)\|\|'en-US'/u);
  assert.match(html,/<span>Voyage Planning<\/span>/u);
  assert.match(html,/<h2>Nautical Publications<\/h2>/u);
  assert.match(html,/<h2>Coastal Pilotage Directory<\/h2>/u);
  assert.doesNotMatch(html,/id="encPassageStatus"[^>]*>[^<]*(?:rota|yalnız|yerel)/iu);
});

test('Voyage Planning lock is in the design contract and release allowlist',()=>{
  const lock=contract.ownerVisualLocks.voyagePlanningInnerLayers;
  assert.equal(lock.manifestSha256,sha256(canonicalCrlfBytes(manifestBytes)));
  assert.deepEqual(lock.ownerChoices,manifest.selectionOrder);
  assert.equal((release.match(/voyage-planning-owner-selections-v1\/selected\//gu)||[]).length,8);
  assert.match(release,/voyage-planning-owner-selections-v1\/OWNER_VISUAL_LOCK\.json/u);
});
