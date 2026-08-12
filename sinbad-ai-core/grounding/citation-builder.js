(function(root,factory){
  const load=path=>typeof module==='object'&&module.exports?require(path):null;
  const api=factory({contracts:load('./contracts.js')||root.SinbadGroundingContracts,provenance:load('../library/provenance.js')||root.SinbadLibraryProvenance,verifier:load('../verification/claim-support-verifier.js')||root.SinbadClaimSupportVerifier,claimContracts:load('../verification/claim-contracts.js')||root.SinbadClaimContracts});
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadCitationBuilder=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(deps){
  function build(input={}){
    const started=typeof input.clock==='function'?input.clock():Date.now();
    const selected=Array.isArray(input.selected)?input.selected:[];
    const rejected=Array.isArray(input.rejected)?input.rejected:[];
    const selectedById=new Map(selected.map(item=>[item.id,item]));
    const rejectedIds=new Set(rejected.map(entry=>entry?.item?.id||entry?.id).filter(Boolean));
    const verifications=new Map((Array.isArray(input.verifications)?input.verifications:[]).map(value=>[value.claimId,value]));
    const citations=[];const claims=[];const errors=[];const used=new Set();const processedClaims=new Set();
    for(const raw of Array.isArray(input.claims)?input.claims:[]){
      const id=String(raw?.claimId||'');if(processedClaims.has(id))continue;processedClaims.add(id);let validated;try{validated=deps.claimContracts.claim(raw);}catch(error){errors.push(Object.freeze({claimId:id,evidenceId:raw?.support?.evidenceId||null,reason:'CLAIM_INVALID'}));claims.push(deps.contracts.claim({...raw,claimId:id,supported:false,verificationStatus:'CLAIM_INVALID',verificationReason:error.message,verifierVersion:null}));continue;}const verification=verifications.get(id);const evidenceIds=[String(validated.support.evidenceId)];
      const citationIds=[];let authoritative=false;
      if(!deps.verifier.isAuthenticResult(verification)||verification.status!=='CLAIM_SUPPORTED'||!verification.citationEligible||verification.claimId!==validated.claimId||verification.evidenceId!==validated.support.evidenceId){errors.push(Object.freeze({claimId:id,evidenceId:evidenceIds[0]||null,reason:deps.verifier.isAuthenticResult(verification)?verification.status:'VERIFICATION_REQUIRED'}));claims.push(deps.contracts.claim({...validated,claimId:id,evidenceIds,citationIds,requiresAuthoritative:Boolean(validated.requiresAuthoritative),supported:false,verificationStatus:deps.verifier.isAuthenticResult(verification)?verification.status:null,verificationReason:deps.verifier.isAuthenticResult(verification)?verification.reasonCode:'VERIFICATION_REQUIRED',verifierVersion:deps.verifier.isAuthenticResult(verification)?verification.verifierVersion:null}));continue;}
      for(const evidenceId of evidenceIds){
        if(rejectedIds.has(evidenceId)){errors.push(Object.freeze({claimId:id,evidenceId,reason:'REJECTED_EVIDENCE_REFERENCE'}));continue;}
        const item=selectedById.get(evidenceId);
        if(!item){errors.push(Object.freeze({claimId:id,evidenceId,reason:'ORPHAN_EVIDENCE_REFERENCE'}));continue;}
        if(item.sourceType==='offline-publication'&&item.maySatisfyAuthoritativeRequirement){try{deps.provenance.validate(item.provenance,{authoritative:true});}catch(error){errors.push(Object.freeze({claimId:id,evidenceId,reason:'PROVENANCE_INCOMPLETE'}));continue;}}
        const citationId=`citation:${id}:${evidenceId}`;
        const metadataComplete=Boolean(item.sourceId&&item.sourceType&&item.title&&item.location&&(item.location.page||item.location.section||item.location.chunk||item.location.uri));
        citations.push(deps.contracts.citation({
          id:citationId,claimId:id,evidenceId,sourceId:item.sourceId||null,sourceType:item.sourceType||null,
          sourceClass:item.evidenceClass||null,title:item.title||null,location:item.location||{},publishedAt:item.publishedAt,
          version:item.version,authority:item.authority||null,verified:item.verified,metadataComplete,provenance:item.provenance||{}
        }));
        citationIds.push(citationId);used.add(evidenceId);
        if(item.maySatisfyAuthoritativeRequirement)authoritative=true;
      }
      const supported=citationIds.length>0&&(!raw?.requiresAuthoritative||authoritative)&&verification.status==='CLAIM_SUPPORTED';
      if(raw?.requiresAuthoritative&&!authoritative)errors.push(Object.freeze({claimId:id,reason:'AUTHORITATIVE_SUPPORT_MISSING'}));
      if(!citationIds.length)errors.push(Object.freeze({claimId:id,reason:'UNSUPPORTED_CLAIM'}));
      claims.push(deps.contracts.claim({...raw,claimId:id,evidenceIds,citationIds,requiresAuthoritative:Boolean(raw?.requiresAuthoritative),supported,verificationStatus:verification.status,verificationReason:verification.reasonCode,verifierVersion:verification.verifierVersion}));
    }
    const finished=typeof input.clock==='function'?input.clock():Date.now();
    return Object.freeze({claims:Object.freeze(claims),citations:Object.freeze(citations),evidenceUsed:Object.freeze([...used]),errors:Object.freeze(errors),durationMs:Math.max(0,finished-started)});
  }
  return {build};
});
