'use strict';
// Response mapper (Phase 4.3a, step A1): one captured answer of the cloud answer function -> the exact input of Draft
// Adapter v0. Pure and deterministic: no I/O, no network, no model, no clock (the caller supplies the capture time),
// no change to any accepted component. It maps what the response carries and refuses everything else; it never
// invents a passage, a document identity or an authority reference.
//
// What the response does NOT carry, and therefore what the output cannot prove (also listed in `limits`):
//  - passage text: `contentHash` is an identity hash of the document id and chunk number, so the gate's
//    EVIDENCE_CONSISTENT check (same locator, two contents) is blind on this surface;
//  - whether a cited passage supports the sentence that cites it: a marker proves the citation exists, not support.
// Source titles, mime types and page numbers are deliberately not carried into the mapped record (the titles of a
// private library are not something a record may leak).
const crypto=require('node:crypto');
const {own,id,ref,time,freezeDeep}=require('../authority/exact');

const VERSION='sinbad-answer-response-mapper/0-v1';
const INPUT_VERSION='sinbad-answer-capture/0-v1';
const ADAPTER_INPUT_VERSION='sinbad-draft-adapter-input/0-v1';
const OUTPUT_VERSION='sinbad-mapped-response/0-v1';
const INPUT_FIELDS=Object.freeze(['version','captureId','capturedAt','workspaceId','context','response']);
const MARKER=/^S[1-9]\d{0,2}$/u;
const DOCUMENT_ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/u;
const WORKSPACE_ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/u;
const MAX_SOURCES=256,MAX_ADAPTATION_ID=96,MAX_ANSWER_CHARS=200_000,MAX_CHUNK=1_000_000;
const LIMITS=Object.freeze([
  'CONTENT_HASH_IS_IDENTITY_ONLY: the response carries no passage text, so evidence consistency (same locator, changed content) cannot be checked',
  'CITATION_PROVES_EXISTENCE_NOT_SUPPORT: a marker shows the cited passage exists in the retrieved set, not that it supports the sentence',
  'SOURCE_TITLES_NOT_CARRIED: titles, mime types and page numbers stay out of the mapped record'
]);
const REASONS=Object.freeze(['INPUT_INVALID','CAPTURE_ID_INVALID','WORKSPACE_ID_INVALID','CONTEXT_SCOPE_MISMATCH','RESPONSE_INVALID','ANSWER_MISSING','SOURCE_ACCESS_NOT_PRIVILEGED','MODE_NOT_MAPPABLE','NO_SOURCES','TOO_MANY_SOURCES','SOURCE_INVALID','DUPLICATE_MARKER','DUPLICATE_EVIDENCE']);

