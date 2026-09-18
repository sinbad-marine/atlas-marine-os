'use strict';
// Project 2 Phase 3.8 - Record Attestation v0 (inert, deterministic origin envelope for sealed records).
// Owner GO 2026-09-18: the Owner approved the recommended next phase (record authenticity
// envelope); scope "PROJECT 2 / PHASE 3.8 - RECORD ATTESTATION v0 ONLY".
//
// The sealed records of Sentinel, Co-Pilot, Gatekeeper, Pilot and the Offline Chain carry a
// self-digest, which proves integrity and nothing about origin: anyone can reseal an edited
// record. Attestation v0 closes that gap on paper. attest() signs a small envelope that binds one
// intact record (kind, version, digests, task) to a key id and a time; check() decides whether an
// envelope and a record together are AUTHENTIC against a caller-supplied trust store in which
// every key is bound to the record kinds it may attest.
// It is pure and deterministic (Ed25519 signatures are deterministic). It generates no keys, stores
// no keys, reads no clock, performs no I/O, calls no model, keeps no state, is not wired anywhere,
// never throws, and attests origin only: an AUTHENTIC record gains no authority and nothing is
// approved, executed or granted. The only platform module it uses is the signature primitive.
const {createPrivateKey,createPublicKey,sign,verify}=require('node:crypto');
const {own,id,hash,time,bool,oneOf,freezeDeep}=require('../authority/exact');
const sentinel=require('../sentinel/sentinel-v0');
const copilot=require('../copilot/copilot-v0');
const gatekeeper=require('../gatekeeper/gatekeeper-v0');
const pilot=require('../pilot/pilot-v0');
const chain=require('../chain/chain-v0');
const {sha256,canonical}=sentinel;

const VERSION='sinbad-attest/0-v1';
const ATTEST_INPUT_VERSION='sinbad-attest-input/0-v1';
const CHECK_INPUT_VERSION='sinbad-attest-check-input/0-v1';
const ENVELOPE_VERSION='sinbad-attestation/0-v1';
const RESULT_VERSION='sinbad-attest-result/0-v1';
const CHECK_VERSION='sinbad-attest-check/0-v1';
const ALGORITHM='ED25519';
// One row per record kind: which sealed format it is, which field holds its self-digest, how the
// producing component verifies it, and where its task reference lives.
const KINDS=Object.freeze({
  SENTINEL_REPORT:Object.freeze({recordVersion:sentinel.REPORT_VERSION,digestField:'reportDigest',verify:sentinel.verifyReport,taskRef:r=>r.taskRef}),
  COPILOT_REVIEW:Object.freeze({recordVersion:copilot.REVIEW_VERSION,digestField:'reviewDigest',verify:copilot.verifyReview,taskRef:r=>r.taskRef}),
  GATEKEEPER_DECISION:Object.freeze({recordVersion:gatekeeper.DECISION_VERSION,digestField:'decisionDigest',verify:gatekeeper.verifyDecision,taskRef:r=>r.taskRef}),
  PILOT_DECISION:Object.freeze({recordVersion:pilot.DECISION_VERSION,digestField:'pilotDecisionDigest',verify:pilot.verifyPilotDecision,taskRef:r=>r.taskRef}),
  CHAIN_TRANSCRIPT:Object.freeze({recordVersion:chain.TRANSCRIPT_VERSION,digestField:'transcriptDigest',verify:chain.verifyTranscript,taskRef:r=>r.taskRef})
});
const KIND_NAMES=Object.freeze(Object.keys(KINDS));
const ATTEST_FIELDS=Object.freeze(['version','attestationId','issuedAt','recordKind','record','signer']);
const SIGNER_FIELDS=Object.freeze(['keyId','seedHex']);
const ENVELOPE_FIELDS=Object.freeze(['version','attestationId','algorithm','keyId','recordKind','recordVersion','recordDigest','payloadDigest','taskRef','issuedAt','authority','signature']);
const CHECK_FIELDS=Object.freeze(['version','checkId','at','envelope','record','trustStore','expected','policy']);
const TRUST_FIELDS=Object.freeze(['keyId','publicKeyHex','kinds','notBefore','notAfter','revoked']);
const EXPECTED_FIELDS=Object.freeze(['recordKind','taskRef']);
const POLICY_FIELDS=Object.freeze(['maxAgeMs']);
const MAX_KEYS=64,MAX_RECORD_CHARS=4_000_000,MAX_AGE_MS=366*24*60*60*1000;
const DEFAULT_POLICY=Object.freeze({maxAgeMs:24*60*60*1000});
const PKCS8_ED25519=Buffer.from('302e020100300506032b657004220420','hex');
const SPKI_ED25519=Buffer.from('302a300506032b6570032100','hex');
const SIGNATURE=/^[a-f0-9]{128}$/u;

