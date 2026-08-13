'use strict';
const {createHash}=require('node:crypto');
const AUDIT_VERSION='sinbad-trusted-rollout-recovery-authorization-audit/3N-v1';
const HASH=/^[a-f0-9]{64}$/u,DECISIONS=new Set(['AUTHORIZED','DENIED']);
const sha256=value=>createHash('sha256').update(value,'utf8').digest('hex');
function create(options={}){
  if(typeof options.append!=='function'||options.durable!==true)throw new TypeError('A trusted durable audit append function is required');
  const append=options.append;
  return Object.freeze({version:AUDIT_VERSION,durable:true,async record(input={}){const actorHash=String(input.actorHash||''),attestationHash=String(input.attestationHash||''),purposeHash=String(input.purposeHash||''),decision=String(input.decision||''),decidedAt=Number(input.decidedAt);if(!HASH.test(actorHash)||!HASH.test(attestationHash)||!HASH.test(purposeHash)||!DECISIONS.has(decision)||!Number.isSafeInteger(decidedAt)||decidedAt<0)return Object.freeze({status:'INVALID',eventHash:null});const eventHash=sha256([AUDIT_VERSION,actorHash,attestationHash,purposeHash,decision,decidedAt].join('\n')),event=Object.freeze({version:AUDIT_VERSION,actorHash,attestationHash,purposeHash,decision,decidedAt,eventHash});try{return Object.freeze({status:await append(event)===true?'RECORDED':'DENIED',eventHash});}catch{return Object.freeze({status:'UNAVAILABLE',eventHash:null});}}});
}
module.exports=Object.freeze({AUDIT_VERSION,create});
