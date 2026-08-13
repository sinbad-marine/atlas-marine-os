'use strict';
const crypto=require('node:crypto');
const closures=require('../delivery/single-use-terminal-closure.js');
const EXPECTED_CLOSURE_VERSION='sinbad-single-use-terminal-closure/2R-v1';
if(closures.CLOSURE_VERSION!==EXPECTED_CLOSURE_VERSION)throw new Error(`Unsupported terminal closure version: ${closures.CLOSURE_VERSION}`);
const VERIFICATION_VERSION='sinbad-terminal-closure-verification/2S-v1';
const VERIFIER_VERSION='sinbad-independent-terminal-closure-verifier/2S-v1';
const verifiedClosures=new WeakSet();
const authenticResults=new WeakSet();
const resultManifests=new WeakMap();
function canonical(value){if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;return JSON.stringify(value);}
function sha256(value){return crypto.createHash('sha256').update(Buffer.isBuffer(value)?value:Buffer.from(String(value),'utf8')).digest('hex');}
const clean=closures.clean;
function blocked(){return Object.freeze({version:VERIFICATION_VERSION,verifierVersion:VERIFIER_VERSION,status:'TERMINAL_CLOSURE_INVALID',reasonCode:'TERMINAL_CLOSURE_VERIFICATION_DENIED',outcome:null,sourceCount:0,closureHash:null,closureVerificationHash:null});}
function verify(closure={},expected={}){
  const snapshot=closures.boundSnapshot(closure,expected);
  if(!snapshot||verifiedClosures.has(closure)||!Number.isInteger(snapshot.sourceCount)||snapshot.sourceCount<0||snapshot.sourceCount>64||!/^[a-f0-9]{64}$/u.test(snapshot.verificationHash)||!/^[a-f0-9]{64}$/u.test(snapshot.closureHash))return blocked();
  const manifest=Object.freeze({version:VERIFICATION_VERSION,verifierVersion:VERIFIER_VERSION,status:'TERMINAL_CLOSURE_VERIFIED',closureId:snapshot.closureId,outcome:snapshot.outcome,sourceCount:snapshot.sourceCount,verificationHash:snapshot.verificationHash,closureHash:snapshot.closureHash});
  const output=Object.freeze({version:VERIFICATION_VERSION,verifierVersion:VERIFIER_VERSION,status:'TERMINAL_CLOSURE_VERIFIED',reasonCode:null,outcome:snapshot.outcome,sourceCount:snapshot.sourceCount,closureHash:snapshot.closureHash,closureVerificationHash:sha256(canonical(manifest))});verifiedClosures.add(closure);authenticResults.add(output);resultManifests.set(output,manifest);return output;
}
function isAuthenticResult(value){return Boolean(value&&typeof value==='object'&&authenticResults.has(value));}
function boundSnapshot(value,expected={}){if(!isAuthenticResult(value)||value.status!=='TERMINAL_CLOSURE_VERIFIED'||value.reasonCode!==null)return null;const manifest=resultManifests.get(value),closureId=clean(expected.closureId),outcome=String(expected.outcome||'');if(!manifest||!closureId||!['DELIVERED','FAILED'].includes(outcome)||manifest.closureId!==closureId||manifest.outcome!==outcome||value.outcome!==manifest.outcome||value.sourceCount!==manifest.sourceCount||value.closureHash!==manifest.closureHash||value.closureVerificationHash!==sha256(canonical(manifest)))return null;return Object.freeze({closureId:manifest.closureId,outcome:manifest.outcome,sourceCount:manifest.sourceCount,verificationHash:manifest.verificationHash,closureHash:manifest.closureHash,closureVerificationHash:value.closureVerificationHash});}
function isBound(value,expected={}){return boundSnapshot(value,expected)!==null;}
module.exports=Object.freeze({EXPECTED_CLOSURE_VERSION,VERIFICATION_VERSION,VERIFIER_VERSION,canonical,sha256,clean,verify,isAuthenticResult,boundSnapshot,isBound});
