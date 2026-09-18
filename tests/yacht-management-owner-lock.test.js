'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');

const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const lockPath='assets/console-art/yacht-management-owner-selections-v1/OWNER_VISUAL_LOCK.json';
const lockBytes=fs.readFileSync(lockPath);
const lock=JSON.parse(lockBytes);
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('console-master-style.css','utf8');
const app=fs.readFileSync('app.js','utf8');
const release=fs.readFileSync('tools/build-pages-artifact.js','utf8');
const contract=JSON.parse(fs.readFileSync('config/ui-design-contract.json','utf8'));
const canonicalLockPath='assets/console-art/yacht-management-owner-lock-v1/OWNER_CANONICAL_LOCK.json';
const canonicalLockBytes=fs.readFileSync(canonicalLockPath);
const canonicalLock=JSON.parse(canonicalLockBytes);
const canonicalAssetPath=canonicalLock.canonicalAsset.path;
const canonicalAssetBytes=fs.readFileSync(canonicalAssetPath);
const goldenPath=canonicalLock.desktopGolden.path;

test('Yacht Management Owner visual manifest remains byte-for-byte locked',()=>{
  assert.equal(sha256(lockBytes),'fdb7b3eeef0b151850712104aadfdeec5aa55b18ab6f55f463e6b80692506aed');
  assert.equal(lock.page,'yacht-management');
  assert.equal(lock.artistLanguage,'rembrandt');
  assert.deepEqual(lock.selections.map(item=>item.ownerChoice),['C','B','B','B','A']);
  for(const item of lock.selections){
    assert.equal(item.locked,true,item.key);
    const path=`assets/console-art/yacht-management-owner-selections-v1/${item.selectedAsset}`;
    assert.equal(sha256(fs.readFileSync(path)),item.selectedAssetSha256,item.key);
    assert.match(html,new RegExp(item.selectedAsset.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&'),'u'),item.key);
    assert.match(release,new RegExp(item.selectedAsset.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&'),'u'),item.key);
  }
});

test('Yacht Management uses only the locked route composition and real destinations',()=>{
  const page=html.match(/<section id="yacht-operations"[\s\S]*?<\/section>/u)?.[0]||'';
  assert.match(page,/data-master="rembrandt"/u);
  assert.match(page,/data-owner-visual-lock="yacht-management-owner-selections-v1"/u);
  assert.equal((page.match(/yacht-function-card/gu)||[]).length,4);
  for(const id of ['fleet','crew','captains-logbook','camera-archive'])assert.match(page,new RegExp(`data-open="${id}"`,'u'),id);
  assert.doesNotMatch(page,/READY|ONLINE|operational|Owner Console|Varol Çolak/iu);
  assert.match(app,/parent==='yacht-operations'\?'rembrandt'/u);
  assert.match(css,/\.yacht-atmosphere-panel>img,.yacht-function-card>img\{display:block;width:100%;height:auto\}/u);
  assert.doesNotMatch(css,/yacht-(?:atmosphere-panel|function-card)[^{]*\{[^}]*object-fit\s*:\s*cover/iu);
});

test('locked Yacht Management artifacts are included in the release',()=>{
  assert.match(release,/yacht-management-owner-selections-v1\/OWNER_VISUAL_LOCK\.json/u);
  assert.equal((release.match(/yacht-management-owner-selections-v1\/selected\//gu)||[]).length,5);
  for(const required of [canonicalLockPath,canonicalAssetPath,'config/ui-design-contract.json'])assert.match(release,new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&'),'u'),required);
});

test('approved Yacht Management canonical render and desktop golden remain exact',()=>{
  assert.equal(sha256(canonicalLockBytes),'cb5a291a44a07a9eafc9a90918bca6eec473dc41a79f4d1730338b72f1ce7909');
  assert.equal(canonicalLock.status,'OWNER_APPROVED_LOCKED');
  assert.equal(canonicalLock.route,'/index.html?workspace=yacht-operations');
  assert.equal(canonicalLock.immutable,true);
  assert.equal(canonicalLock.canonicalAsset.width,1280);
  assert.equal(canonicalLock.canonicalAsset.height,720);
  assert.equal(canonicalAssetBytes.readUInt32BE(16),1280);
  assert.equal(canonicalAssetBytes.readUInt32BE(20),720);
  assert.equal(canonicalAssetBytes.length,627565);
  assert.equal(sha256(canonicalAssetBytes),'8ce10be34c72eb541a6312f2cc63dba468cf38c54aad87699ebf0ccd31401d6c');
  assert.equal(sha256(fs.readFileSync(goldenPath)),canonicalLock.desktopGolden.sha256);
  assert.deepEqual(canonicalLock.layoutAssertions.functionCards,{count:4,top:238,bottom:598,width:169,height:360,imageHeight:240,titleTop:451});
  assert.deepEqual(contract.approvedVisualBaselines.yachtManagement,{
    status:'OWNER_APPROVED_LOCKED',approvedAt:'2026-09-18',route:'/index.html?workspace=yacht-operations',asset:canonicalAssetPath,
    sha256:canonicalLock.canonicalAsset.sha256,width:1280,height:720,artDirection:'rembrandt',layoutPolicy:'OWNER_CANONICAL_PIXEL_COMPOSITION',
    canonicalManifest:canonicalLockPath,canonicalManifestSha256:sha256(canonicalLockBytes),immutable:true
  });
});
