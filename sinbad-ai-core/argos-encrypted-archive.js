'use strict';

const crypto=require('node:crypto');

const VERSION='sinbad-argos-encrypted-archive/1-v1';
const PAYLOAD_VERSION='sinbad-argos-archive-payload/1-v1';
const ALGORITHM='AES-256-GCM+HKDF-SHA256';
const HASH=/^[a-f0-9]{64}$/u;
const ID=/^[A-Za-z0-9._-]{1,120}$/u;
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const B64_32=/^[A-Za-z0-9+/]{43}=$/u;

function canonical(value){
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function sha(value){return crypto.createHash('sha256').update(Buffer.from(String(value),'utf8')).digest('hex');}
function exact(value,names){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||Object.getOwnPropertySymbols(value).length)return null;
  const keys=Object.getOwnPropertyNames(value);
  if(keys.length!==names.length||names.some(name=>!keys.includes(name)))return null;
  const copy={};
  for(const name of names){const descriptor=Object.getOwnPropertyDescriptor(value,name);if(!descriptor||!Object.hasOwn(descriptor,'value'))return null;copy[name]=descriptor.value;}
  return copy;
}
function parseMasterKey(value){
  if(typeof value!=='string'||!B64_32.test(value))throw new TypeError('ARGOS_ARCHIVE_KEY_INVALID');
  const key=Buffer.from(value,'base64');
  if(key.length!==32||key.toString('base64')!==value)throw new TypeError('ARGOS_ARCHIVE_KEY_INVALID');
  return key;
}
function validateEntries(entries,expectedCount,expectedHead){
  if(!Array.isArray(entries)||entries.length!==expectedCount)throw new TypeError('ARGOS_ARCHIVE_SHELF_INVALID');
  let previousHash='0'.repeat(64);
  const copied=[];
  for(let index=0;index<entries.length;index++){
    const record=exact(entries[index],['version','eventId','observedAt','actorId','kind','targetRef','outcome','evidenceHash','sequence','previousHash','eventHash']);
    if(!record||record.version!=='sinbad-argos-event-shelf/1-v1'||!ID.test(record.eventId)||!ISO.test(record.observedAt)||!ID.test(record.actorId)||!ID.test(record.kind)||typeof record.targetRef!=='string'||record.targetRef.length<1||record.targetRef.length>500||!ID.test(record.outcome)||!HASH.test(record.evidenceHash)||record.sequence!==index+1||record.previousHash!==previousHash||!HASH.test(record.eventHash))throw new TypeError('ARGOS_ARCHIVE_SHELF_INVALID');
    const core={...record};delete core.eventHash;
    if(record.eventHash!==sha(canonical(core)))throw new TypeError('ARGOS_ARCHIVE_SHELF_INVALID');
    previousHash=record.eventHash;copied.push(record);
  }
  if(previousHash!==expectedHead)throw new TypeError('ARGOS_ARCHIVE_SHELF_INVALID');
  return copied;
}
function normalizePayload(input){
  const root=exact(input,['archiveId','createdAt','sourceInventoryHash','shelves']);
  if(!root||!ID.test(root.archiveId)||!ISO.test(root.createdAt)||!HASH.test(root.sourceInventoryHash)||!Array.isArray(root.shelves)||root.shelves.length<1||root.shelves.length>100)throw new TypeError('ARGOS_ARCHIVE_INPUT_INVALID');
  const seen=new Set(),shelves=[];
  for(const candidate of root.shelves){
    const shelf=exact(candidate,['version','shelfId','eventCount','headHash','entries']);
    if(!shelf||shelf.version!=='sinbad-argos-event-shelf/1-v1'||!ID.test(shelf.shelfId)||seen.has(shelf.shelfId)||!Number.isSafeInteger(shelf.eventCount)||shelf.eventCount<0||shelf.eventCount>100000||!HASH.test(shelf.headHash))throw new TypeError('ARGOS_ARCHIVE_SHELF_INVALID');
    seen.add(shelf.shelfId);shelves.push({version:shelf.version,shelfId:shelf.shelfId,eventCount:shelf.eventCount,headHash:shelf.headHash,entries:validateEntries(shelf.entries,shelf.eventCount,shelf.headHash)});
  }
  shelves.sort((a,b)=>a.shelfId<b.shelfId?-1:a.shelfId>b.shelfId?1:0);
  return {version:PAYLOAD_VERSION,archiveId:root.archiveId,createdAt:root.createdAt,sourceInventoryHash:root.sourceInventoryHash,shelves};
}
function derive(master,salt,archiveId){return Buffer.from(crypto.hkdfSync('sha256',master,salt,Buffer.from(`sinbad-argos-archive:${archiveId}`,'utf8'),32));}
function archiveAad(container){return canonical({version:container.version,archiveId:container.archiveId,createdAt:container.createdAt,algorithm:container.algorithm,salt:container.salt,nonce:container.nonce,plaintextHash:container.plaintextHash});}