const sha256=text=>crypto.createHash('sha256').update(Buffer.from(String(text),'utf8')).digest('hex');
function canonical(value){
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
// reads one own data property; accessors, inherited fields and proxies never reach the value
function field(object,name){
  try{
    if(!object||typeof object!=='object')return undefined;
    const d=Object.getOwnPropertyDescriptor(object,name);
    return d&&Object.hasOwn(d,'value')?d.value:undefined;
  }catch{return undefined;}
}
const isPlainObject=v=>{try{return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;}catch{return false;}};

// identity hash: what the response lets us say about a passage. Titles are hashed, never copied.
function identityHash(source){
  const documentId=field(source,'documentId'),chunk=field(source,'chunk'),title=field(source,'title');
  return typeof documentId==='string'&&documentId.length>0?sha256(`${documentId}:${chunk}`):sha256(`title:${String(title)}:${chunk}`);
}
function documentKey(source){
  const documentId=field(source,'documentId');
  if(typeof documentId==='string'&&DOCUMENT_ID.test(documentId))return documentId;
  if(typeof documentId==='string'&&documentId.length>0)return `h${sha256(documentId).slice(0,12)}`;
  return `h${sha256(String(field(source,'title'))).slice(0,12)}`;
}
function passageOf(source,capturedAt,scopeRef){
  const marker=field(source,'id'),chunk=field(source,'chunk'),title=field(source,'title'),documentId=field(source,'documentId');
  if(!isPlainObject(source)||typeof marker!=='string'||!MARKER.test(marker))return null;
  if(!Number.isSafeInteger(chunk)||chunk<0||chunk>MAX_CHUNK)return null;
  const hasDocument=typeof documentId==='string'&&documentId.length>0;
  if(!hasDocument&&(typeof title!=='string'||title.length===0))return null;
  if(documentId!==null&&documentId!==undefined&&typeof documentId!=='string')return null;
  const key=documentKey(source);
  return {marker,evidenceId:`doc.${key}.c${chunk}`,sourceClass:'DOCUMENT',locatorRef:`library:${key}:chunk-${chunk}`,contentHash:identityHash(source),observedAt:capturedAt,scopeRef};
}
function seal(record){return freezeDeep({...record,mappingDigest:sha256(canonical(record))});}
function refused(meta,reasonCode){
  return seal({version:OUTPUT_VERSION,captureId:meta.captureId,status:'REFUSED',failClosed:true,reasonCode,adapterInput:null,sourceMap:[],stats:null,limits:[...LIMITS],
    provenance:{mapperVersion:VERSION,inputVersion:INPUT_VERSION},authority:'NONE',callsModel:false,callsNetwork:false,writesFiles:false});
}

// map(input) -> MappedResponse {status: MAPPED | REFUSED}. Never throws. Input (exact own fields):
//   {version, captureId, capturedAt (ms), workspaceId, context (Phase 3.1 TaskContext, supplied by the caller), response}
// `response` is the function's JSON; only answer, sources, sourceAccess and mode are read.
function map(input){
  const meta={captureId:'invalid'};
  try{
    const v=own(INPUT_FIELDS,input);
    if(!v||v.version!==INPUT_VERSION||!time(v.capturedAt))return refused(meta,'INPUT_INVALID');
    if(!id(v.captureId)||`adapt-${v.captureId}`.length>MAX_ADAPTATION_ID)return refused(meta,'CAPTURE_ID_INVALID');
    meta.captureId=v.captureId;
    if(typeof v.workspaceId!=='string'||!WORKSPACE_ID.test(v.workspaceId))return refused(meta,'WORKSPACE_ID_INVALID');
    const scopeRef=`workspace:${v.workspaceId}`;
    if(!ref(scopeRef)||!isPlainObject(v.context)||field(v.context,'evidenceScopeRef')!==scopeRef)return refused(meta,'CONTEXT_SCOPE_MISMATCH');
    if(!isPlainObject(v.response))return refused(meta,'RESPONSE_INVALID');
    const answer=field(v.response,'answer');
    if(typeof answer!=='string'||answer.trim().length===0||answer.length>MAX_ANSWER_CHARS)return refused(meta,'ANSWER_MISSING');
    if(field(v.response,'sourceAccess')!=='privileged')return refused(meta,'SOURCE_ACCESS_NOT_PRIVILEGED');
    const mode=field(v.response,'mode');
    if(mode!=='private-rag')return refused(meta,'MODE_NOT_MAPPABLE');
    const sources=field(v.response,'sources');
    if(!Array.isArray(sources)||sources.length===0)return refused(meta,'NO_SOURCES');
    if(sources.length>MAX_SOURCES)return refused(meta,'TOO_MANY_SOURCES');
    const passages=[];
    for(const source of sources){const p=passageOf(source,v.capturedAt,scopeRef);if(!p)return refused(meta,'SOURCE_INVALID');passages.push(p);}
    if(new Set(passages.map(p=>p.marker)).size!==passages.length)return refused(meta,'DUPLICATE_MARKER');
    if(new Set(passages.map(p=>p.evidenceId)).size!==passages.length)return refused(meta,'DUPLICATE_EVIDENCE');
    const adapterInput={version:ADAPTER_INPUT_VERSION,adaptationId:`adapt-${v.captureId}`,at:v.capturedAt,context:JSON.parse(JSON.stringify(v.context)),
      answer:{text:answer,originRef:'model:sinbad-answer'},passages,retrievedAt:v.capturedAt,proposedActions:[]};
    return seal({version:OUTPUT_VERSION,captureId:v.captureId,status:'MAPPED',failClosed:false,reasonCode:null,adapterInput,
      sourceMap:passages.map(p=>({marker:p.marker,evidenceId:p.evidenceId})),stats:{sources:passages.length,answerChars:answer.length,mode},limits:[...LIMITS],
      provenance:{mapperVersion:VERSION,inputVersion:INPUT_VERSION},authority:'NONE',callsModel:false,callsNetwork:false,writesFiles:false});
  }catch{return refused(meta,'INPUT_INVALID');}
}

module.exports=Object.freeze({VERSION,INPUT_VERSION,ADAPTER_INPUT_VERSION,OUTPUT_VERSION,INPUT_FIELDS,LIMITS,REASONS,MAX_SOURCES,identityHash,map});
