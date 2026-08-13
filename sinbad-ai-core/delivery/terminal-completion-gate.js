'use strict';
const crypto=require('node:crypto');
const receipts=require('./terminal-delivery-receipt.js');
const receiptVerifier=require('../verification/terminal-delivery-receipt-verifier.js');
const closure=require('./single-use-terminal-closure.js');
const closureVerifier=require('../verification/terminal-closure-verifier.js');
const audit=require('../audit/terminal-delivery-audit-record.js');
const auditVerifier=require('../verification/terminal-delivery-audit-verifier.js');
const COMPLETION_VERSION='sinbad-terminal-completion-gate/2V-v1';
const EXPECTED=Object.freeze({receipt:'sinbad-terminal-delivery-receipt/2P-v1',receiptVerification:'sinbad-terminal-delivery-receipt-verification/2Q-v1',closure:'sinbad-single-use-terminal-closure/2R-v1',closureVerification:'sinbad-terminal-closure-verification/2S-v1',audit:'sinbad-terminal-delivery-audit-record/2T-v1',auditVerification:'sinbad-terminal-delivery-audit-verification/2U-v1'});
if(receipts.RECEIPT_VERSION!==EXPECTED.receipt||receiptVerifier.VERIFICATION_VERSION!==EXPECTED.receiptVerification||closure.CLOSURE_VERSION!==EXPECTED.closure||closureVerifier.VERIFICATION_VERSION!==EXPECTED.closureVerification||audit.RECORD_VERSION!==EXPECTED.audit||auditVerifier.VERIFICATION_VERSION!==EXPECTED.auditVerification)throw new Error('Unsupported terminal completion chain version');
const authenticCompletions=new WeakSet();
const completionManifests=new WeakMap();
function canonical(value){if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;return JSON.stringify(value);}
function sha256(value){return crypto.createHash('sha256').update(Buffer.isBuffer(value)?value:Buffer.from(String(value),'utf8')).digest('hex');}
const clean=receipts.clean;
function blocked(){return Object.freeze({version:COMPLETION_VERSION,status:'TERMINAL_COMPLETION_BLOCKED',reasonCode:'TERMINAL_COMPLETION_DENIED',outcome:null,sourceCount:0,auditHash:null,auditVerificationHash:null,completionHash:null});}
function complete(authorization={},context={}){
  const transactionId=clean(context.transactionId),sessionId=clean(context.sessionId),channelId=clean(context.channelId),attemptId=clean(context.attemptId),closureId=clean(context.closureId),auditId=clean(context.auditId),outcome=String(context.outcome||'');
  if(!transactionId||!sessionId||!channelId||!attemptId||!closureId||!auditId||!['DELIVERED','FAILED'].includes(outcome)||String(authorization.transactionId||'')!==transactionId)return blocked();
  const receipt=receipts.record(authorization,{outcome,sessionId,channelId,attemptId});if(receipt.status!=='DELIVERY_RECEIPT_RECORDED')return blocked();
  const receiptVerification=receiptVerifier.verify(receipt,{transactionId,sessionId,channelId,attemptId,outcome});if(receiptVerification.status!=='DELIVERY_RECEIPT_VERIFIED')return blocked();
  const closed=closure.close(receiptVerification,{transactionId,sessionId,channelId,attemptId,closureId,outcome});if(closed.status!=='TERMINAL_CLOSURE_CONFIRMED')return blocked();
  const closureVerification=closureVerifier.verify(closed,{closureId,outcome});if(closureVerification.status!=='TERMINAL_CLOSURE_VERIFIED')return blocked();
  const record=audit.record(closureVerification,{auditId,closureId,outcome});if(record.status!=='TERMINAL_AUDIT_RECORDED')return blocked();
  const auditVerification=auditVerifier.verify(record,{auditId,closureId,outcome});if(auditVerification.status!=='TERMINAL_AUDIT_VERIFIED')return blocked();
  const manifest=Object.freeze({version:COMPLETION_VERSION,status:'TERMINAL_COMPLETION_CONFIRMED',transactionId,sessionId,channelId,attemptId,closureId,auditId,outcome,sourceCount:auditVerification.sourceCount,auditHash:auditVerification.auditHash,auditVerificationHash:auditVerification.auditVerificationHash});
  const output=Object.freeze({version:COMPLETION_VERSION,status:'TERMINAL_COMPLETION_CONFIRMED',reasonCode:null,outcome,sourceCount:auditVerification.sourceCount,auditHash:auditVerification.auditHash,auditVerificationHash:auditVerification.auditVerificationHash,completionHash:sha256(canonical(manifest))});authenticCompletions.add(output);completionManifests.set(output,manifest);return output;
}
function isAuthenticCompletion(value){return Boolean(value&&typeof value==='object'&&authenticCompletions.has(value));}
function boundSnapshot(value,expected={}){if(!isAuthenticCompletion(value)||value.status!=='TERMINAL_COMPLETION_CONFIRMED'||value.reasonCode!==null)return null;const manifest=completionManifests.get(value),transactionId=clean(expected.transactionId),sessionId=clean(expected.sessionId),channelId=clean(expected.channelId),attemptId=clean(expected.attemptId),closureId=clean(expected.closureId),auditId=clean(expected.auditId),outcome=String(expected.outcome||'');if(!manifest||!transactionId||!sessionId||!channelId||!attemptId||!closureId||!auditId||!['DELIVERED','FAILED'].includes(outcome)||manifest.transactionId!==transactionId||manifest.sessionId!==sessionId||manifest.channelId!==channelId||manifest.attemptId!==attemptId||manifest.closureId!==closureId||manifest.auditId!==auditId||manifest.outcome!==outcome||value.outcome!==manifest.outcome||value.sourceCount!==manifest.sourceCount||value.auditHash!==manifest.auditHash||value.auditVerificationHash!==manifest.auditVerificationHash||value.completionHash!==sha256(canonical(manifest)))return null;return Object.freeze({transactionId,sessionId,channelId,attemptId,closureId,auditId,outcome,sourceCount:manifest.sourceCount,auditHash:manifest.auditHash,auditVerificationHash:manifest.auditVerificationHash,completionHash:value.completionHash});}
function isBound(value,expected={}){return boundSnapshot(value,expected)!==null;}
module.exports=Object.freeze({COMPLETION_VERSION,EXPECTED,canonical,sha256,clean,complete,isAuthenticCompletion,boundSnapshot,isBound});
