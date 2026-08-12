'use strict';
const crypto=require('node:crypto');
const SCHEMA_VERSION='sinbad-grounded-answer-release/2L-v1';
const GATE_VERSION='sinbad-grounded-answer-release-gate/2L-v1';
const authenticReleases=new WeakSet();
function canonical(value){if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;return JSON.stringify(value);}
function sha256(value){return crypto.createHash('sha256').update(Buffer.isBuffer(value)?value:Buffer.from(String(value),'utf8')).digest('hex');}
function ids(values){return Object.freeze([...new Set((Array.isArray(values)?values:[]).map(String).filter(Boolean))].sort());}
function payload(input={}){return Object.freeze({schemaVersion:SCHEMA_VERSION,gateVersion:GATE_VERSION,transactionId:String(input.transactionId||''),queryHash:String(input.queryHash||''),answerHash:String(input.answerHash||''),sealHash:String(input.sealHash||''),evidenceIds:ids(input.evidenceIds),citationIds:ids(input.citationIds)});}
function release(input={},context={}){
  const sealInput=input.sealInput&&typeof input.sealInput==='object'?input.sealInput:{};
  const answer=input.groundedAnswer&&typeof input.groundedAnswer==='object'?input.groundedAnswer:{};
  const seal=input.answerSeal&&typeof input.answerSeal==='object'?input.answerSeal:null;
  const sealer=context.answerSealer;
  const body=payload({transactionId:sealInput.transactionId,queryHash:seal?.queryHash,answerHash:answer.composition?.answerHash,sealHash:seal?.sealHash,evidenceIds:answer.evidenceUsed,citationIds:(Array.isArray(answer.citations)?answer.citations:[]).map(item=>item?.id)});
  const valid=Boolean(answer.status==='GROUNDED'&&answer.answer&&/^[a-f0-9]{64}$/u.test(body.answerHash)&&/^[a-f0-9]{64}$/u.test(body.queryHash)&&/^[a-f0-9]{64}$/u.test(body.sealHash)&&body.transactionId&&body.evidenceIds.length&&body.citationIds.length&&sealer&&typeof sealer.isBound==='function'&&sealer.isBound(seal,sealInput)&&body.answerHash===seal.answerHash&&canonical(body.evidenceIds)===canonical(ids(seal.evidenceIds)));
  const output=Object.freeze({...body,status:valid?'ANSWER_RELEASED':'RELEASE_BLOCKED',reasonCode:valid?null:'RELEASE_BINDING_INVALID',releaseHash:valid?sha256(canonical(body)):null});
  authenticReleases.add(output);
  if(context.audit&&typeof context.audit.append==='function')context.audit.append('answer-release','grounded-answer-release-gate',valid?'passed':'stopped',valid?'GROUNDED_ANSWER_RELEASED':'GROUNDED_ANSWER_RELEASE_BLOCKED',{gateVersion:GATE_VERSION,schemaVersion:SCHEMA_VERSION,transactionId:body.transactionId||null,evidenceCount:body.evidenceIds.length,citationCount:body.citationIds.length});
  return output;
}
function isAuthenticRelease(value){return Boolean(value&&typeof value==='object'&&authenticReleases.has(value));}
function isBound(value,input={}){if(!isAuthenticRelease(value)||value.status!=='ANSWER_RELEASED')return false;const expected=payload(input);return value.transactionId===expected.transactionId&&value.queryHash===expected.queryHash&&value.answerHash===expected.answerHash&&value.sealHash===expected.sealHash&&canonical(value.evidenceIds)===canonical(expected.evidenceIds)&&canonical(value.citationIds)===canonical(expected.citationIds)&&value.releaseHash===sha256(canonical(expected));}
module.exports=Object.freeze({SCHEMA_VERSION,GATE_VERSION,canonical,sha256,payload,release,isAuthenticRelease,isBound});
