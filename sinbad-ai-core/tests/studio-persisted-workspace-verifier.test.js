const test=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs').promises;
const os=require('node:os');
const path=require('node:path');
const compiler=require('../engines/studio/virtual-artifact-compiler.js');
const staticVerifier=require('../engines/studio/static-artifact-verifier.js');
const writerModule=require('../engines/studio/sandbox-writer.js');
const persistedVerifier=require('../engines/studio/persisted-workspace-verifier.js');

const request={instruction:'Web sayfası, Node programı ve SVG animasyon hazırla',projectName:'Persisted Demo',audience:'owner',acceptanceCriteria:'integrity verified'};

async function fixture(t){
  const base=await fsp.mkdtemp(path.join(os.tmpdir(),'sinbad-studio-persisted-'));
  t.after(()=>fsp.rm(base,{recursive:true,force:true}));
  const bundle=compiler.compile(request),report=staticVerifier.verify(bundle);
  const writer=writerModule.create({approvedBase:base,clock:()=>1000});
  const authorization=writer.authorize(bundle,{approvedBy:'owner-001',purpose:'preview-001',nonce:'nonce-001',expiresAt:2000});
  await writer.persist(bundle,authorization);
  return {base,bundle,report,project:path.join(base,'studio-workspaces',report.projectSlug)};
}

test('verifies an exact persisted project without execution or writes',async t=>{
  const {base,report}=await fixture(t),verifier=persistedVerifier.create({approvedBase:base});
  const first=await verifier.verify(report),second=await verifier.verify(report);
  assert.deepEqual(first,second);
  assert.equal(first.status,'PERSISTED_WORKSPACE_VERIFIED');
  assert.equal(first.manifestHash,report.manifestHash);
  assert.deepEqual(first.io,{filesystemRead:true,filesystemWrite:false,network:false,commands:false,render:false});
  assert.equal(persistedVerifier.isAuthenticReport(first),true);
  assert.equal(persistedVerifier.isAuthenticReport({...first}),false);
});

test('blocks changed missing and extra files',async t=>{
  for(const kind of ['changed','missing','extra']){
    const {base,report,project}=await fixture(t),target=path.join(project,...report.manifest[0].path.split('/'));
    if(kind==='changed')await fsp.writeFile(target,'tampered');
    if(kind==='missing')await fsp.rm(target);
    if(kind==='extra')await fsp.writeFile(path.join(project,'extra.txt'),'extra');
    const result=await persistedVerifier.create({approvedBase:base}).verify(report);
    assert.equal(result.status,'PERSISTED_WORKSPACE_BLOCKED');
    assert.equal(result.reason,kind==='changed'?'FILE_SIZE_MISMATCH':kind==='missing'?'EXPECTED_FILE_MISSING':'UNEXPECTED_FILE_PRESENT');
  }
});

test('blocks a symbolic link or junction anywhere inside the project',async t=>{
  const {base,report,project}=await fixture(t),outside=await fsp.mkdtemp(path.join(os.tmpdir(),'sinbad-studio-outside-'));
  t.after(()=>fsp.rm(outside,{recursive:true,force:true}));
  const link=path.join(project,'redirect');
  try{await fsp.symlink(outside,link,process.platform==='win32'?'junction':'dir');}catch(error){if(['EPERM','EACCES','UNKNOWN'].includes(error.code))return t.skip('symlink creation is not permitted');throw error;}
  const result=await persistedVerifier.create({approvedBase:base}).verify(report);
  assert.equal(result.status,'PERSISTED_WORKSPACE_BLOCKED');
  assert.equal(result.reason,'SYMLINK_FORBIDDEN');
});

test('rejects copied reports and missing workspaces fail closed',async()=>{
  const bundle=compiler.compile(request),report=staticVerifier.verify(bundle),base=await fsp.mkdtemp(path.join(os.tmpdir(),'sinbad-studio-empty-'));
  try{
    const verifier=persistedVerifier.create({approvedBase:base});
    assert.equal((await verifier.verify({...report})).reason,'AUTHENTIC_STATIC_REPORT_REQUIRED');
    assert.equal((await verifier.verify(report)).reason,'WORKSPACE_OR_PROJECT_MISSING');
    assert.equal(typeof verifier.execute,'undefined');
    assert.equal(typeof verifier.publish,'undefined');
  }finally{await fsp.rm(base,{recursive:true,force:true});}
});
