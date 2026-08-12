'use strict';
const crypto=require('node:crypto');
const SCHEMA_VERSION='sinbad-verified-answer-composition/2I-v1';
const COMPOSER_VERSION='sinbad-deterministic-answer-composer/2I-v1';
const MAX_COMPOSER_CLAIMS=64;

function compareText(a,b){return a<b?-1:a>b?1:0;}
function sha256(value){return crypto.createHash('sha256').update(Buffer.from(String(value),'utf8')).digest('hex');}
function compose(input={},context={}){
  const claims=Array.isArray(input.claims)?input.claims:[];
  const citations=new Map((Array.isArray(input.citations)?input.citations:[]).map(citation=>[String(citation?.id||''),citation]));
  let invalid=claims.length>MAX_COMPOSER_CLAIMS||claims.some(claim=>!claim||!claim.claimId||!String(claim.statement||'').trim()||claim.supported!==true||claim.verificationStatus!=='CLAIM_SUPPORTED'||!Array.isArray(claim.citationIds)||claim.citationIds.length===0||claim.citationIds.some(id=>{const citation=citations.get(String(id));return !citation||String(citation.claimId)!==String(claim.claimId);}));
  const ordered=invalid?[]:[...claims].sort((a,b)=>compareText(String(a.claimId),String(b.claimId)));
  const groups=new Map();
  for(const claim of ordered){const statement=String(claim.statement).trim(),claimId=String(claim.claimId),ids=[...claim.citationIds].map(String).sort(compareText);let group=groups.get(statement);if(!group){group={statement,claimIds:[],citationIds:new Set(),bindings:[]};groups.set(statement,group);}group.claimIds.push(claimId);group.bindings.push(Object.freeze({claimId,citationIds:Object.freeze(ids)}));for(const id of ids)group.citationIds.add(id);}
  const statements=[...groups.keys()];const answer=statements.join(' ');let cursor=0;
  const segments=Object.freeze([...groups.values()].map(group=>{const startOffset=cursor,endOffset=startOffset+group.statement.length;cursor=endOffset+1;return Object.freeze({startOffset,endOffset,offsetEncoding:'UTF16_CODE_UNIT',statementHash:sha256(group.statement),claimIds:Object.freeze([...group.claimIds]),citationIds:Object.freeze([...group.citationIds].sort(compareText)),bindings:Object.freeze([...group.bindings])});}));
  if(!invalid)invalid=segments.some(segment=>answer.slice(segment.startOffset,segment.endOffset).length!==segment.endOffset-segment.startOffset||sha256(answer.slice(segment.startOffset,segment.endOffset))!==segment.statementHash);
  const valid=!invalid&&ordered.length>0&&statements.length>0;
  const output=Object.freeze({schemaVersion:SCHEMA_VERSION,composerVersion:COMPOSER_VERSION,status:valid?'ANSWER_COMPOSED':'COMPOSITION_INVALID',reasonCode:valid?null:'VERIFIED_CLAIMS_REQUIRED',answer:valid?answer:null,answerHash:valid?sha256(answer):null,claimIds:Object.freeze(ordered.map(claim=>String(claim.claimId))),segments:valid?segments:Object.freeze([]),metrics:Object.freeze({verifiedClaimCount:ordered.length,uniqueStatementCount:statements.length,deduplicatedStatementCount:Math.max(0,ordered.length-statements.length),segmentCount:valid?segments.length:0})});
  if(context.audit&&typeof context.audit.append==='function')context.audit.append('answer-composition','verified-answer-composer',valid?'passed':'stopped',valid?'ANSWER_COMPOSED':'ANSWER_COMPOSITION_STOPPED',{composerVersion:COMPOSER_VERSION,schemaVersion:SCHEMA_VERSION,claimCount:ordered.length,uniqueStatementCount:statements.length});
  if(context.audit&&typeof context.audit.append==='function')context.audit.append('answer-citation-map','verified-answer-composer',valid?'passed':'stopped',valid?'ANSWER_CITATIONS_MAPPED':'ANSWER_CITATION_MAP_STOPPED',{composerVersion:COMPOSER_VERSION,schemaVersion:SCHEMA_VERSION,segmentCount:valid?segments.length:0});
  return output;
}
module.exports=Object.freeze({SCHEMA_VERSION,COMPOSER_VERSION,MAX_COMPOSER_CLAIMS,sha256,compose});
