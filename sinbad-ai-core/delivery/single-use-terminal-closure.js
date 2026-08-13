'use strict';
const crypto=require('node:crypto');
const verifier=require('../verification/terminal-delivery-receipt-verifier.js');
const EXPECTED_VERIFICATION_VERSION='sinbad-terminal-delivery-receipt-verification/2Q-v1';
if(verifier.VERIFICATION_VERSION!==EXPECTED_VERIFICATION_VERSION)throw new Error(`Unsupported terminal verification version: ${verifier.VERIFICATION_VERSION}`);
const CLOSURE_VERSION='sinbad-single-use-terminal-closure/2R-v1';
const consumed=new WeakSet();
const authenticClosures=new WeakSet();
const closureManifests=new WeakMap();
function canonical(value){if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;return JSON.stringify(value);}
function sha256(value){return crypto.createHash('sha256').update(Buffer.isBuffer(value)?value:Buffer.from(String(value),'utf8')).digest('hex');}
const clean=verifier.clean;
function blocked(){return Object.freeze({version:CLOSURE_VERSION,status:'TERMINAL_CLOSURE_BLOCKED',reasonCode:'TERMINAL_CLOSURE_DENIED',outcome:null,sourceCount:0,verificationHash:null,closureHash:null});}
function close(verification={},context={}){
  const closureId=clean(context.closureId),snapshot=verifier.boundSnapshot(verification,context);
  if(!closureId||!snapshot||consumed.has(verification)||!/^[a-f0-9]{64}$/u.test(snapshot.verificationHash)||!Number.isInteger(snapshot.sourceCount)||snapshot.sourceCount<0||snapshot.sourceCount>64)return blocked();
  const manifest=Object.freeze({version:CLOSURE_VERSION,status:'TERMINAL_CLOSURE_CONFIRMED',closureId,outcome:snapshot.outcome,sourceCount:snapshot.sourceCount,verificationHash:snapshot.verificationHash});
  const output=Object.freeze({version:CLOSURE_VERSION,status:'TERMINAL_CLOSURE_CONFIRMED',reasonCode:null,outcome:snapshot.outcome,sourceCount:snapshot.sourceCount,verificationHash:snapshot.verificationHash,closureHash:sha256(canonical(manifest))});consumed.add(verification);authenticClosures.add(output);closureManifests.set(output,manifest);return output;
}
function isAuthenticClosure(value){return Boolean(value&&typeof value==='object'&&authenticClosures.has(value));}
function boundSnapshot(value,expected={}){if(!isAuthenticClosure(value)||value.status!=='TERMINAL_CLOSURE_CONFIRMED'||value.reasonCode!==null)return null;const manifest=closureManifests.get(value),closureId=clean(expected.closureId),outcome=String(expected.outcome||'');if(!manifest||!closureId||!['DELIVERED','FAILED'].includes(outcome)||manifest.closureId!==closureId||manifest.outcome!==outcome||value.outcome!==manifest.outcome||value.sourceCount!==manifest.sourceCount||value.verificationHash!==manifest.verificationHash||value.closureHash!==sha256(canonical(manifest)))return null;return Object.freeze({closureId:manifest.closureId,outcome:manifest.outcome,sourceCount:manifest.sourceCount,verificationHash:manifest.verificationHash,closureHash:value.closureHash});}
function isBound(value,expected={}){return boundSnapshot(value,expected)!==null;}
module.exports=Object.freeze({EXPECTED_VERIFICATION_VERSION,CLOSURE_VERSION,canonical,sha256,clean,close,isAuthenticClosure,boundSnapshot,isBound});
