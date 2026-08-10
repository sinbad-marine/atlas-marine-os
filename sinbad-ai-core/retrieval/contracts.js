(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadRetrievalContracts=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const EVIDENCE_CLASSES=Object.freeze([
    'verified-authoritative','secondary','user-provided','memory-context'
  ]);
  const AUTHORITY_LEVELS=Object.freeze(['none','advisory','secondary','authoritative']);

  function clamp(value,fallback=0){
    return Number.isFinite(value)?Math.max(0,Math.min(1,Number(value))):fallback;
  }
  function freezeLocation(input={}){
    return Object.freeze({
      section:input.section==null?null:String(input.section),
      page:input.page==null?null:String(input.page),
      chunk:input.chunk==null?null:String(input.chunk),
      uri:input.uri==null?null:String(input.uri)
    });
  }
  function query(input={}){
    const text=String(input.query||'').trim();
    if(!text)throw new TypeError('retrieval query is required');
    return Object.freeze({
      id:String(input.id||''),query:text,language:String(input.language||'en'),
      limit:Number.isInteger(input.limit)&&input.limit>0?Math.min(input.limit,100):10,
      requireAuthoritative:Boolean(input.requireAuthoritative),
      safetyCritical:Boolean(input.safetyCritical),
      filters:Object.freeze({...((input.filters&&typeof input.filters==='object')?input.filters:{})})
    });
  }
  function evidence(input={}){
    let evidenceClass=EVIDENCE_CLASSES.includes(input.evidenceClass)?input.evidenceClass:'secondary';
    let authority=AUTHORITY_LEVELS.includes(input.authority)?input.authority:'none';
    let verified=Boolean(input.verified);
    if(evidenceClass==='memory-context'){
      authority='advisory';verified=false;
    }else if(evidenceClass!=='verified-authoritative'){
      verified=false;
      if(authority==='authoritative')authority='secondary';
    }else if(authority!=='authoritative'||!verified){
      evidenceClass='secondary';authority=authority==='none'?'secondary':authority;verified=false;
    }
    const claims=Object.freeze((Array.isArray(input.claims)?input.claims:[]).map(claim=>Object.freeze({
      key:String(claim?.key||''),value:String(claim?.value??''),scope:claim?.scope==null?null:String(claim.scope)
    })).filter(claim=>claim.key));
    return Object.freeze({
      id:String(input.id||''),sourceId:String(input.sourceId||''),
      sourceType:String(input.sourceType||'unknown'),evidenceClass,authority,verified,
      title:String(input.title||''),content:String(input.content||''),
      location:freezeLocation(input.location),relevance:clamp(input.relevance),
      publishedAt:input.publishedAt==null?null:String(input.publishedAt),
      version:input.version==null?null:String(input.version),
      retrievedAt:input.retrievedAt==null?null:String(input.retrievedAt),
      claims,
      instructionPolicy:'DATA_ONLY',maySatisfyAuthoritativeRequirement:verified&&authority==='authoritative'
    });
  }
  function retrievalResult(input={}){
    return Object.freeze({
      query:query(input.query||{}),
      items:Object.freeze((Array.isArray(input.items)?input.items:[]).map(evidence)),
      rejected:Object.freeze((Array.isArray(input.rejected)?input.rejected:[]).map(item=>Object.freeze({...item}))),
      metrics:Object.freeze({...((input.metrics&&typeof input.metrics==='object')?input.metrics:{})})
    });
  }
  return {EVIDENCE_CLASSES,AUTHORITY_LEVELS,query,evidence,retrievalResult};
});
