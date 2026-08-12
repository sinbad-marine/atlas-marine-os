'use strict';
const crypto=require('node:crypto');
const SCHEMA_VERSION='sinbad-answer-citation-map-verification/2J-v1';
const VERIFIER_VERSION='sinbad-independent-answer-citation-map-verifier/2J-v1';
const COMPOSITION_SCHEMA='sinbad-verified-answer-composition/2I-v1';
const COMPOSER_VERSION='sinbad-deterministic-answer-composer/2I-v1';
const authenticResults=new WeakSet();
function sha256(value){return crypto.createHash('sha256').update(Buffer.from(String(value),'utf8')).digest('hex');}
function compare(a,b){return a<b?-1:a>b?1:0;}
function same(a,b){return a.length===b.length&&a.every((value,index)=>value===b[index]);}
function result(value){const output=Object.freeze(value);authenticResults.add(output);return output;}
function isAuthenticResult(value){return Boolean(value&&authenticResults.has(value));}
function verify(input={},context={}){
  const answer=typeof input.answer==='string'?input.answer:null,composition=input.composition;
  const claims=Array.isArray(input.claims)?input.claims:[],citations=Array.isArray(input.citations)?input.citations:[];
  let reasonCode=null;
  if(!answer||!composition||composition.schemaVersion!==COMPOSITION_SCHEMA||composition.composerVersion!==COMPOSER_VERSION||composition.status!=='ANSWER_COMPOSED'||composition.answer!==answer||composition.answerHash!==sha256(answer))reasonCode='ANSWER_MANIFEST_MISMATCH';
  const claimMap=new Map(),citationMap=new Map();
  if(!reasonCode){for(const claim of claims){const id=String(claim?.claimId||'');if(!id||claimMap.has(id)){reasonCode='CLAIM_SET_INVALID';break;}claimMap.set(id,claim);}for(const citation of citations){const id=String(citation?.id||'');if(!id||citationMap.has(id)){reasonCode='CITATION_SET_INVALID';break;}citationMap.set(id,citation);}}
  const expectedClaimIds=[...claimMap.keys()].sort(compare),manifestClaimIds=Array.isArray(composition?.claimIds)?composition.claimIds.map(String):[];
  if(!reasonCode&&(!same(manifestClaimIds,expectedClaimIds)||!Array.isArray(composition.segments)||composition.segments.length===0))reasonCode='CLAIM_MANIFEST_MISMATCH';
  const boundClaims=new Set();let cursor=0;
  if(!reasonCode)for(const segment of composition.segments){
    if(!segment||!Number.isInteger(segment.startOffset)||!Number.isInteger(segment.endOffset)||segment.startOffset!==cursor||segment.endOffset<=segment.startOffset||segment.endOffset>answer.length||segment.offsetEncoding!=='UTF16_CODE_UNIT'){reasonCode='SEGMENT_RANGE_INVALID';break;}
    const statement=answer.slice(segment.startOffset,segment.endOffset);if(segment.statementHash!==sha256(statement)){reasonCode='SEGMENT_HASH_MISMATCH';break;}
    const bindings=Array.isArray(segment.bindings)?segment.bindings:[],segmentClaimIds=Array.isArray(segment.claimIds)?segment.claimIds.map(String):[],segmentCitationIds=Array.isArray(segment.citationIds)?segment.citationIds.map(String):[];
    const bindingClaimIds=[],citationUnion=new Set();
    for(const binding of bindings){const claimId=String(binding?.claimId||''),claim=claimMap.get(claimId),ids=Array.isArray(binding?.citationIds)?binding.citationIds.map(String):[];if(!claim||boundClaims.has(claimId)||String(claim.statement||'').trim()!==statement||!same(ids,[...(claim.citationIds||[])].map(String).sort(compare))){reasonCode='CLAIM_BINDING_INVALID';break;}for(const id of ids){const citation=citationMap.get(id);if(!citation||String(citation.claimId)!==claimId){reasonCode='CITATION_BINDING_INVALID';break;}citationUnion.add(id);}if(reasonCode)break;boundClaims.add(claimId);bindingClaimIds.push(claimId);}
    if(reasonCode)break;if(!same(segmentClaimIds,bindingClaimIds)||!same(segmentCitationIds,[...citationUnion].sort(compare))){reasonCode='SEGMENT_BINDING_MISMATCH';break;}
    cursor=segment.endOffset;if(cursor<answer.length){if(answer[cursor]!==' '){reasonCode='SEGMENT_GAP_INVALID';break;}cursor++;}
  }
  if(!reasonCode&&(cursor!==answer.length||boundClaims.size!==claimMap.size||citationMap.size!==new Set(composition.segments.flatMap(segment=>segment.citationIds||[])).size))reasonCode='MANIFEST_COVERAGE_INCOMPLETE';
  const valid=!reasonCode,output=result({schemaVersion:SCHEMA_VERSION,verifierVersion:VERIFIER_VERSION,status:valid?'MAP_VERIFIED':'MAP_INVALID',reasonCode,answerHash:valid?sha256(answer):null,segmentCount:valid?composition.segments.length:0,claimCount:valid?claimMap.size:0,citationCount:valid?citationMap.size:0});
  if(context.audit&&typeof context.audit.append==='function')context.audit.append('answer-citation-verification','answer-citation-map-verifier',valid?'passed':'stopped',valid?'ANSWER_CITATION_MAP_VERIFIED':'ANSWER_CITATION_MAP_REJECTED',{verifierVersion:VERIFIER_VERSION,schemaVersion:SCHEMA_VERSION,reasonCode,segmentCount:output.segmentCount});
  return output;
}
module.exports=Object.freeze({SCHEMA_VERSION,VERIFIER_VERSION,COMPOSITION_SCHEMA,COMPOSER_VERSION,sha256,verify,isAuthenticResult});
