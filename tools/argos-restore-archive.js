'use strict';
const fs=require('node:fs'),path=require('node:path');
const {openArchive}=require('../sinbad-ai-core/argos-encrypted-archive');
const {assertUnlinked,loadArchiveShelves}=require('./argos-load-archive-shelves');
function restoreArchive(container,key,destination){
 const payload=openArchive(container,key),root=path.resolve(destination),names=new Set();
 // Validate before creating any output. Reject Windows aliases and case collisions too.
 for(const shelf of payload.shelves){
  const name=shelf.shelfId;
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(name)||name.endsWith('.')||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)||names.has(name.toLowerCase())||!shelf.eventCount)throw Error('ARCHIVE_RESTORE_SHELF_PATH_INVALID');
  names.add(name.toLowerCase());
 }
 assertUnlinked(root);fs.mkdirSync(root,{recursive:false,mode:0o700});
 for(const shelf of payload.shelves){
  const directory=path.join(root,shelf.shelfId);fs.mkdirSync(directory,{mode:0o700});
  for(const entry of shelf.entries){const target=path.join(directory,`${String(entry.sequence).padStart(8,'0')}-${entry.eventId}.json`);const fd=fs.openSync(target,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(entry)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
 }
 const restored=loadArchiveShelves(root),summary=shelves=>shelves.map(({shelfId,eventCount,headHash})=>({shelfId,eventCount,headHash})).sort((a,b)=>a.shelfId.localeCompare(b.shelfId,'en'));
 if(JSON.stringify(summary(restored))!==JSON.stringify(summary(payload.shelves)))throw Error('ARCHIVE_RESTORE_VERIFICATION_FAILED');
 // Re-authenticate reconstructed event contents, not only counts and recorded heads.
 const {createArchive,verifyArchive}=require('../sinbad-ai-core/argos-encrypted-archive');
 verifyArchive(createArchive({archiveId:payload.archiveId,createdAt:payload.createdAt,sourceInventoryHash:payload.sourceInventoryHash,shelves:restored},key),key);
 return {status:'ARGOS_ARCHIVE_RESTORED',archiveId:payload.archiveId,destination:root,shelves:summary(restored),scope:'Isolated event journals; no live database import or key migration'};
}
module.exports={restoreArchive};
