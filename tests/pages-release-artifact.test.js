'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const builder=require('../tools/build-pages-artifact.js');

const hash=value=>crypto.createHash('sha256').update(value).digest('hex');

test('builds an allowlisted hash-bound Pages artifact without private surfaces',async t=>{
  const parent=await fsp.mkdtemp(path.join(builder.ROOT,'.release-test-'));
  t.after(()=>fsp.rm(parent,{recursive:true,force:true}));
  const target=path.join(parent,'pages');
  const result=await builder.buildPagesArtifact(target);
  assert.equal(result.schemaVersion,'sinbad-pages-release/v1');
  assert.equal(result.files.length,builder.RELEASE_FILES.length);
  for(const entry of result.files){
    const bytes=await fsp.readFile(path.join(target,...entry.path.split('/')));
    assert.equal(bytes.length,entry.bytes,entry.path);
    assert.equal(hash(bytes),entry.sha256,entry.path);
  }
  for(const forbidden of ['bridge','sinbad-ai-core','tests','.git','.roundtable','supabase/.temp'])assert.equal(fs.existsSync(path.join(target,...forbidden.split('/'))),false,forbidden);
});

test('refuses overwrite and targets outside the repository',async t=>{
  const parent=await fsp.mkdtemp(path.join(builder.ROOT,'.release-test-'));
  t.after(()=>fsp.rm(parent,{recursive:true,force:true}));
  const target=path.join(parent,'pages');
  await builder.buildPagesArtifact(target);
  await assert.rejects(builder.buildPagesArtifact(target),/RELEASE_TARGET_ALREADY_EXISTS/u);
  await assert.rejects(builder.buildPagesArtifact(path.join(os.tmpdir(),'sinbad-pages-outside')),/RELEASE_TARGET_OUTSIDE_REPOSITORY/u);
});
