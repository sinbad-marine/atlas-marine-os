const test=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs').promises;
const os=require('node:os');
const path=require('node:path');
const compiler=require('../engines/studio/virtual-artifact-compiler.js');
const staticVerifier=require('../engines/studio/static-artifact-verifier.js');
const writerModule=require('../engines/studio/sandbox-writer.js');
const persistedVerifier=require('../engines/studio/persisted-workspace-verifier.js');
const packagerModule=require('../engines/studio/scriptless-preview-packager.js');

const request={instruction:'Web sayfası, yazılım ve SVG animasyon hazırla',projectName:'Preview Demo',audience:'owner',acceptanceCriteria:'scriptless local preview'};
async function fixture(t){
  const base=await fsp.mkdtemp(path.join(os.tmpdir(),'sinbad-studio-preview-'));t.after(()=>fsp.rm(base,{recursive:true,force:true}));
  const bundle=compiler.compile(request),staticReport=staticVerifier.verify(bundle),writer=writerModule.create({approvedBase:base,clock:()=>1000});
  await writer.persist(bundle,writer.authorize(bundle,{approvedBy:'owner-001',purpose:'preview-001',nonce:'nonce-001',expiresAt:2000}));
  const report=await persistedVerifier.create({approvedBase:base}).verify(staticReport);
  return {base,bundle,report,project:path.join(base,'studio-workspaces',report.projectSlug)};
}

test('creates an immutable deterministic in-memory scriptless package',async t=>{
  const {base,report}=await fixture(t),packager=packagerModule.create({approvedBase:base});
  const first=await packager.packagePreview(report),second=await packager.packagePreview(report);
  assert.deepEqual(first,second);assert.equal(first.status,'SCRIPTLESS_PREVIEW_PACKAGE_READY');
  assert.equal(first.artifacts.some(item=>item.path.endsWith('.js')),false);
  const html=first.artifacts.find(item=>item.path.endsWith('.html')).content;
  assert.doesNotMatch(html,/<script\b/iu);assert.match(html,/Content-Security-Policy/);
  assert.deepEqual(first.io,{filesystemRead:true,filesystemWrite:false,network:false,commands:false,render:false});
  assert.equal(packagerModule.isAuthenticPackage(first),true);assert.equal(packagerModule.isAuthenticPackage({...first}),false);
});

test('rechecks hashes and blocks a post-verification file mutation',async t=>{
  const {base,report,project}=await fixture(t),target=path.join(project,'web','index.html');
  await fsp.appendFile(target,'tamper');
  const result=await packagerModule.create({approvedBase:base}).packagePreview(report);
  assert.equal(result.status,'SCRIPTLESS_PREVIEW_BLOCKED');assert.equal(result.reason,'PERSISTED_FILE_CHANGED');
});

test('rejects copied reports and reports bound to another workspace',async t=>{
  const {base,report}=await fixture(t),other=await fsp.mkdtemp(path.join(os.tmpdir(),'sinbad-studio-other-'));t.after(()=>fsp.rm(other,{recursive:true,force:true}));
  assert.equal((await packagerModule.create({approvedBase:base}).packagePreview({...report})).reason,'AUTHENTIC_BOUND_PERSISTED_REPORT_REQUIRED');
  assert.equal((await packagerModule.create({approvedBase:other}).packagePreview(report)).reason,'AUTHENTIC_BOUND_PERSISTED_REPORT_REQUIRED');
});

test('packager exposes no write execute network render or publish adapter',()=>{
  const packager=packagerModule.create({approvedBase:process.cwd()});
  for(const field of ['write','run','execute','fetch','render','publish','deploy'])assert.equal(field in packager,false);
});
