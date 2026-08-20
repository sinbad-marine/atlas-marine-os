const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const fsp=fs.promises;
const os=require('node:os');
const path=require('node:path');
const compiler=require('../engines/studio/virtual-artifact-compiler.js');
const writerModule=require('../engines/studio/sandbox-writer.js');

const request={instruction:'Responsive web sayfası ve Node programı hazırla',projectName:'Safe Demo',audience:'owner',acceptanceCriteria:'tests'};
async function fixture(){const base=await fsp.mkdtemp(path.join(os.tmpdir(),'sinbad-studio-'));return {base,writer:writerModule.create({approvedBase:base,clock:()=>1000})};}
async function cleanup(base){await fsp.rm(base,{recursive:true,force:true});}

test('writes an authentic bundle once under the exact studio workspace',async()=>{
  const f=await fixture();try{
    const bundle=compiler.compile(request),authorization=f.writer.authorize(bundle,{approvedBy:'owner-1',purpose:'preview-1',nonce:'nonce-1',expiresAt:2000});
    const result=await f.writer.persist(bundle,authorization);
    assert.equal(result.status,'SANDBOX_PROJECT_CREATED');
    assert.equal(result.workspace,'studio-workspaces/safe-demo');
    assert.equal(result.executionPerformed,false);assert.equal(result.networkPerformed,false);assert.equal(result.publishPerformed,false);assert.equal(result.overwritePerformed,false);
    for(const file of result.files)assert.equal(fs.existsSync(path.join(f.base,'studio-workspaces','safe-demo',...file.split('/'))),true,file);
    await assert.rejects(f.writer.persist(bundle,authorization),/SANDBOX_WRITE_NOT_AUTHORIZED/);
  }finally{await cleanup(f.base);}
});

test('rejects copied bundles forged grants expired grants and cross-bundle replay',async()=>{
  const f=await fixture();try{
    const first=compiler.compile(request),second=compiler.compile({...request,projectName:'Other Demo'});
    assert.throws(()=>f.writer.authorize({...first},{approvedBy:'owner-1',purpose:'preview-1',nonce:'nonce-1',expiresAt:2000}),/authentic/);
    const auth=f.writer.authorize(first,{approvedBy:'owner-1',purpose:'preview-1',nonce:'nonce-1',expiresAt:2000});
    await assert.rejects(f.writer.persist(second,auth),/SANDBOX_WRITE_NOT_AUTHORIZED/);
    await assert.rejects(f.writer.persist(first,{...auth}),/SANDBOX_WRITE_NOT_AUTHORIZED/);
    let now=3000;
    const expiredWriter=writerModule.create({approvedBase:path.join(f.base,'late'),clock:()=>now}),expired=expiredWriter.authorize(first,{approvedBy:'owner-1',purpose:'preview-1',nonce:'nonce-2',expiresAt:3500});
    now=3500;
    await assert.rejects(expiredWriter.persist(first,expired),/SANDBOX_WRITE_AUTHORIZATION_EXPIRED/);
  }finally{await cleanup(f.base);}
});

test('refuses overwrite and leaves the first project unchanged',async()=>{
  const f=await fixture();try{
    const first=compiler.compile(request),auth1=f.writer.authorize(first,{approvedBy:'owner-1',purpose:'preview-1',nonce:'nonce-1',expiresAt:2000});
    await f.writer.persist(first,auth1);
    const marker=path.join(f.base,'studio-workspaces','safe-demo','web','index.html'),before=await fsp.readFile(marker,'utf8');
    const second=compiler.compile(request),auth2=f.writer.authorize(second,{approvedBy:'owner-1',purpose:'preview-2',nonce:'nonce-2',expiresAt:2000});
    await assert.rejects(f.writer.persist(second,auth2),/PROJECT_ALREADY_EXISTS/);
    assert.equal(await fsp.readFile(marker,'utf8'),before);
  }finally{await cleanup(f.base);}
});

test('concurrent creation permits exactly one atomic winner',async()=>{
  const f=await fixture();try{
    const first=compiler.compile(request),second=compiler.compile(request);
    const auth1=f.writer.authorize(first,{approvedBy:'owner-1',purpose:'preview-1',nonce:'nonce-1',expiresAt:2000});
    const auth2=f.writer.authorize(second,{approvedBy:'owner-1',purpose:'preview-2',nonce:'nonce-2',expiresAt:2000});
    const results=await Promise.allSettled([f.writer.persist(first,auth1),f.writer.persist(second,auth2)]);
    assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(results.filter(x=>x.status==='rejected').length,1);
    assert.equal(fs.existsSync(path.join(f.base,'studio-workspaces','safe-demo','web','index.html')),true);
  }finally{await cleanup(f.base);}
});

test('rejects a redirected studio workspace root',async t=>{
  const f=await fixture(),outside=await fsp.mkdtemp(path.join(os.tmpdir(),'sinbad-studio-outside-'));
  try{
    const root=path.join(f.base,'studio-workspaces');
    try{await fsp.symlink(outside,root,'junction');}catch(error){if(['EPERM','EACCES','UNKNOWN'].includes(error.code)){t.skip(`link creation unavailable: ${error.code}`);return;}throw error;}
    const bundle=compiler.compile(request),authorization=f.writer.authorize(bundle,{approvedBy:'owner-1',purpose:'preview-1',nonce:'nonce-1',expiresAt:2000});
    await assert.rejects(f.writer.persist(bundle,authorization),/WORKSPACE_ROOT_INVALID/);
  }finally{await cleanup(f.base);await cleanup(outside);}
});

test('requires bounded approval fields and expiry',async()=>{
  const f=await fixture();try{
    const bundle=compiler.compile(request);
    assert.throws(()=>f.writer.authorize(bundle,{approvedBy:'',purpose:'preview-1',nonce:'nonce-1',expiresAt:2000}),/bounded approval/);
    assert.throws(()=>f.writer.authorize(bundle,{approvedBy:'owner-1',purpose:'preview-1',nonce:'nonce-1',expiresAt:1000}),/expiry/);
    assert.throws(()=>f.writer.authorize(bundle,{approvedBy:'owner-1',purpose:'preview-1',nonce:'nonce-1',expiresAt:1000+writerModule.MAX_TTL_MS+1}),/expiry/);
  }finally{await cleanup(f.base);}
});

test('writer exposes no command network deployment or overwrite capability',()=>{
  const writer=writerModule.create({approvedBase:process.cwd()});
  assert.equal(path.basename(writer.workspaceRoot),'studio-workspaces');
  for(const field of ['run','execute','fetch','publish','deploy','overwrite','remove'])assert.equal(field in writer,false);
});
