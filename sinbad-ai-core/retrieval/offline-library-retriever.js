(function(root,factory){
  const load=path=>typeof module==='object'&&module.exports?require(path):null;
  const api=factory({
    contracts:load('./contracts.js')||root.SinbadRetrievalContracts,
    adapter:load('./source-adapter.js')||root.SinbadRetrievalSourceAdapter
  });
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadOfflineLibraryRetriever=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(deps){
  function tokens(text){
    return [...new Set(String(text).toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu)||[])];
  }
  function create(options={}){
    const sources=Array.isArray(options.sources)?options.sources:[];
    const chunks=Array.isArray(options.chunks)?options.chunks:[];
    const now=typeof options.now==='function'?options.now:()=>new Date().toISOString();
    const byId=new Map(sources.map(source=>[String(source.id),source]));
    return deps.adapter.create({id:String(options.id||'offline-library'),kind:'offline-library',search(input={}){
      const request=deps.contracts.query(input);
      const queryTokens=tokens(request.query);
      const ranked=[];
      for(const chunk of chunks){
        const source=byId.get(String(chunk.source_id||chunk.sourceId||''))||{};
        const haystack=tokens([chunk.title,chunk.category,source.title,source.category,chunk.content].join(' '));
        const matches=queryTokens.filter(token=>haystack.includes(token)).length;
        if(!matches)continue;
        const relevance=queryTokens.length?matches/queryTokens.length:0;
        const explicitlyVerified=source.evidenceClass==='verified-authoritative'&&source.verified===true;
        ranked.push(deps.contracts.evidence({
          id:`${source.id||'unknown'}:${chunk.chunk_index??chunk.chunkIndex??ranked.length}`,
          sourceId:source.id||chunk.source_id||'',sourceType:source.type||source.category||chunk.category||'offline-document',
          evidenceClass:explicitlyVerified?'verified-authoritative':source.evidenceClass||'secondary',
          authority:explicitlyVerified?'authoritative':source.authorityLevel||'secondary',verified:explicitlyVerified,
          title:chunk.title||source.title||'',content:chunk.content||'',relevance,
          location:{section:chunk.section,page:chunk.page,chunk:chunk.chunk_index??chunk.chunkIndex,uri:chunk.url||source.url},
          publishedAt:source.publishedAt||null,version:source.version||source.edition||null,retrievedAt:now()
        }));
      }
      ranked.sort((a,b)=>b.relevance-a.relevance||a.id.localeCompare(b.id));
      return deps.contracts.retrievalResult({query:request,items:ranked.slice(0,request.limit),metrics:{candidateCount:ranked.length}});
    }});
  }
  return {create};
});

