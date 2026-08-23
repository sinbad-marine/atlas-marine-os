'use strict';

const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const sources=require('./source-catalog.js');

function hashFile(filePath){
  const bytes=fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function verify({sourceId,filePath,verifiedAt=new Date().toISOString()}){
  const source=sources.getSource(sourceId);
  if(!source||!source.artifact)throw new Error('unknown pinned artifact');
  const resolved=path.resolve(filePath);
  const stat=fs.statSync(resolved);
  const actualHash=hashFile(resolved);
  if(stat.size!==source.artifact.bytes)throw new Error('artifact size mismatch');
  if(actualHash!==source.artifact.sha256)throw new Error('artifact hash mismatch');
  return Object.freeze({
    schemaVersion:'sinbad-artifact-verification/1',sourceId:source.id,
    fileName:path.basename(resolved),bytes:stat.size,sha256:actualHash,
    snapshotDate:source.artifact.snapshotDate,license:source.license,
    verifiedAt,status:'VERIFIED',searchProvider:'kiwix-serve'
  });
}

module.exports=Object.freeze({hashFile,verify});