function createArchive(input,masterKey){
  const payload=normalizePayload(input),plaintext=Buffer.from(canonical(payload),'utf8'),salt=crypto.randomBytes(32),nonce=crypto.randomBytes(12),key=derive(parseMasterKey(masterKey),salt,payload.archiveId);
  const container={version:VERSION,archiveId:payload.archiveId,createdAt:payload.createdAt,algorithm:ALGORITHM,salt:salt.toString('base64'),nonce:nonce.toString('base64'),plaintextHash:sha(plaintext)};
  const cipher=crypto.createCipheriv('aes-256-gcm',key,nonce,{authTagLength:16});cipher.setAAD(Buffer.from(archiveAad(container),'utf8'));
  const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]),tag=cipher.getAuthTag();
  return Object.freeze({...container,tag:tag.toString('base64'),ciphertext:ciphertext.toString('base64')});
}
function openArchive(value,masterKey){
  const container=exact(value,['version','archiveId','createdAt','algorithm','salt','nonce','plaintextHash','tag','ciphertext']);
  if(!container||container.version!==VERSION||!ID.test(container.archiveId)||!ISO.test(container.createdAt)||container.algorithm!==ALGORITHM||!HASH.test(container.plaintextHash)||typeof container.salt!=='string'||typeof container.nonce!=='string'||typeof container.tag!=='string'||typeof container.ciphertext!=='string')throw new TypeError('ARGOS_ARCHIVE_CONTAINER_INVALID');
  let salt,nonce,tag,ciphertext;
  try{salt=Buffer.from(container.salt,'base64');nonce=Buffer.from(container.nonce,'base64');tag=Buffer.from(container.tag,'base64');ciphertext=Buffer.from(container.ciphertext,'base64');}catch{throw new TypeError('ARGOS_ARCHIVE_CONTAINER_INVALID');}
  if(salt.length!==32||nonce.length!==12||tag.length!==16||ciphertext.length<1||salt.toString('base64')!==container.salt||nonce.toString('base64')!==container.nonce||tag.toString('base64')!==container.tag||ciphertext.toString('base64')!==container.ciphertext)throw new TypeError('ARGOS_ARCHIVE_CONTAINER_INVALID');
  try{
    const key=derive(parseMasterKey(masterKey),salt,container.archiveId),decipher=crypto.createDecipheriv('aes-256-gcm',key,nonce,{authTagLength:16});decipher.setAAD(Buffer.from(archiveAad(container),'utf8'));decipher.setAuthTag(tag);
    const plaintext=Buffer.concat([decipher.update(ciphertext),decipher.final()]);
    if(sha(plaintext)!==container.plaintextHash)throw new Error('hash');
    const parsed=JSON.parse(plaintext.toString('utf8'));
    const payload=normalizePayload({archiveId:parsed.archiveId,createdAt:parsed.createdAt,sourceInventoryHash:parsed.sourceInventoryHash,shelves:parsed.shelves});
    if(parsed.version!==PAYLOAD_VERSION||canonical(parsed)!==canonical(payload)||payload.archiveId!==container.archiveId||payload.createdAt!==container.createdAt)throw new Error('payload');
    return payload;
  }catch(error){if(error instanceof TypeError&&error.message==='ARGOS_ARCHIVE_KEY_INVALID')throw error;throw new Error('ARGOS_ARCHIVE_AUTHENTICATION_FAILED');}
}

function verifyArchive(value,masterKey){
  const payload=openArchive(value,masterKey);
  return Object.freeze({version:VERSION,status:'ARGOS_ARCHIVE_VERIFIED',archiveId:payload.archiveId,createdAt:payload.createdAt,sourceInventoryHash:payload.sourceInventoryHash,plaintextHash:value.plaintextHash,shelves:Object.freeze(payload.shelves.map(shelf=>Object.freeze({shelfId:shelf.shelfId,eventCount:shelf.eventCount,headHash:shelf.headHash})))});
}
module.exports=Object.freeze({VERSION,ALGORITHM,createArchive,verifyArchive,openArchive});