const privateKeyOf=seedHex=>createPrivateKey({key:Buffer.concat([PKCS8_ED25519,Buffer.from(seedHex,'hex')]),format:'der',type:'pkcs8'});
const publicKeyOf=publicKeyHex=>createPublicKey({key:Buffer.concat([SPKI_ED25519,Buffer.from(publicKeyHex,'hex')]),format:'der',type:'spki'});
// derivePublicKey(seedHex) -> 64 hex chars, or null. Pure; lets a caller build a trust store entry for a key it holds.
function derivePublicKey(seedHex){
  if(!hash(seedHex))return null;
  try{return createPublicKey(privateKeyOf(seedHex)).export({format:'der',type:'spki'}).subarray(SPKI_ED25519.length).toString('hex');}catch{return null;}
}
function plainCopy(record){
  if(record===null||typeof record!=='object'||Array.isArray(record))return null;
  try{const text=JSON.stringify(record);if(typeof text!=='string'||text.length>MAX_RECORD_CHARS)return null;return JSON.parse(text);}catch{return null;}
}
// describe(kind, record) -> what an envelope binds, or a reason why this record cannot be attested.
function describe(recordKind,record){
  const kind=KINDS[recordKind];const copy=plainCopy(record);
  if(!copy)return {reasonCode:'RECORD_NOT_PLAIN_DATA'};
  if(copy.version!==kind.recordVersion)return {reasonCode:'RECORD_KIND_MISMATCH'};
  let intact=false;try{intact=kind.verify(copy)===true;}catch{intact=false;}
  if(!intact||!hash(copy[kind.digestField])||copy.authority!=='NONE')return {reasonCode:'RECORD_NOT_INTACT'};
  const taskRef=kind.taskRef(copy);
  if(!(taskRef===null||id(taskRef)))return {reasonCode:'RECORD_NOT_INTACT'};
  return {reasonCode:null,recordVersion:kind.recordVersion,recordDigest:copy[kind.digestField],payloadDigest:sha256(canonical(copy)),taskRef};
}
const signedPart=e=>canonical({version:e.version,attestationId:e.attestationId,algorithm:e.algorithm,keyId:e.keyId,recordKind:e.recordKind,recordVersion:e.recordVersion,recordDigest:e.recordDigest,payloadDigest:e.payloadDigest,taskRef:e.taskRef,issuedAt:e.issuedAt,authority:e.authority});
function envelope(input){
  const v=own(ENVELOPE_FIELDS,input);
  if(!v||v.version!==ENVELOPE_VERSION||!id(v.attestationId)||v.algorithm!==ALGORITHM||!id(v.keyId)||!oneOf(KIND_NAMES,v.recordKind)||v.recordVersion!==KINDS[v.recordKind].recordVersion||!hash(v.recordDigest)||!hash(v.payloadDigest)||!(v.taskRef===null||id(v.taskRef))||!time(v.issuedAt)||v.authority!=='NONE'||typeof v.signature!=='string'||!SIGNATURE.test(v.signature))return null;
  return freezeDeep({version:ENVELOPE_VERSION,attestationId:v.attestationId,algorithm:ALGORITHM,keyId:v.keyId,recordKind:v.recordKind,recordVersion:v.recordVersion,recordDigest:v.recordDigest,payloadDigest:v.payloadDigest,taskRef:v.taskRef,issuedAt:v.issuedAt,authority:'NONE',signature:v.signature});
}
function trustEntry(input){
  const v=own(TRUST_FIELDS,input);
  if(!v||!id(v.keyId)||!hash(v.publicKeyHex)||!Array.isArray(v.kinds)||v.kinds.length<1||v.kinds.length>KIND_NAMES.length||!v.kinds.every(k=>oneOf(KIND_NAMES,k))||new Set(v.kinds).size!==v.kinds.length||!time(v.notBefore)||!time(v.notAfter)||v.notAfter<=v.notBefore||!bool(v.revoked))return null;
  return freezeDeep({keyId:v.keyId,publicKeyHex:v.publicKeyHex,kinds:[...v.kinds],notBefore:v.notBefore,notAfter:v.notAfter,revoked:v.revoked});
}
function trustStore(input){
  if(!Array.isArray(input)||input.length>MAX_KEYS)return null;
  const entries=input.map(trustEntry);
  if(entries.some(e=>!e)||new Set(entries.map(e=>e.keyId)).size!==entries.length)return null;
  return freezeDeep(entries);
}
function policy(input){
  const v=own(POLICY_FIELDS,input);
  if(!v||!Number.isSafeInteger(v.maxAgeMs)||v.maxAgeMs<1||v.maxAgeMs>MAX_AGE_MS)return null;
  return freezeDeep({maxAgeMs:v.maxAgeMs});
}

