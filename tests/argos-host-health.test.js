'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {verifyNativeIdentity}=require('../tools/run-argos-host-health');
test('native host identity must match the independently selected exact package inventory',()=>{
 const files=Array.from({length:9},(_,i)=>({path:'fixture-'+i,sha256:String(i).repeat(64)}));
 const packageId=crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex');
 const identity={status:'ARGOS_HOST_IDENTITY_VERIFIED',packageId,processId:123,files};
 assert.equal(verifyNativeIdentity(identity,packageId),identity);
 assert.throws(()=>verifyNativeIdentity(identity,'f'.repeat(64)),/INVALID/);
 assert.throws(()=>verifyNativeIdentity({...identity,files:files.map((x,i)=>i===0?{...x,sha256:'e'.repeat(64)}:x)},packageId),/MISMATCH/);
 assert.throws(()=>verifyNativeIdentity({...identity,files:files.slice(1)},packageId),/INVALID/);
});
