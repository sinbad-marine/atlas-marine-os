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

test('Pages release contains every live character runtime and referenced animation frame',()=>{
  const required=[
    'sinbad-character-engine.js','sinbad-character-rig.js','sinbad-viseme-planner.js','sinbad-performance-director.js',
    'captain-sinbad-idle-blink-v1.png','captain-sinbad-speaking-mbp-v1.png','captain-sinbad-speaking-o-v1.png',
    'captain-sinbad-laughing-v1.png','captain-sinbad-walk-a-v1.png','captain-sinbad-walk-b-v1.png',
    'captain-sinbad-writing-contact-v1.png','captain-sinbad-writing-lift-v1.png',
    'captain-sinbad-rig-head-v1.png','captain-sinbad-rig-torso-v1.png',
    'captain-sinbad-rig-left-arm-v1.png','captain-sinbad-rig-right-arm-v1.png',
    'captain-sinbad-rig-face-blink-v1.png','captain-sinbad-rig-face-closed-v1.png','captain-sinbad-rig-face-open-v1.png',
    'captain-sinbad-rig-face-wide-v1.png','captain-sinbad-rig-face-round-v1.png',
    'captain-sinbad-rig-expression-concerned-v1.png','captain-sinbad-rig-expression-delighted-v1.png'
  ];
  for(const name of required)assert.equal(builder.RELEASE_FILES.some(file=>file.endsWith(name)),true,name);
  assert.equal(builder.RELEASE_FILES.some(file=>file.endsWith('captain-sinbad-hero-portrait.png')),false,'unused portrait must not inflate the release');
});

test('Pages release excludes local-only and unreviewed content sources',()=>{
  assert.equal(builder.RELEASE_FILES.includes('store-data.js'),false,'local store data must not enter the public artifact implicitly');
  assert.equal(builder.RELEASE_FILES.some(file=>file.startsWith('assets/gasm-seyir/')),false,'unreviewed training scans must remain outside the public artifact');
});

test('refuses overwrite and targets outside the repository',async t=>{
  const parent=await fsp.mkdtemp(path.join(builder.ROOT,'.release-test-'));
  t.after(()=>fsp.rm(parent,{recursive:true,force:true}));
  const target=path.join(parent,'pages');
  await builder.buildPagesArtifact(target);
  await assert.rejects(builder.buildPagesArtifact(target),/RELEASE_TARGET_ALREADY_EXISTS/u);
  await assert.rejects(builder.buildPagesArtifact(path.join(os.tmpdir(),'sinbad-pages-outside')),/RELEASE_TARGET_OUTSIDE_REPOSITORY/u);
});