// attest(input) -> AttestResult {status: ATTESTED | REFUSED}. Never throws. It refuses to sign
// anything that is not an intact record of the declared kind, and the key seed never appears in the result.
function attest(input){
  const refused=(attestationId,reasonCode)=>freezeDeep({version:RESULT_VERSION,attestationId,status:'REFUSED',reasonCode,envelope:null,authority:'NONE',grantsAuthority:false});
  try{
    const v=own(ATTEST_FIELDS,input);
    if(!v||v.version!==ATTEST_INPUT_VERSION||!id(v.attestationId)||!time(v.issuedAt)||!oneOf(KIND_NAMES,v.recordKind))return refused('invalid','INPUT_INVALID');
    const signer=own(SIGNER_FIELDS,v.signer);
    if(!signer||!id(signer.keyId)||!hash(signer.seedHex))return refused(v.attestationId,'SIGNER_INVALID');
    const bound=describe(v.recordKind,v.record);
    if(bound.reasonCode)return refused(v.attestationId,bound.reasonCode);
    const unsigned={version:ENVELOPE_VERSION,attestationId:v.attestationId,algorithm:ALGORITHM,keyId:signer.keyId,recordKind:v.recordKind,recordVersion:bound.recordVersion,recordDigest:bound.recordDigest,payloadDigest:bound.payloadDigest,taskRef:bound.taskRef,issuedAt:v.issuedAt,authority:'NONE'};
    const signature=sign(null,Buffer.from(signedPart(unsigned),'utf8'),privateKeyOf(signer.seedHex)).toString('hex');
    const sealed=envelope({...unsigned,signature});
    if(!sealed)return refused(v.attestationId,'INTERNAL_INVARIANT_VIOLATED');
    return freezeDeep({version:RESULT_VERSION,attestationId:v.attestationId,status:'ATTESTED',reasonCode:'ATTESTED',envelope:sealed,authority:'NONE',grantsAuthority:false});
  }catch{return refused('invalid','INTERNAL_INVARIANT_VIOLATED');}
}

