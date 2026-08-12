'use strict';
const crypto=require('node:crypto');
const SCHEMA_VERSION='sinbad-grounded-answer-seal/2K-v1';
const SEALER_VERSION='sinbad-transaction-bound-answer-sealer/2K-v1';
const authenticSeals=new WeakSet();
function canonical(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;}
function sha256(value){return crypto.createHash('sha256').update(Buffer.isBuffer(value)?value:Buffer.from(String(value),'utf8')).digest('hex');}
function queryHash(value){return sha256(Buffer.from(String(value||'').normalize('NFC'),'utf8'));}
function payload(input={}){return Object.freeze({schemaVersion:SCHEMA_VERSION,sealerVersion:SEALER_VERSION,transactionId:String(input.transactionId||''),queryHash:queryHash(input.query),answerHash:String(input.answerHash||''),mapVerifierVersion:String(input.mapVerifierVersion||''),evidenceIds:Object.freeze([...new Set((Array.isArray(input.evidenceIds)?input.evidenceIds:[]).map(String))].sort())});}
function seal(input={},context={}){const body=payload(input),valid=Boolean(body.transactionId&&/^[a-f0-9]{64}$/u.test(body.answerHash)&&body.mapVerifierVersion&&body.evidenceIds.length);const output=Object.freeze({...body,status:valid?'ANSWER_SEALED':'SEAL_INVALID',reasonCode:valid?null:'SEAL_INPUT_INVALID',sealHash:valid?sha256(Buffer.from(canonical(body),'utf8')):null});authenticSeals.add(output);if(context.audit&&typeof context.audit.append==='function')context.audit.append('answer-sealing','grounded-answer-sealer',valid?'passed':'stopped',valid?'GROUNDED_ANSWER_SEALED':'GROUNDED_ANSWER_SEAL_REJECTED',{sealerVersion:SEALER_VERSION,schemaVersion:SCHEMA_VERSION,transactionId:body.transactionId||null,evidenceCount:body.evidenceIds.length});return output;}
function isAuthenticSeal(value){return Boolean(value&&authenticSeals.has(value));}
function isBound(value,input={}){if(!isAuthenticSeal(value)||value.status!=='ANSWER_SEALED')return false;const expected=payload(input);return value.transactionId===expected.transactionId&&value.queryHash===expected.queryHash&&value.answerHash===expected.answerHash&&value.mapVerifierVersion===expected.mapVerifierVersion&&canonical(value.evidenceIds)===canonical(expected.evidenceIds)&&value.sealHash===sha256(Buffer.from(canonical(expected),'utf8'));}
module.exports=Object.freeze({SCHEMA_VERSION,SEALER_VERSION,canonical,sha256,queryHash,payload,seal,isAuthenticSeal,isBound});
