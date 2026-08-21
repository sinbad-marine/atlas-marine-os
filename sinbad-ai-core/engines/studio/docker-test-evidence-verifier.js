'use strict';
const crypto=require('node:crypto');
const fsp=require('node:fs').promises;
const path=require('node:path');
const writer=require('./docker-test-evidence-writer.js');
const VERSION='0.4.3',MODE='DOCKER_TEST_EVIDENCE_VERIFY_ONLY';
const KEYS=['version','status','projectSlug','manifestHash','image','tests','exitCode','timedOut','output','outputSha256','policy','writes','publishPerformed','approvedBy','purpose','receiptHash'];
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
function create(options={}){
  const approvedBase=path.resolve(String(options.approvedBase||process.cwd())),evidenceRoot=path.join(approvedBase,'studio-test-evidence');
  const blocked=(reason,detail='')=>freeze({version:VERSION,mode:MODE,status:'DOCKER_TEST_EVIDENCE_BLOCKED',reason,detail:String(detail),filesystemRead:true,filesystemWrite:false,execution:false,network:false,publish:false});
  async function verify(receipt){
    const target=path.join(evidenceRoot,String(receipt&&receipt.evidenceId||''));
    if(!writer.isReceiptFor(receipt,target))return blocked('AUTHENTIC_EVIDENCE_RECEIPT_REQUIRED');
    try{const rootStat=await fsp.lstat(evidenceRoot),targetStat=await fsp.lstat(target);if(rootStat.isSymbolicLink()||!rootStat.isDirectory()||path.resolve(await fsp.realpath(evidenceRoot))!==path.resolve(evidenceRoot))return blocked('EVIDENCE_ROOT_INVALID');if(targetStat.isSymbolicLink()||!targetStat.isDirectory()||path.resolve(await fsp.realpath(target))!==path.resolve(target))return blocked('EVIDENCE_TARGET_INVALID');const entries=await fsp.readdir(target,{withFileTypes:true});if(entries.length!==1||entries[0].name!=='TEST_RESULT.json'||!entries[0].isFile()||entries[0].isSymbolicLink())return blocked('EVIDENCE_FILESET_INVALID');const raw=await fsp.readFile(path.join(target,'TEST_RESULT.json'),'utf8');if(Buffer.byteLength(raw,'utf8')>262144)return blocked('EVIDENCE_FILE_TOO_LARGE');let parsed;try{parsed=JSON.parse(raw);}catch(_){return blocked('EVIDENCE_JSON_INVALID');}if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||JSON.stringify(Object.keys(parsed))!==JSON.stringify(KEYS))return blocked('EVIDENCE_SCHEMA_INVALID');if(parsed.receiptHash!==receipt.receiptHash||parsed.status!==receipt.testStatus)return blocked('EVIDENCE_RECEIPT_BINDING_MISMATCH');if(sha256(Buffer.from(String(parsed.output),'utf8'))!==parsed.outputSha256)return blocked('EVIDENCE_OUTPUT_HASH_MISMATCH');const {receiptHash,...payload}=parsed;if(sha256(Buffer.from(JSON.stringify(payload),'utf8'))!==receiptHash)return blocked('EVIDENCE_RECEIPT_HASH_MISMATCH');return freeze({version:VERSION,mode:MODE,status:'DOCKER_TEST_EVIDENCE_VERIFIED',evidence:receipt.evidence,evidenceId:receipt.evidenceId,receiptHash,testStatus:parsed.status,projectSlug:parsed.projectSlug,manifestHash:parsed.manifestHash,image:parsed.image,tests:parsed.tests,exitCode:parsed.exitCode,timedOut:parsed.timedOut,filesystemRead:true,filesystemWrite:false,execution:false,network:false,publish:false});}catch(error){return blocked(error&&error.code==='ENOENT'?'EVIDENCE_MISSING':'EVIDENCE_READ_FAILED',error&&error.code||'UNKNOWN');}
  }
  return freeze({VERSION,MODE,evidenceRoot,verify});
}
module.exports=freeze({VERSION,MODE,create});
