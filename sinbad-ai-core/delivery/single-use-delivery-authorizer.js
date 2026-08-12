'use strict';
const crypto=require('node:crypto');
const adapter=require('../adapters/public-response-adapter.js');
const AUTHORIZATION_VERSION='sinbad-single-use-delivery-authorization/2O-v1';
const NONCE_TTL_MS=15*60*1000;
const MAX_NONCE_RECORDS=10000;
const consumedDeliveries=new WeakSet();
const consumedNonces=new Map();
function canonical(value){if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;return JSON.stringify(value);}
function sha256(value){return crypto.createHash('sha256').update(Buffer.isBuffer(value)?value:Buffer.from(String(value),'utf8')).digest('hex');}
function clean(value){const text=String(value||'').trim().normalize('NFC');return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(text)?text:'';}
function blocked(input={}){return Object.freeze({version:AUTHORIZATION_VERSION,status:'DELIVERY_AUTHORIZATION_BLOCKED',reasonCode:'DELIVERY_AUTHORIZATION_DENIED',transactionId:String(input.transactionId||''),sessionId:null,channelId:null,contentType:'text/plain; charset=utf-8',renderingPolicy:'TEXT_ONLY_NO_HTML',answer:null,sources:Object.freeze([]),deliveryHash:null,authorizationHash:null});}
function prune(now){for(const [key,expiresAt] of consumedNonces){if(expiresAt<=now)consumedNonces.delete(key);}}
function authorize(delivery={},context={}){
  const sessionId=clean(context.sessionId),channelId=clean(context.channelId),deliveryNonce=clean(context.deliveryNonce);
  const nonceKey=deliveryNonce?sha256(`${sessionId}\u0000${channelId}\u0000${deliveryNonce}`):'';
  const now=typeof context.now==='function'?Number(context.now()):Date.now();if(!Number.isFinite(now))return blocked(delivery);prune(now);
  if(!adapter.isAuthenticDelivery(delivery)||delivery.status!=='DELIVERY_READY'||!sessionId||!channelId||!deliveryNonce||consumedDeliveries.has(delivery)||consumedNonces.has(nonceKey)||consumedNonces.size>=MAX_NONCE_RECORDS)return blocked(delivery);
  const expected=adapter.deliveryPayload(delivery);
  if(delivery.deliveryHash!==adapter.sha256(adapter.canonical(expected)))return blocked(delivery);
  const body=Object.freeze({version:AUTHORIZATION_VERSION,status:'DELIVERY_AUTHORIZED',reasonCode:null,transactionId:String(delivery.transactionId),sessionId,channelId,contentType:delivery.contentType,renderingPolicy:delivery.renderingPolicy,answer:delivery.answer,sources:delivery.sources,deliveryHash:delivery.deliveryHash,nonceHash:sha256(deliveryNonce)});
  consumedDeliveries.add(delivery);consumedNonces.set(nonceKey,now+NONCE_TTL_MS);return Object.freeze({...body,authorizationHash:sha256(canonical(body))});
}
module.exports=Object.freeze({AUTHORIZATION_VERSION,NONCE_TTL_MS,MAX_NONCE_RECORDS,canonical,sha256,clean,authorize});
