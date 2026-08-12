'use strict';
const crypto=require('node:crypto');
const orchestrationContract=require('../orchestrator/grounded-orchestration-contract.js');
const ADAPTER_VERSION='sinbad-public-delivery-adapter/2N-v1';
const ORCHESTRATOR_VERSION='sinbad-grounded-orchestrator/2M';
const RESPONSE_SCHEMA='sinbad-public-grounded-response/2M-v1';
const PROJECTOR_VERSION='sinbad-public-response-projector/2M-v1';
const RENDERING_POLICY='TEXT_ONLY_NO_HTML';
const CONTENT_TYPE='text/plain; charset=utf-8';
function canonical(value){if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;return JSON.stringify(value);}
function sha256(value){return crypto.createHash('sha256').update(Buffer.isBuffer(value)?value:Buffer.from(String(value),'utf8')).digest('hex');}
function hasUnsafeControls(value){return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(String(value??''));}
function nullable(value){return value==null||String(value).trim()===''?null:String(value);}
function location(value={}){return Object.freeze({section:nullable(value.section),page:nullable(value.page),chunk:nullable(value.chunk),uri:nullable(value.uri)});}
function source(value={}){return Object.freeze({id:String(value.id||''),title:nullable(value.title),location:location(value.location),publishedAt:nullable(value.publishedAt),version:nullable(value.version),authority:nullable(value.authority),verified:value.verified===true,metadataComplete:value.metadataComplete===true});}
function responsePayload(value={}){return Object.freeze({schemaVersion:String(value.schemaVersion||''),projectorVersion:String(value.projectorVersion||''),renderingPolicy:String(value.renderingPolicy||''),contentType:String(value.contentType||''),transactionId:String(value.transactionId||''),answer:String(value.answer||''),answerHash:String(value.answerHash||''),releaseHash:String(value.releaseHash||''),citations:Object.freeze((Array.isArray(value.citations)?value.citations:[]).map(source))});}
function safeHttps(value){if(value==null)return true;try{return new URL(String(value)).protocol==='https:';}catch{return false;}}
function adapt(input={}){
  const response=input.publicResponse&&typeof input.publicResponse==='object'?input.publicResponse:null;
  const body=responsePayload(response||{}),ids=body.citations.map(item=>item.id),sorted=[...ids].sort();
  const safeText=!hasUnsafeControls(body.answer)&&body.citations.every(item=>[item.id,item.title,item.location.section,item.location.page,item.location.chunk,item.publishedAt,item.version,item.authority].every(value=>!hasUnsafeControls(value)));
  const rawUrisSafe=(Array.isArray(response?.citations)?response.citations:[]).every(item=>typeof item?.location?.uri!=='string'||item.location.uri.trim()!=='');
  const valid=Boolean(orchestrationContract.isAuthenticResult(input)&&input.version===ORCHESTRATOR_VERSION&&input.status==='GROUNDED_PLAN_READY'&&input.security?.publicProjectionRequired===true&&response?.status==='PUBLIC_RESPONSE_READY'&&response.reasonCode==null&&body.schemaVersion===RESPONSE_SCHEMA&&body.projectorVersion===PROJECTOR_VERSION&&body.renderingPolicy===RENDERING_POLICY&&body.contentType===CONTENT_TYPE&&body.transactionId&&body.transactionId===String(input.transactionId||'')&&body.answer&&sha256(body.answer)===body.answerHash&&/^[a-f0-9]{64}$/u.test(body.releaseHash)&&body.citations.length>0&&body.citations.length<=64&&new Set(ids).size===ids.length&&canonical(ids)===canonical(sorted)&&safeText&&rawUrisSafe&&body.citations.every(item=>item.id&&item.verified&&safeHttps(item.location.uri))&&response.responseHash===sha256(canonical(body)));
  if(!valid)return Object.freeze({version:ADAPTER_VERSION,status:'DELIVERY_BLOCKED',reasonCode:'PUBLIC_RESPONSE_INVALID',transactionId:String(input.transactionId||''),contentType:CONTENT_TYPE,renderingPolicy:RENDERING_POLICY,answer:null,sources:Object.freeze([]),responseHash:null,deliveryHash:null});
  const delivery=Object.freeze({version:ADAPTER_VERSION,status:'DELIVERY_READY',reasonCode:null,transactionId:body.transactionId,contentType:CONTENT_TYPE,renderingPolicy:RENDERING_POLICY,answer:body.answer,sources:body.citations,responseHash:String(response.responseHash)});
  return Object.freeze({...delivery,deliveryHash:sha256(canonical(delivery))});
}
module.exports=Object.freeze({ADAPTER_VERSION,ORCHESTRATOR_VERSION,RESPONSE_SCHEMA,PROJECTOR_VERSION,RENDERING_POLICY,CONTENT_TYPE,canonical,sha256,responsePayload,adapt});
