const test=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs').promises;
const os=require('node:os');
const path=require('node:path');
const compiler=require('../engines/studio/virtual-artifact-compiler.js');
const staticVerifier=require('../engines/studio/static-artifact-verifier.js');
const sandboxWriter=require('../engines/studio/sandbox-writer.js');
const persistedVerifier=require('../engines/studio/persisted-workspace-verifier.js');
const previewPackager=require('../engines/studio/scriptless-preview-packager.js');
const previewWriter=require('../engines/studio/scriptless-preview-writer.js');

const request={instruction:'Web sayfası, yazılım ve SVG animasyon hazırla',projectName:'Written Preview',audience:'owner',acceptanceCriteria:'local scriptless preview'};
async function fixture(t){
  const base=await fsp.mkdtemp(path.join(os.tmpdir(),'sinbad-preview-write-'));t.after(()=>fsp.rm(base,{recursive:true,force:true}));
  const bundle=compiler.compile(request),staticReport=staticVerifier.verify(bundle),writer=sandboxWriter.create({approvedBase:base,clock:()=>1000});
  await writer.persist(bundle,writer.authorize(bundle,{approvedBy:'owner-001',purpose:'source-001',nonce:'source-001',expiresAt:2000}));
  const persisted=await persistedVerifier.create({approvedBase:base}).verify(staticReport);
  const previewPackage=await previewPackager.create({approvedBase:base}).packagePreview(persisted);
  return {base,previewPackage};
}

test('atomically creates one separate scriptless preview without opening it',async t=>{
  const {base,previewPackage}=await fixture(t),writer=previewWriter.create({approvedBase:base,clock:()=>1000});
  const auth=writer.authorize(previewPackage,{approvedBy:'owner-001',purpose:'local-preview-001',nonce:'preview-001',expiresAt:2000});
  const result=await writer.persist(previewPackage,auth);
  assert.equal(result.status,'SCRIPTLESS_PREVIEW_CREATED');assert.equal(result.preview,'studio-previews/written-preview');
  assert.equal(result.files.some(file=>file.endsWith('.js')),false);
  assert.deepEqual({opened:result.opened,executed:result.executed,networkUsed:result.networkUsed,published:result.published,overwritten:result.overwritten},{opened:false,executed:false,networkUsed:false,published:false,overwritten:false});
  await assert.rejects(writer.persist(previewPackage,auth),/PREVIEW_WRITE_NOT_AUTHORIZED/);
});

test('rejects copied packages expired grants and cross-package replay',async t=>{
  const {base,previewPackage}=await fixture(t),writer=previewWriter.create({approvedBase:base,clock:()=>1000});
  assert.throws(()=>writer.authorize({...previewPackage},{approvedBy:'owner-001',purpose:'local-preview-001',nonce:'preview-001',expiresAt:2000}),/authentic/);
  const auth=writer.authorize(previewPackage,{approvedBy:'owner-001',purpose:'local-preview-001',nonce:'preview-001',expiresAt:2000});
  await assert.rejects(writer.persist({...previewPackage},auth),/PREVIEW_WRITE_NOT_AUTHORIZED/);
  let now=1000;const late=previewWriter.create({approvedBase:path.join(base,'late'),clock:()=>now});
  const expired=late.authorize(previewPackage,{approvedBy:'owner-001',purpose:'local-preview-002',nonce:'preview-002',expiresAt:1500});now=1500;
  await assert.rejects(late.persist(previewPackage,expired),/PREVIEW_WRITE_AUTHORIZATION_EXPIRED/);
});

test('refuses overwrite and concurrent creation has exactly one winner',async t=>{
  const {base,previewPackage}=await fixture(t),first=previewWriter.create({approvedBase:base,clock:()=>1000}),second=previewWriter.create({approvedBase:base,clock:()=>1000});
  const a=first.authorize(previewPackage,{approvedBy:'owner-001',purpose:'local-preview-001',nonce:'preview-001',expiresAt:2000});
  const b=second.authorize(previewPackage,{approvedBy:'owner-001',purpose:'local-preview-002',nonce:'preview-002',expiresAt:2000});
  const results=await Promise.allSettled([first.persist(previewPackage,a),second.persist(previewPackage,b)]);
  assert.equal(results.filter(item=>item.status==='fulfilled').length,1);assert.equal(results.filter(item=>item.status==='rejected').length,1);
  const html=await fsp.readFile(path.join(base,'studio-previews','written-preview','web','index.html'),'utf8');assert.doesNotMatch(html,/<script\b/iu);
});

test('rejects redirected preview root and exposes no opener runner or publisher',async t=>{
  const {base,previewPackage}=await fixture(t),outside=await fsp.mkdtemp(path.join(os.tmpdir(),'sinbad-preview-outside-'));t.after(()=>fsp.rm(outside,{recursive:true,force:true}));
  const writer=previewWriter.create({approvedBase:base,clock:()=>1000}),root=path.join(base,'studio-previews');
  try{await fsp.symlink(outside,root,process.platform==='win32'?'junction':'dir');}catch(error){if(['EPERM','EACCES','UNKNOWN'].includes(error.code))return t.skip('symlink creation is not permitted');throw error;}
  const auth=writer.authorize(previewPackage,{approvedBy:'owner-001',purpose:'local-preview-001',nonce:'preview-001',expiresAt:2000});
  await assert.rejects(writer.persist(previewPackage,auth),/PREVIEW_ROOT_INVALID/);
  for(const field of ['open','run','execute','fetch','render','publish','deploy','overwrite'])assert.equal(field in writer,false);
});
