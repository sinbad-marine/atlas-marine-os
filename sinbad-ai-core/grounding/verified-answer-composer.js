'use strict';
const SCHEMA_VERSION='sinbad-verified-answer-composition/2H-v1';
const COMPOSER_VERSION='sinbad-deterministic-answer-composer/2H-v1';

function compareText(a,b){return a<b?-1:a>b?1:0;}
function compose(input={},context={}){
  const claims=Array.isArray(input.claims)?input.claims:[];
  const citations=new Map((Array.isArray(input.citations)?input.citations:[]).map(citation=>[String(citation?.id||''),citation]));
  const invalid=claims.some(claim=>!claim||!claim.claimId||!String(claim.statement||'').trim()||claim.supported!==true||claim.verificationStatus!=='CLAIM_SUPPORTED'||!Array.isArray(claim.citationIds)||claim.citationIds.length===0||claim.citationIds.some(id=>{const citation=citations.get(String(id));return !citation||String(citation.claimId)!==String(claim.claimId);}));
  const ordered=invalid?[]:[...claims].sort((a,b)=>compareText(String(a.claimId),String(b.claimId)));
  const seen=new Set(),statements=[];
  for(const claim of ordered){const statement=String(claim.statement).trim();if(seen.has(statement))continue;seen.add(statement);statements.push(statement);}
  const valid=!invalid&&ordered.length>0&&statements.length>0;
  const output=Object.freeze({schemaVersion:SCHEMA_VERSION,composerVersion:COMPOSER_VERSION,status:valid?'ANSWER_COMPOSED':'COMPOSITION_INVALID',reasonCode:valid?null:'VERIFIED_CLAIMS_REQUIRED',answer:valid?statements.join(' '):null,claimIds:Object.freeze(ordered.map(claim=>String(claim.claimId))),metrics:Object.freeze({verifiedClaimCount:ordered.length,uniqueStatementCount:statements.length,deduplicatedStatementCount:Math.max(0,ordered.length-statements.length)})});
  if(context.audit&&typeof context.audit.append==='function')context.audit.append('answer-composition','verified-answer-composer',valid?'passed':'stopped',valid?'ANSWER_COMPOSED':'ANSWER_COMPOSITION_STOPPED',{composerVersion:COMPOSER_VERSION,schemaVersion:SCHEMA_VERSION,claimCount:ordered.length,uniqueStatementCount:statements.length});
  return output;
}
module.exports=Object.freeze({SCHEMA_VERSION,COMPOSER_VERSION,compose});
