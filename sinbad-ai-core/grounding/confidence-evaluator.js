(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadGroundingConfidenceEvaluator=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function evaluate(input={}){
    const status=String(input.status||'');const citations=Array.isArray(input.citations)?input.citations:[];
    const claims=Array.isArray(input.claims)?input.claims:[];const reasons=[];
    if(status!=='GROUNDED')return Object.freeze({state:'NON_CONCLUSIVE',reasons:Object.freeze([status||'UNKNOWN_SAFE_STOP'])});
    if(claims.some(claim=>!claim.supported))reasons.push('UNSUPPORTED_CLAIM_PRESENT');
    if(citations.some(citation=>!citation.metadataComplete))reasons.push('SOURCE_METADATA_INCOMPLETE');
    const authoritative=citations.filter(citation=>citation.verified&&citation.authority==='authoritative');
    if(!authoritative.length)reasons.push('NO_AUTHORITATIVE_EVIDENCE');
    if(reasons.includes('UNSUPPORTED_CLAIM_PRESENT'))return Object.freeze({state:'NON_CONCLUSIVE',reasons:Object.freeze(reasons)});
    if(reasons.length)return Object.freeze({state:'LOW',reasons:Object.freeze(reasons)});
    const allAuthoritative=citations.length>0&&citations.every(citation=>citation.verified&&citation.authority==='authoritative');
    return Object.freeze({state:allAuthoritative?'HIGH':'MODERATE',reasons:Object.freeze([allAuthoritative?'ALL_CLAIMS_AUTHORITATIVELY_SUPPORTED':'MIXED_EVIDENCE_QUALITY'])});
  }
  return {evaluate};
});
