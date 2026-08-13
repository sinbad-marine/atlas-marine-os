'use strict';
const crypto=require('node:crypto');
const receipts=require('../delivery/terminal-delivery-receipt.js');
const EXPECTED_RECEIPT_VERSION='sinbad-terminal-delivery-receipt/2P-v1';
if(receipts.RECEIPT_VERSION!==EXPECTED_RECEIPT_VERSION)throw new Error(`Unsupported terminal receipt version: ${receipts.RECEIPT_VERSION}`);
const VERIFICATION_VERSION='sinbad-terminal-delivery-receipt-verification/2Q-v1';
const VERIFIER_VERSION='sinbad-independent-terminal-delivery-receipt-verifier/2Q-v1';
const OUTCOMES=new Set(['DELIVERED','FAILED']);
const verifiedReceipts=new WeakSet();
const authenticVerifications=new WeakSet();
const verificationManifests=new WeakMap();
function canonical(value){if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;return JSON.stringify(value);}
function sha256(value){return crypto.createHash('sha256').update(Buffer.isBuffer(value)?value:Buffer.from(String(value),'utf8')).digest('hex');}
const clean=receipts.clean;
function blocked(){return Object.freeze({version:VERIFICATION_VERSION,verifierVersion:VERIFIER_VERSION,status:'DELIVERY_RECEIPT_INVALID',reasonCode:'DELIVERY_RECEIPT_VERIFICATION_DENIED',outcome:null,receiptHash:null,sourceCount:0,verificationHash:null});}
function verify(receipt={},expected={}){
  const transactionId=clean(expected.transactionId),sessionId=clean(expected.sessionId),channelId=clean(expected.channelId),attemptId=clean(expected.attemptId),outcome=String(expected.outcome||'');
  if(!receipts.isAuthenticReceipt(receipt)||verifiedReceipts.has(receipt)||receipt.version!==receipts.RECEIPT_VERSION||receipt.status!=='DELIVERY_RECEIPT_RECORDED'||receipt.reasonCode!==null||!transactionId||!sessionId||!channelId||!attemptId||!OUTCOMES.has(outcome)||receipt.transactionId!==transactionId||receipt.sessionId!==sessionId||receipt.channelId!==channelId||receipt.attemptId!==attemptId||receipt.outcome!==outcome||!Number.isInteger(receipt.sourceCount)||receipt.sourceCount<0||receipt.sourceCount>64||!/^[a-f0-9]{64}$/u.test(String(receipt.authorizationHash||''))||!/^[a-f0-9]{64}$/u.test(String(receipt.deliveryHash||''))||!/^[a-f0-9]{64}$/u.test(String(receipt.receiptHash||'')))return blocked();
  const payload=receipts.receiptPayload(receipt);
  if(receipt.receiptHash!==sha256(canonical(payload)))return blocked();
  const manifest=Object.freeze({version:VERIFICATION_VERSION,verifierVersion:VERIFIER_VERSION,status:'DELIVERY_RECEIPT_VERIFIED',transactionId,sessionId,channelId,outcome,attemptId,authorizationHash:receipt.authorizationHash,deliveryHash:receipt.deliveryHash,receiptHash:receipt.receiptHash,sourceCount:receipt.sourceCount});
  const output=Object.freeze({version:VERIFICATION_VERSION,verifierVersion:VERIFIER_VERSION,status:'DELIVERY_RECEIPT_VERIFIED',reasonCode:null,outcome,receiptHash:receipt.receiptHash,sourceCount:receipt.sourceCount,verificationHash:sha256(canonical(manifest))});verifiedReceipts.add(receipt);authenticVerifications.add(output);verificationManifests.set(output,manifest);return output;
}
function isAuthenticVerification(value){return Boolean(value&&typeof value==='object'&&authenticVerifications.has(value));}
function boundSnapshot(value,expected={}){if(!isAuthenticVerification(value)||value.status!=='DELIVERY_RECEIPT_VERIFIED'||value.reasonCode!==null)return null;const manifest=verificationManifests.get(value),transactionId=clean(expected.transactionId),sessionId=clean(expected.sessionId),channelId=clean(expected.channelId),attemptId=clean(expected.attemptId),outcome=String(expected.outcome||'');if(!manifest||!transactionId||!sessionId||!channelId||!attemptId||!OUTCOMES.has(outcome)||manifest.transactionId!==transactionId||manifest.sessionId!==sessionId||manifest.channelId!==channelId||manifest.attemptId!==attemptId||manifest.outcome!==outcome||value.outcome!==manifest.outcome||value.sourceCount!==manifest.sourceCount||value.receiptHash!==manifest.receiptHash||value.verificationHash!==sha256(canonical(manifest)))return null;return Object.freeze({outcome:manifest.outcome,sourceCount:manifest.sourceCount,receiptHash:manifest.receiptHash,verificationHash:value.verificationHash});}
function isBound(value,expected={}){return boundSnapshot(value,expected)!==null;}
module.exports=Object.freeze({EXPECTED_RECEIPT_VERSION,VERIFICATION_VERSION,VERIFIER_VERSION,canonical,sha256,clean,verify,isAuthenticVerification,boundSnapshot,isBound});
