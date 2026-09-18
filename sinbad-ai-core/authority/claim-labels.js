'use strict';
// Claim vocabulary and truth-state labels. Deterministic: a label follows from the source classes
// behind a claim, never from wording or confidence. Reserved terms are words that assert a
// verified, accepted, deployed or authorized state; they may appear only when bound to evidence.
const {own,id,bool,freezeDeep}=require('./exact');
const {isSourceClass,dimension}=require('./authority-model');
const VERSION='sinbad-claim-labels/1-v1';
const LABELS=Object.freeze(['VERIFIED','NOT_VERIFIED','CONFLICT','SOURCE_MISSING','BLOCKED','NOT_APPLICABLE']);
const RESERVED_TERMS=Object.freeze(['VERIFIED','PASS','PASSED','MERGED','DEPLOYED','ONLINE','SAFE','COMPLIANT','AAL2','OWNER ACCEPTED','AUTHORIZED','READY FOR MERGE','APPROVED','COMPLETE']);
const RESERVED_PATTERNS=RESERVED_TERMS.map(term=>Object.freeze({term,pattern:new RegExp(`(?<![\\p{L}\\p{N}_])${term.replace(/ /gu,'\\s+')}(?![\\p{L}\\p{N}_])`,'iu')}));
const CLAIM_FIELDS=Object.freeze(['claimId','evidenceClasses','conflict','applicable']);

function detectReservedTerms(text){
  if(typeof text!=='string'||text.length>65536)return Object.freeze([]);
  return Object.freeze(RESERVED_PATTERNS.filter(({pattern})=>pattern.test(text)).map(({term})=>term));
}
// boundTerms: reserved terms the caller has bound to evidence identifiers (an EvidenceMap entry).
function reservedTermsBound(text,boundTerms){
  const found=detectReservedTerms(text);
  const bound=Array.isArray(boundTerms)?boundTerms.filter(term=>typeof term==='string').map(term=>term.toUpperCase()):[];
  const unbound=found.filter(term=>!bound.includes(term));
  return Object.freeze({version:VERSION,found,unbound,status:unbound.length?'RESERVED_TERMS_UNBOUND':'RESERVED_TERMS_BOUND'});
}
function labelClaim(input){
  const invalid=reasonCode=>Object.freeze({version:VERSION,label:'BLOCKED',reasonCode});
  const value=own(CLAIM_FIELDS,input);
  if(!value||!id(value.claimId)||!bool(value.conflict)||!bool(value.applicable)||!Array.isArray(value.evidenceClasses)||value.evidenceClasses.length>64||!value.evidenceClasses.every(isSourceClass))return invalid('CLAIM_INPUT_INVALID');
  const classes=value.evidenceClasses;
  let label,reasonCode;
  if(!value.applicable){label='NOT_APPLICABLE';reasonCode='CLAIM_NOT_APPLICABLE';}
  else if(!classes.length){label='SOURCE_MISSING';reasonCode='NO_EVIDENCE';}
  else if(value.conflict){label='CONFLICT';reasonCode='EVIDENCE_CONFLICT';}
  else if(classes.some(c=>dimension(c)==='OBSERVED')){label='VERIFIED';reasonCode='OBSERVED_EVIDENCE_PRESENT';}
  else if(classes.some(c=>dimension(c)==='NORMATIVE')){label='NOT_VERIFIED';reasonCode='NORMATIVE_ONLY_CANNOT_ESTABLISH_FACT';}
  else{label='NOT_VERIFIED';reasonCode='NON_AUTHORITATIVE_ONLY';}
  return freezeDeep({version:VERSION,claimId:value.claimId,label,reasonCode,evidenceClasses:[...classes]});
}
module.exports=Object.freeze({VERSION,LABELS,RESERVED_TERMS,detectReservedTerms,reservedTermsBound,labelClaim});