function sealCheck(record){return freezeDeep({...record,checkDigest:sha256(canonical(record))});}
// check(input) -> AttestationCheck {status: AUTHENTIC | REJECTED}. Never throws; anything it cannot trust is REJECTED with the reason.
function check(input){
  const meta={checkId:'invalid',at:0,recordKind:null,recordDigest:null,taskRef:null,keyId:null,issuedAt:null,attestationId:null,trustStoreDigest:null,policy:null};
  const done=(status,reasonCode)=>sealCheck({version:CHECK_VERSION,checkId:meta.checkId,status,authentic:status==='AUTHENTIC',reasonCode,attestationId:meta.attestationId,recordKind:meta.recordKind,recordDigest:meta.recordDigest,taskRef:meta.taskRef,keyId:meta.keyId,issuedAt:meta.issuedAt,
    provenance:{attestVersion:VERSION,algorithm:ALGORITHM,trustStoreDigest:meta.trustStoreDigest,policy:meta.policy},at:meta.at,authority:'NONE',originOnly:true,grantsAuthority:false,approves:false,executes:false});
  try{
    const v=own(CHECK_FIELDS,input);
    if(!v||v.version!==CHECK_INPUT_VERSION||!id(v.checkId)||!time(v.at))return done('REJECTED','INPUT_INVALID');
    Object.assign(meta,{checkId:v.checkId,at:v.at});
    const pol=policy(v.policy);if(!pol)return done('REJECTED','POLICY_INVALID');meta.policy=pol;
    const expected=own(EXPECTED_FIELDS,v.expected);
    if(!expected||!(expected.recordKind===null||oneOf(KIND_NAMES,expected.recordKind))||!(expected.taskRef===null||id(expected.taskRef)))return done('REJECTED','EXPECTATION_INVALID');
    const store=trustStore(v.trustStore);if(!store)return done('REJECTED','TRUST_STORE_INVALID');meta.trustStoreDigest=sha256(canonical(store));
    const e=envelope(v.envelope);if(!e)return done('REJECTED','ENVELOPE_INVALID');
    Object.assign(meta,{attestationId:e.attestationId,recordKind:e.recordKind,recordDigest:e.recordDigest,taskRef:e.taskRef,keyId:e.keyId,issuedAt:e.issuedAt});
    // The signature is checked before anything the envelope says is believed.
    const key=store.find(k=>k.keyId===e.keyId);
    if(!key)return done('REJECTED','KEY_UNKNOWN');
    let signed=false;try{signed=verify(null,Buffer.from(signedPart(e),'utf8'),publicKeyOf(key.publicKeyHex),Buffer.from(e.signature,'hex'))===true;}catch{signed=false;}
    if(!signed)return done('REJECTED','SIGNATURE_INVALID');
    if(key.revoked)return done('REJECTED','KEY_REVOKED');
    if(e.issuedAt<key.notBefore||e.issuedAt>=key.notAfter)return done('REJECTED','KEY_NOT_VALID_AT_ISSUE');
    if(!key.kinds.includes(e.recordKind))return done('REJECTED','KEY_NOT_BOUND_TO_KIND');
    if(e.issuedAt>v.at)return done('REJECTED','ATTESTATION_FROM_THE_FUTURE');
    if(v.at-e.issuedAt>pol.maxAgeMs)return done('REJECTED','ATTESTATION_TOO_OLD');
    if(expected.recordKind!==null&&expected.recordKind!==e.recordKind)return done('REJECTED','UNEXPECTED_RECORD_KIND');
    if(expected.taskRef!==null&&expected.taskRef!==e.taskRef)return done('REJECTED','UNEXPECTED_TASK');
    // The record the caller holds must be the record the envelope was issued for.
    const bound=describe(e.recordKind,v.record);
    if(bound.reasonCode)return done('REJECTED',bound.reasonCode);
    if(bound.recordDigest!==e.recordDigest||bound.payloadDigest!==e.payloadDigest||bound.taskRef!==e.taskRef)return done('REJECTED','RECORD_NOT_THE_ATTESTED_ONE');
    return done('AUTHENTIC','AUTHENTIC');
  }catch{return done('REJECTED','INTERNAL_INVARIANT_VIOLATED');}
}
function verifyCheck(record){
  if(!record||typeof record!=='object'||Array.isArray(record)||!hash(record.checkDigest))return false;
  try{const {checkDigest,...rest}=record;return sha256(canonical(rest))===checkDigest&&rest.authentic===(rest.status==='AUTHENTIC')&&rest.authority==='NONE'&&rest.grantsAuthority===false;}catch{return false;}
}
module.exports=Object.freeze({VERSION,ATTEST_INPUT_VERSION,CHECK_INPUT_VERSION,ENVELOPE_VERSION,RESULT_VERSION,CHECK_VERSION,ALGORITHM,KIND_NAMES,ATTEST_FIELDS,SIGNER_FIELDS,ENVELOPE_FIELDS,CHECK_FIELDS,TRUST_FIELDS,EXPECTED_FIELDS,POLICY_FIELDS,DEFAULT_POLICY,derivePublicKey,envelope,trustStore,policy,attest,check,verifyCheck});
