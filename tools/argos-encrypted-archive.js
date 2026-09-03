'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {loadArchiveShelves,inventoryHash,assertUnlinked}=require('./argos-load-archive-shelves');
const archiveApi=require('../sinbad-ai-core/argos-encrypted-archive');

const projectRoot=path.resolve(__dirname,'..');
const runtimeRoot=path.resolve(process.env.ARGOS_LEDGER_ROOT||path.join(projectRoot,'.argos-runtime'));
const archiveRoot=path.resolve(process.env.ARGOS_ARCHIVE_ROOT||path.join(projectRoot,'.argos-archive'));
const command=String(process.argv[2]||'');
function fail(code){process.stderr.write(`${JSON.stringify({version:archiveApi.VERSION,status:'ARGOS_ARCHIVE_BLOCKED',reasonCode:code})}\n`);process.exitCode=1;}
function hash(value){return crypto.createHash('sha256').update(Buffer.from(String(value),'utf8')).digest('hex');}
function inside(root,target){return target.startsWith(`${root}${path.sep}`);}

try{
  const masterKey=process.env.ARGOS_ARCHIVE_KEY;if(!masterKey)throw new Error('ARCHIVE_KEY_REQUIRED');
  if(command==='create'){
    const shelves=loadArchiveShelves(runtimeRoot),createdAt=new Date().toISOString(),archiveId=`archive-${createdAt.replace(/[-:.]/gu,'')}-${crypto.randomBytes(6).toString('hex')}`,sourceInventoryHash=inventoryHash(shelves);
    const container=archiveApi.createArchive({archiveId,createdAt,sourceInventoryHash,shelves},masterKey);
    if(inventoryHash(loadArchiveShelves(runtimeRoot))!==sourceInventoryHash)throw new Error('ARGOS_ARCHIVE_SOURCE_CHANGED');
    assertUnlinked(archiveRoot);fs.mkdirSync(archiveRoot,{recursive:true});const stat=fs.lstatSync(archiveRoot);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('ARCHIVE_ROOT_INVALID');
    const destination=path.join(archiveRoot,`${archiveId}.json`);if(!inside(archiveRoot,destination))throw new Error('ARCHIVE_PATH_INVALID');
    const descriptor=fs.openSync(destination,'wx',0o600);try{fs.writeFileSync(descriptor,`${JSON.stringify(container)}\n`,'utf8');fs.fsyncSync(descriptor);}finally{fs.closeSync(descriptor);}
    const written=fs.readFileSync(destination,'utf8');const summary=archiveApi.verifyArchive(JSON.parse(written),masterKey);process.stdout.write(`${JSON.stringify({...summary,archiveSha256:hash(written),file:path.relative(projectRoot,destination).replaceAll('\\','/')})}\n`);
  }else if(command==='verify'||command==='restore'){
    const requested=String(process.argv[3]||'');if(!requested)throw new Error('ARCHIVE_FILE_REQUIRED');const target=path.resolve(projectRoot,requested);if(!inside(archiveRoot,target))throw new Error('ARCHIVE_PATH_INVALID');const stat=fs.lstatSync(target);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('ARCHIVE_FILE_INVALID');
    assertUnlinked(target);if(stat.size>100663296)throw new Error('ARCHIVE_SIZE_LIMIT');const container=JSON.parse(fs.readFileSync(target,'utf8'));if(command==='restore'){const destination=String(process.argv[4]||'');if(!destination)throw new Error('RESTORE_DESTINATION_REQUIRED');process.stdout.write(`${JSON.stringify(require('./argos-restore-archive').restoreArchive(container,masterKey,destination))}\n`);}else process.stdout.write(`${JSON.stringify(archiveApi.verifyArchive(container,masterKey))}\n`);
  }else throw new Error('COMMAND_INVALID');
}catch(error){fail(error instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:'ARGOS_ARCHIVE_IO_FAILED');}
