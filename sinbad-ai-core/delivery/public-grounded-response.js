'use strict';
const crypto=require('node:crypto');
const SCHEMA_VERSION='sinbad-public-grounded-response/2M-v1';
const PROJECTOR_VERSION='sinbad-public-response-projector/2M-v1';
const RENDERING_POLICY='TEXT_ONLY_NO_HTML';
const CONTENT_TYPE='text/plain; charset=utf-8';
const authenticResponses=new WeakSet();
function canonical(value){if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;return JSON.stringify(value);}
function sha256(value){return crypto.createHash('sha256').update(Buffer.isBuffer(value)?value:Buffer.from(String(value),'utf8')).digest('hex');}
function nullable(value){return value==null||String(value).trim()===''?null:String(value);}
function safeUri(value){const text=nullable(value);if(!text)return null;try{const parsed=new URL(text);return parsed.protocol==='https:'?parsed.href:null;}catch{return null;}}
function hasUnsafeControls(value){return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(String(value??''));}
function location(value={}){return Object.freeze({section:nullable(value.section),page:nullable(value.page),chunk:nullable(value.chunk),uri:safeUri(value.uri)});}
function citation(value={}){return Object.freeze({id:String(value.id||''),title:nullable(value.title),location:location(value.location),publishedAt:nullable(value.publishedAt),version:nullable(value.version),authority:nullable(value.authority),verified:value.verified===true,metadataComplete:value.metadataComplete===true});}
function ids(values){return Object.freeze([...new Set((Array.isArray(values)?values:[]).map(String).filter(Boolean))].sort());}
function payload(input={}){return Object.freeze({schemaVersion:SCHEMA_VERSION,projectorVersion:PROJECTOR_VERSION,renderingPolicy:RENDERING_POLICY,contentType:CONTENT_TYPE,transactionId:String(input.transactionId||''),answer:String(input.answer||''),answerHash:String(input.answerHash||''),releaseHash:String(input.releaseHash||''),citations:Object.freeze((Array.isArray(input.citations)?input.citations:[]).map(citation).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0))});}
function project(input={},context={}){
  const release=input.answerRelease&&typeof input.answerRelease==='object'?input.answerRelease:null;
  const answer=input.groundedAnswer&&typeof input.groundedAnswer==='object'?input.groundedAnswer:{};
  const releaseGate=context.answerReleaseGate;
  const citations=Array.isArray(answer.citations)?answer.citations:[];
  const body=payload({transactionId:release?.transactionId,answer:answer.answer,answerHash:answer.composition?.answerHash,releaseHash:release?.releaseHash,citations});
  const citationIds=ids(citations.map(item=>item?.id));
  const safeLocations=citations.every(item=>!nullable(item?.location?.uri)||safeUri(item.location.uri));
  const releaseInput={transactionId:release?.transactionId,queryHash:release?.queryHash,answerHash:answer.composition?.answerHash,sealHash:release?.sealHash,evidenceIds:answer.evidenceUsed,citationIds};
  const safeText=!hasUnsafeControls(body.answer)&&body.citations.every(item=>[item.id,item.title,item.location.section,item.location.page,item.location.chunk,item.publishedAt,item.version,item.authority].every(value=>!hasUnsafeControls(value)));
  const valid=Boolean(release&&releaseGate&&typeof releaseGate.isBound==='function'&&releaseGate.isBound(release,releaseInput)&&answer.status==='GROUNDED'&&body.transactionId&&body.answer&&sha256(body.answer)===body.answerHash&&body.answerHash===release.answerHash&&body.releaseHash===release.releaseHash&&citations.length===citationIds.length&&canonical(citationIds)===canonical(ids(release.citationIds))&&safeLocations&&safeText&&body.citations.every(item=>item.id&&item.verified));
  const output=Object.freeze({...body,status:valid?'PUBLIC_RESPONSE_READY':'PUBLIC_RESPONSE_BLOCKED',reasonCode:valid?null:'PUBLIC_PROJECTION_INVALID',responseHash:valid?sha256(canonical(body)):null});
  authenticResponses.add(output);
  if(context.audit&&typeof context.audit.append==='function')context.audit.append('public-response-projection','public-grounded-response-projector',valid?'passed':'stopped',valid?'PUBLIC_RESPONSE_PROJECTED':'PUBLIC_RESPONSE_PROJECTION_BLOCKED',{projectorVersion:PROJECTOR_VERSION,schemaVersion:SCHEMA_VERSION,transactionId:body.transactionId||null,citationCount:body.citations.length});
  return output;
}
function isAuthenticResponse(value){return Boolean(value&&typeof value==='object'&&authenticResponses.has(value));}
function isBound(value,input={}){if(!isAuthenticResponse(value)||value.status!=='PUBLIC_RESPONSE_READY')return false;const expected=payload(input);return value.transactionId===expected.transactionId&&value.answer===expected.answer&&value.answerHash===expected.answerHash&&value.releaseHash===expected.releaseHash&&canonical(value.citations)===canonical(expected.citations)&&value.responseHash===sha256(canonical(expected));}
module.exports=Object.freeze({SCHEMA_VERSION,PROJECTOR_VERSION,RENDERING_POLICY,CONTENT_TYPE,canonical,sha256,safeUri,hasUnsafeControls,payload,project,isAuthenticResponse,isBound});
