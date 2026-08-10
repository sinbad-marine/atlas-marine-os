(function(root,factory){
  const load=path=>typeof module==='object'&&module.exports?require(path):null;
  const api=factory({contracts:load('./contracts.js')||root.SinbadRetrievalContracts});
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadEvidenceEvaluator=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(deps){
  function normalizeClaimValue(value){return String(value).trim().toLocaleLowerCase();}
  function evaluate(input={}){
    const items=(Array.isArray(input.items)?input.items:[]).map(deps.contracts.evidence);
    const minimumRelevance=Number.isFinite(input.minimumRelevance)?Math.max(0,Math.min(1,input.minimumRelevance)):0.35;
    const requireAuthoritative=Boolean(input.requireAuthoritative);
    const safetyCritical=Boolean(input.safetyCritical);
    const selected=[];const rejected=[];
    for(const item of items){
      if(item.relevance<minimumRelevance){
        rejected.push(Object.freeze({item,reason:'LOW_RELEVANCE'}));continue;
      }
      selected.push(item);
    }
    const claimIndex=new Map();
    for(const item of selected){
      if(item.evidenceClass==='memory-context')continue;
      for(const claim of item.claims){
        const key=`${claim.scope||''}:${claim.key}`;
        const values=claimIndex.get(key)||new Map();
        const value=normalizeClaimValue(claim.value);
        const sources=values.get(value)||[];sources.push(item);values.set(value,sources);claimIndex.set(key,values);
      }
    }
    const conflicts=[];
    for(const [key,values] of claimIndex){
      if(values.size<2)continue;
      conflicts.push(Object.freeze({
        claim:key,values:Object.freeze([...values].map(([value,sources])=>Object.freeze({value,sourceIds:Object.freeze(sources.map(x=>x.sourceId))})))
      }));
    }
    const authoritative=selected.filter(item=>item.maySatisfyAuthoritativeRequirement);
    let status='EVIDENCE_SUFFICIENT';
    if(conflicts.length)status='EVIDENCE_CONFLICT';
    else if(requireAuthoritative&&!authoritative.length)status='SOURCE_INSUFFICIENT';
    const conclusive=status==='EVIDENCE_SUFFICIENT'&&(!safetyCritical||authoritative.length>0);
    return Object.freeze({
      status,conclusive,requireAuthoritative,safetyCritical,minimumRelevance,
      selected:Object.freeze(selected),rejected:Object.freeze(rejected),
      authoritative:Object.freeze(authoritative),conflicts:Object.freeze(conflicts),
      reason:status==='SOURCE_INSUFFICIENT'?'AUTHORITATIVE_EVIDENCE_NOT_FOUND':status==='EVIDENCE_CONFLICT'?'MEANINGFUL_CLAIM_CONFLICT':null
    });
  }
  return {evaluate};
});

