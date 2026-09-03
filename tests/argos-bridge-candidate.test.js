'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {FILES,snapshot}=require('../tools/argos-bridge-candidate');
function temporary(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'argos-package-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('review snapshot preserves allowlisted bytes and excludes authority and private assets',t=>{
  const parent=temporary(t),r=snapshot({parent});
  const manifest=JSON.parse(fs.readFileSync(path.join(r.destination,'REVIEW-MANIFEST.json'),'utf8'));
  assert.equal(manifest.status,'SOURCE_SNAPSHOT_NOT_DEPLOYABLE');
  assert.equal(manifest.executionAuthorized,false);assert.equal(manifest.activationAuthorized,false);
  assert.equal(r.fileCount,FILES.length);
  for(const entry of manifest.files){const bytes=fs.readFileSync(path.join(r.destination,entry.path));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256);assert.equal(bytes.length,entry.bytes);}
  assert.equal(fs.existsSync(path.join(r.destination,'.env')),false);
  const second=snapshot({parent});assert.notEqual(second.destination,r.destination);
});
test('missing source input fails before creating a partial candidate',t=>{
  const parent=temporary(t),root=temporary(t);assert.throws(()=>snapshot({parent,root}));assert.deepEqual(fs.readdirSync(parent),[]);
});
