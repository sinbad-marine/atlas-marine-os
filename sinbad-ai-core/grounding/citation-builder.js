(function(root,factory){
  const load=path=>typeof module==='object'&&module.exports?require(path):null;
  const api=factory({contracts:load('./contracts.js')||root.SinbadGroundingContracts,provenance:load('../library/provenance.js')||root.SinbadLibraryProvenance});
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadCitationBuilder=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(deps){
  function build(input={}){
    const started=typeof input.clock==='function'?input.clock():Date.now();
    const selected=Array.isArray(input.selected)?input.selected:[];
    const rejected=Array.isArray(input.rejected)?input.rejected:[];
    const selectedById=new Map(selected.map(item=>[item.id,item]));
    const rejectedIds=new Set(rejected.map(entry=>entry?.item?.id||entry?.id).filter(Boolean));
    const citations=[];const claims=[];const errors=[];const used=new Set();
    for(const raw of Array.isArray(input.claims)?input.claims:[]){
      const id=String(raw?.id||'');const evidenceIds=[...new Set((Array.isArray(raw?.evidenceIds)?raw.evidenceIds:[]).map(String))];
      const citationIds=[];let authoritative=false;
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
      const supported=citationIds.length>0&&(!raw?.requiresAuthoritative||authoritative);
      if(raw?.requiresAuthoritative&&!authoritative)errors.push(Object.freeze({claimId:id,reason:'AUTHORITATIVE_SUPPORT_MISSING'}));
      if(!citationIds.length)errors.push(Object.freeze({claimId:id,reason:'UNSUPPORTED_CLAIM'}));
      claims.push(deps.contracts.claim({...raw,id,evidenceIds,citationIds,requiresAuthoritative:Boolean(raw?.requiresAuthoritative),supported}));
    }
    const finished=typeof input.clock==='function'?input.clock():Date.now();
    return Object.freeze({claims:Object.freeze(claims),citations:Object.freeze(citations),evidenceUsed:Object.freeze([...used]),errors:Object.freeze(errors),durationMs:Math.max(0,finished-started)});
  }
  return {build};
});
