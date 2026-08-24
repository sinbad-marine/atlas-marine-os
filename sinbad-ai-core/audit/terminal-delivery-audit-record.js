'use strict';
const crypto=require('node:crypto');
const verifier=require('../verification/terminal-closure-verifier.js');
const EXPECTED_VERIFICATION_VERSION='sinbad-terminal-closure-verification/2S-v1';
if(verifier.VERIFICATION_VERSION!==EXPECTED_VERIFICATION_VERSION)throw new Error(`Unsupported closure verification version: ${verifier.VERIFICATION_VERSION}`);
const RECORD_VERSION='sinbad-terminal-delivery-audit-record/2T-v1';
const consumed=new WeakSet();
const authenticRecords=new WeakSet();
const recordManifests=new WeakMap();
function canonical(value){if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;return JSON.stringify(value);}
function sha256(value){return crypto.createHash('sha256').update(Buffer.isBuffer(value)?value:Buffer.from(String(value),'utf8')).digest('hex');}
const clean=verifier.clean;
function blocked(){return Object.freeze({version:RECORD_VERSION,status:'TERMINAL_AUDIT_BLOCKED',reasonCode:'TERMINAL_AUDIT_DENIED',outcome:null,sourceCount:0,closureHash:null,closureVerificationHash:null,auditHash:null});}
function record(verification={},context={}){const auditId=clean(context.auditId),snapshot=verifier.boundSnapshot(verification,context);if(!auditId||!snapshot||consumed.has(verification)||!Number.isInteger(snapshot.sourceCount)||snapshot.sourceCount<0||snapshot.sourceCount>64||!/^[a-f0-9]{64}$/u.test(snapshot.closureHash)||!/^[a-f0-9]{64}$/u.test(snapshot.closureVerificationHash))return blocked();const manifest=Object.freeze({version:RECORD_VERSION,status:'TERMINAL_AUDIT_RECORDED',auditId,closureId:snapshot.closureId,outcome:snapshot.outcome,sourceCount:snapshot.sourceCount,closureHash:snapshot.closureHash,closureVerificationHash:snapshot.closureVerificationHash});const output=Object.freeze({version:RECORD_VERSION,status:'TERMINAL_AUDIT_RECORDED',reasonCode:null,outcome:snapshot.outcome,sourceCount:snapshot.sourceCount,closureHash:snapshot.closureHash,closureVerificationHash:snapshot.closureVerificationHash,auditHash:sha256(canonical(manifest))});consumed.add(verification);authenticRecords.add(output);recordManifests.set(output,manifest);return output;}
function isAuthenticRecord(value){return Boolean(value&&typeof value==='object'&&authenticRecords.has(value));}
function boundSnapshot(value,expected={}){if(!isAuthenticRecord(value)||value.status!=='TERMINAL_AUDIT_RECORDED'||value.reasonCode!==null)return null;const manifest=recordManifests.get(value),auditId=clean(expected.auditId),closureId=clean(expected.closureId),outcome=String(expected.outcome||'');if(!manifest||!auditId||!closureId||!['DELIVERED','FAILED'].includes(outcome)||manifest.auditId!==auditId||manifest.closureId!==closureId||manifest.outcome!==outcome||value.outcome!==manifest.outcome||value.sourceCount!==manifest.sourceCount||value.closureHash!==manifest.closureHash||value.closureVerificationHash!==manifest.closureVerificationHash||value.auditHash!==sha256(canonical(manifest)))return null;return Object.freeze({auditId:manifest.auditId,closureId:manifest.closureId,outcome:manifest.outcome,sourceCount:manifest.sourceCount,closureHash:manifest.closureHash,closureVerificationHash:manifest.closureVerificationHash,auditHash:value.auditHash});}
function isBound(value,expected={}){return boundSnapshot(value,expected)!==null;}
module.exports=Object.freeze({EXPECTED_VERIFICATION_VERSION,RECORD_VERSION,canonical,sha256,clean,record,isAuthenticRecord,boundSnapshot,isBound});
