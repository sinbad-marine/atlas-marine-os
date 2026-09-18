'use strict';
// Deterministic builders for the Record Attestation v0 tests. TEST KEYS ONLY: every seed below is
// the SHA-256 of a public label, derived at test time; no key material is stored in the repository
// and none of these keys protects anything.
const a=require('../../attest/attest-v0.js');
const chainBuilders=require('./chain-v0-builders.js');
const {k,s,NOW,pass,input:chainInput,supported,invention}=chainBuilders;
const seedOf=label=>s.sha256(`test-only-attestation-key:${label}`);
const KEYS=Object.freeze({gate:seedOf('gate'),copilot:seedOf('copilot'),pilot:seedOf('pilot'),chain:seedOf('chain'),sentinel:seedOf('sentinel'),stranger:seedOf('stranger')});
const entry=(keyId,seedHex,kinds,changes)=>({keyId,publicKeyHex:a.derivePublicKey(seedHex),kinds,notBefore:NOW-100_000,notAfter:NOW+100_000,revoked:false,...changes});
const TRUST=()=>[entry('key-gate',KEYS.gate,['GATEKEEPER_DECISION']),entry('key-copilot',KEYS.copilot,['COPILOT_REVIEW']),entry('key-pilot',KEYS.pilot,['PILOT_DECISION']),entry('key-chain',KEYS.chain,['CHAIN_TRANSCRIPT']),entry('key-sentinel',KEYS.sentinel,['SENTINEL_REPORT'])];
const plain=x=>JSON.parse(JSON.stringify(x));
// Real sealed records of every kind, produced by one offline rehearsal.
function recordsOf(draft){
  const transcript=plain(k.rehearse(chainInput({passes:[pass(draft||supported(1))]})));const r=transcript.steps[0].records;
  return {SENTINEL_REPORT:r.gateDecision.observation,COPILOT_REVIEW:r.review,GATEKEEPER_DECISION:r.gateDecision,PILOT_DECISION:r.pilotDecision,CHAIN_TRANSCRIPT:transcript};
}
const SIGNERS=Object.freeze({SENTINEL_REPORT:['key-sentinel',KEYS.sentinel],COPILOT_REVIEW:['key-copilot',KEYS.copilot],GATEKEEPER_DECISION:['key-gate',KEYS.gate],PILOT_DECISION:['key-pilot',KEYS.pilot],CHAIN_TRANSCRIPT:['key-chain',KEYS.chain]});
const attestInput=(recordKind,record,changes)=>({version:a.ATTEST_INPUT_VERSION,attestationId:'att-1',issuedAt:NOW-10,recordKind,record,signer:{keyId:SIGNERS[recordKind][0],seedHex:SIGNERS[recordKind][1]},...changes});
const checkInput=(envelope,record,changes)=>({version:a.CHECK_INPUT_VERSION,checkId:'check-1',at:NOW,envelope,record,trustStore:TRUST(),expected:{recordKind:null,taskRef:null},policy:{maxAgeMs:10_000},...changes});
const reseal=(record,field)=>{const {[field]:_,...rest}=record;return {...rest,[field]:s.sha256(s.canonical(rest))};};
module.exports={a,k,s,NOW,KEYS,entry,TRUST,plain,recordsOf,SIGNERS,attestInput,checkInput,reseal,supported,invention,pass,chainInput};
