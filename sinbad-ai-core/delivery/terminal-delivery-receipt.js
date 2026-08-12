'use strict';
const crypto=require('node:crypto');
const authorizer=require('./single-use-delivery-authorizer.js');
const RECEIPT_VERSION='sinbad-terminal-delivery-receipt/2P-v1';
const OUTCOMES=new Set(['DELIVERED','FAILED']);
// Process-local terminality: durable cross-restart deduplication belongs to the delivery persistence layer.
const recorded=new WeakSet();
function canonical(value){if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;return JSON.stringify(value);}
function sha256(value){return crypto.createHash('sha256').update(Buffer.isBuffer(value)?value:Buffer.from(String(value),'utf8')).digest('hex');}
const clean=authorizer.clean;
function blocked(){return Object.freeze({version:RECEIPT_VERSION,status:'DELIVERY_RECEIPT_BLOCKED',reasonCode:'DELIVERY_RECEIPT_DENIED',transactionId:null,sessionId:null,channelId:null,outcome:null,attemptId:null,authorizationHash:null,deliveryHash:null,sourceCount:0,receiptHash:null});}
function record(authorization={},input={}){
  const outcome=String(input.outcome||''),sessionId=clean(input.sessionId),channelId=clean(input.channelId),attemptId=clean(input.attemptId);
  if(!authorizer.isAuthenticAuthorization(authorization)||authorization.status!=='DELIVERY_AUTHORIZED'||recorded.has(authorization)||!OUTCOMES.has(outcome)||!sessionId||!channelId||!attemptId||sessionId!==authorization.sessionId||channelId!==authorization.channelId)return blocked(authorization);
  const sourceCount=Array.isArray(authorization.sources)?authorization.sources.length:0;
  const body=Object.freeze({version:RECEIPT_VERSION,status:'DELIVERY_RECEIPT_RECORDED',reasonCode:null,transactionId:String(authorization.transactionId),sessionId,channelId,outcome,attemptId,authorizationHash:String(authorization.authorizationHash),deliveryHash:String(authorization.deliveryHash),sourceCount});
  if(!/^[a-f0-9]{64}$/u.test(body.authorizationHash)||!/^[a-f0-9]{64}$/u.test(body.deliveryHash))return blocked(authorization);
  recorded.add(authorization);return Object.freeze({...body,receiptHash:sha256(canonical(body))});
}
module.exports=Object.freeze({RECEIPT_VERSION,canonical,sha256,clean,record});
